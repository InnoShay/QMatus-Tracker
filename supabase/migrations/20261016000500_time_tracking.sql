-- QMatus Team Tracker — P1 time tracking (spec §7.13, §8.5, §4.6).
--
-- Privacy model:
--   * A time entry is visible to its owner only. Team readers, grant holders,
--     leads and admins never read rows (or notes) of someone else's entries.
--   * Team totals are a separate capability (DECISIONS D-022): the team's own
--     lead may call team_time_totals(), which returns one suppressed aggregate
--     and never rows, names or per-person figures.
--   * Clients have no INSERT/UPDATE/DELETE grant. Every write goes through a
--     SECURITY DEFINER function below that authorizes the caller, serializes on
--     the caller's user id and writes a history event in the same transaction.
--
-- Invariants enforced by the database, not the UI:
--   * at most one running timer per user (partial unique index);
--   * a user's live entries never overlap (exclusion constraint);
--   * entries point at a task of the same team (composite FK);
--   * nobody keeps writing time to a task they can no longer write to:
--     membership removal, suspension, grant revocation/expiry, task or team
--     archive stop the running timer (stop rule in DECISIONS D-023).

create extension if not exists btree_gist with schema extensions;

create type public.time_entry_source as enum ('timer', 'manual');
create type public.time_stop_reason as enum ('user', 'switched', 'access_lost', 'suspended', 'task_archived');

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  task_id uuid not null,
  user_id uuid not null,
  source public.time_entry_source not null,
  -- UTC instants. A running timer has ended_at = null.
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds int generated always as (
    case when ended_at is null then null else extract(epoch from (ended_at - started_at))::int end
  ) stored,
  note text check (note is null or char_length(note) <= 500),
  stop_reason public.time_stop_reason,
  -- Client-generated idempotency key for manual entries (retries return the same row).
  request_id uuid,
  version int not null default 1,
  corrected_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, id),
  foreign key (org_id, team_id) references public.teams (org_id, id),
  foreign key (team_id, task_id) references public.tasks (team_id, id),
  foreign key (org_id, user_id) references public.organization_memberships (org_id, profile_id),
  check (ended_at is null or ended_at >= started_at),
  check (source = 'timer' or ended_at is not null),
  check (stop_reason is null or (source = 'timer' and ended_at is not null)),
  check (deleted_at is null or ended_at is not null)
);

-- One running timer per user across the organization (spec §7.13).
create unique index time_entries_one_running_per_user on public.time_entries (user_id) where ended_at is null;
create unique index time_entries_request_idx on public.time_entries (user_id, request_id) where request_id is not null;
create index time_entries_user_time_idx on public.time_entries (user_id, started_at desc) where deleted_at is null;
create index time_entries_task_idx on public.time_entries (task_id) where deleted_at is null;
create index time_entries_team_time_idx on public.time_entries (team_id, started_at) where deleted_at is null;

-- A person cannot be in two places at once: live entries never overlap.
alter table public.time_entries add constraint time_entries_no_overlap
  exclude using gist (
    user_id with =,
    tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz), '[)') with &&
  ) where (deleted_at is null);

-- Owner-only, append-only history of starts, stops, manual entries and corrections.
create table public.time_entry_events (
  id bigint generated always as identity primary key,
  team_id uuid not null,
  entry_id uuid not null,
  user_id uuid not null references public.profiles (id),
  actor_id uuid references public.profiles (id),
  event text not null check (event in ('started', 'stopped', 'auto_stopped', 'manual_created', 'corrected', 'deleted')),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 1500),
  created_at timestamptz not null default now(),
  foreign key (team_id, entry_id) references public.time_entries (team_id, id)
);
create index time_entry_events_entry_idx on public.time_entry_events (entry_id, created_at);
create trigger time_entry_events_immutable before update or delete on public.time_entry_events
  for each row execute function app.forbid_mutation();
create trigger time_entry_events_no_truncate before truncate on public.time_entry_events
  for each statement execute function app.forbid_mutation();

-- Defense in depth: even trusted functions cannot move an entry between owners,
-- tasks or teams, and every update bumps the version.
create function app.time_entries_before_update() returns trigger
language plpgsql as $$
begin
  if new.id <> old.id or new.org_id <> old.org_id or new.team_id <> old.team_id or new.task_id <> old.task_id
     or new.user_id <> old.user_id or new.source <> old.source or new.created_at <> old.created_at then
    raise exception 'immutable time entry field changed' using errcode = '42501';
  end if;
  if old.deleted_at is not null then
    raise exception 'that time entry was deleted' using errcode = '22023';
  end if;
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger time_entries_before_update before update on public.time_entries
  for each row execute function app.time_entries_before_update();

-- ---------------------------------------------------------------------------
-- Internal helpers (not granted to app roles)
-- ---------------------------------------------------------------------------

-- Same rule as app.can_write_team, for an arbitrary user. Used by triggers that
-- run as the acting admin and must decide about the affected member.
create function app.user_can_write_team(p_user uuid, p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.team_memberships tm
    join public.organization_memberships om on om.org_id = tm.org_id and om.profile_id = tm.profile_id
    join public.teams t on t.id = tm.team_id
    where tm.team_id = p_team and tm.profile_id = p_user and tm.active and om.state = 'active' and t.archived_at is null
  ) or exists (
    select 1
    from public.team_access_grants g
    join public.organization_memberships om on om.org_id = g.org_id and om.profile_id = g.grantee_id
    join public.teams t on t.id = g.team_id
    where g.team_id = p_team and g.grantee_id = p_user and g.scope = 'edit' and g.status = 'active'
      and (g.expires_at is null or g.expires_at > now()) and om.state = 'active' and t.archived_at is null
  );
$$;

create function app.log_time_event(p_entry public.time_entries, p_event text, p_data jsonb default '{}'::jsonb)
returns void
language sql security definer set search_path = '' as $$
  insert into public.time_entry_events (team_id, entry_id, user_id, actor_id, event, data)
  values (p_entry.team_id, p_entry.id, p_entry.user_id, auth.uid(), p_event, coalesce(p_data, '{}'::jsonb));
$$;

-- Serializes every time write of one user, so concurrent starts/stops/edits
-- from several tabs or devices apply one at a time.
create function app.lock_user_time(p_user uuid) returns void
language sql as $$
  select pg_advisory_xact_lock(hashtextextended('qmatus.time_entries:' || p_user::text, 0));
$$;

-- Ends one running timer. Never ends before it started.
create function app.end_timer(p_entry uuid, p_at timestamptz, p_reason public.time_stop_reason) returns public.time_entries
language plpgsql security definer set search_path = '' as $$
declare r public.time_entries;
begin
  update public.time_entries e
  set ended_at = greatest(e.started_at, p_at), stop_reason = p_reason
  where e.id = p_entry and e.ended_at is null
  returning * into r;
  if found then
    perform app.log_time_event(r,
      case when p_reason in ('user', 'switched') then 'stopped' else 'auto_stopped' end,
      jsonb_build_object('reason', p_reason, 'ended_at', r.ended_at));
  end if;
  return r;
end;
$$;

-- Event-driven stop rule (membership removal, suspension, grant revocation,
-- task/team archive). Filters are optional; p_check_access keeps timers the
-- user may still write through another path (e.g. membership plus edit grant).
create function app.auto_stop_timers(
  p_user uuid, p_org uuid, p_team uuid, p_task uuid, p_reason public.time_stop_reason, p_check_access boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare e record;
begin
  for e in
    select te.id, te.user_id, te.team_id from public.time_entries te
    where te.ended_at is null
      and (p_user is null or te.user_id = p_user)
      and (p_org is null or te.org_id = p_org)
      and (p_team is null or te.team_id = p_team)
      and (p_task is null or te.task_id = p_task)
    for update
  loop
    if p_check_access and app.user_can_write_team(e.user_id, e.team_id) then
      continue;
    end if;
    perform app.end_timer(e.id, clock_timestamp(), p_reason);
  end loop;
end;
$$;

-- Lazy part of the stop rule: a grant can expire without any event, so every
-- time operation first settles the caller's running timer. It ends at the
-- moment access ended (grant expiry) when that is known, otherwise now.
create function app.settle_user_timer(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.time_entries;
  v_archived boolean;
  v_expired_at timestamptz;
begin
  select * into e from public.time_entries where user_id = p_user and ended_at is null for update;
  if not found then
    return;
  end if;
  select t.archived_at is not null into v_archived from public.tasks t where t.id = e.task_id;
  if v_archived then
    perform app.end_timer(e.id, clock_timestamp(), 'task_archived');
  elsif not app.user_can_write_team(p_user, e.team_id) then
    select max(g.expires_at) into v_expired_at from public.team_access_grants g
    where g.grantee_id = p_user and g.team_id = e.team_id and g.scope = 'edit' and g.status = 'active'
      and g.expires_at <= now() and g.expires_at > e.started_at;
    perform app.end_timer(e.id, coalesce(v_expired_at, clock_timestamp()), 'access_lost');
  end if;
end;
$$;

-- Validation shared by manual entries and corrections (DECISIONS D-023).
create function app.assert_time_range(p_started timestamptz, p_ended timestamptz) returns void
language plpgsql stable set search_path = '' as $$
begin
  if p_started is null or p_ended is null then
    raise exception 'enter a start and an end time' using errcode = '22023';
  end if;
  if p_ended <= p_started then
    raise exception 'the end time must be after the start time' using errcode = '22023';
  end if;
  if p_ended - p_started > interval '24 hours' then
    raise exception 'one entry can be at most 24 hours long' using errcode = '22023';
  end if;
  if p_ended > now() + interval '1 minute' then
    raise exception 'time entries cannot end in the future' using errcode = '22023';
  end if;
  if p_started < now() - interval '90 days' then
    raise exception 'time entries can only be added or corrected for the last 90 days' using errcode = '22023';
  end if;
end;
$$;

-- Resolves a task the caller may log time on. Unknown and unreadable tasks
-- are indistinguishable; readable-but-read-only tasks are "not permitted".
create function app.time_task(p_task uuid) returns public.tasks
language plpgsql stable security definer set search_path = '' as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = p_task;
  if not found or not app.can_read_team(t.team_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if not app.can_write_team(t.team_id) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  return t;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public operations (spec §13: startTimer, stopTimer, createManualTimeEntry,
-- correctTimeEntry). All are transactional and safe to retry.
-- ---------------------------------------------------------------------------

-- Starts a timer on a task. Retrying on the same task returns the running
-- entry unchanged; starting on another task stops the running one first
-- (stop_reason 'switched'), so there is never more than one.
create function public.start_timer(p_task uuid) returns setof public.time_entries
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_uid();
  t public.tasks;
  cur public.time_entries;
  r public.time_entries;
  v_now timestamptz;
begin
  perform app.lock_user_time(v_uid);
  t := app.time_task(p_task);
  perform app.settle_user_timer(v_uid);

  select * into cur from public.time_entries where user_id = v_uid and ended_at is null;
  if found and cur.task_id = t.id then
    return next cur;
    return;
  end if;
  if t.archived_at is not null then
    raise exception 'archived tasks cannot take new time' using errcode = '22023';
  end if;

  -- clock_timestamp, not now(): after waiting on the lock, this start must be
  -- later than whatever the previous holder of the lock wrote.
  v_now := clock_timestamp();
  if cur.id is not null then
    perform app.end_timer(cur.id, v_now, 'switched');
  end if;

  insert into public.time_entries (org_id, team_id, task_id, user_id, source, started_at)
  values (t.org_id, t.team_id, t.id, v_uid, 'timer', v_now)
  returning * into r;
  perform app.log_time_event(r, 'started', jsonb_build_object('started_at', r.started_at));
  return next r;
end;
$$;

-- Stops the caller's running timer (or the given entry). Stopping an entry
-- that already ended returns it unchanged; with nothing running it returns no row.
create function public.stop_timer(p_entry uuid default null) returns setof public.time_entries
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_uid();
  r public.time_entries;
begin
  perform app.lock_user_time(v_uid);
  perform app.settle_user_timer(v_uid);
  if p_entry is null then
    select * into r from public.time_entries where user_id = v_uid and ended_at is null;
    if not found then
      return;
    end if;
  else
    select * into r from public.time_entries where id = p_entry and user_id = v_uid and deleted_at is null;
    if not found then
      raise exception 'not found' using errcode = 'P0002';
    end if;
    if r.ended_at is not null then
      return next r;
      return;
    end if;
  end if;
  return next app.end_timer(r.id, clock_timestamp(), 'user');
end;
$$;

-- The caller's running timer, after applying the stop rule.
create function public.current_timer() returns setof public.time_entries
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.require_uid();
begin
  perform app.lock_user_time(v_uid);
  perform app.settle_user_timer(v_uid);
  return query select * from public.time_entries where user_id = v_uid and ended_at is null;
end;
$$;

create function public.add_time_entry(
  p_task uuid, p_started_at timestamptz, p_ended_at timestamptz, p_note text default null, p_request_id uuid default null
) returns setof public.time_entries
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_uid();
  t public.tasks;
  r public.time_entries;
begin
  perform app.lock_user_time(v_uid);
  if p_request_id is not null then
    select * into r from public.time_entries where user_id = v_uid and request_id = p_request_id;
    if found then
      return next r;
      return;
    end if;
  end if;
  t := app.time_task(p_task);
  if t.archived_at is not null then
    raise exception 'archived tasks cannot take new time' using errcode = '22023';
  end if;
  perform app.assert_time_range(p_started_at, p_ended_at);
  perform app.settle_user_timer(v_uid);

  begin
    insert into public.time_entries (org_id, team_id, task_id, user_id, source, started_at, ended_at, note, request_id)
    values (t.org_id, t.team_id, t.id, v_uid, 'manual', p_started_at, least(p_ended_at, now()),
            nullif(btrim(p_note), ''), p_request_id)
    returning * into r;
  exception when exclusion_violation then
    raise exception 'that overlaps another of your time entries' using errcode = '22023';
  end;
  perform app.log_time_event(r, 'manual_created',
    jsonb_build_object('started_at', r.started_at, 'ended_at', r.ended_at));
  return next r;
end;
$$;

-- Owner-only correction of a finished entry, version-checked. The previous
-- values are kept in the entry's history.
create function public.correct_time_entry(
  p_entry uuid, p_expected_version int, p_started_at timestamptz, p_ended_at timestamptz, p_note text default null
) returns setof public.time_entries
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_uid();
  prev public.time_entries;
  r public.time_entries;
  v_note text := nullif(btrim(p_note), '');
begin
  perform app.lock_user_time(v_uid);
  perform app.settle_user_timer(v_uid);
  select * into prev from public.time_entries where id = p_entry and user_id = v_uid and deleted_at is null for update;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if not app.can_write_team(prev.team_id) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if prev.ended_at is null then
    raise exception 'stop the timer before correcting it' using errcode = '22023';
  end if;
  if prev.version <> p_expected_version then
    raise exception 'this entry changed since you loaded it' using errcode = '40001';
  end if;
  if prev.started_at = p_started_at and prev.ended_at = p_ended_at and prev.note is not distinct from v_note then
    return next prev;
    return;
  end if;
  perform app.assert_time_range(p_started_at, p_ended_at);

  begin
    update public.time_entries
    set started_at = p_started_at, ended_at = p_ended_at, note = v_note, corrected_at = now()
    where id = prev.id
    returning * into r;
  exception when exclusion_violation then
    raise exception 'that overlaps another of your time entries' using errcode = '22023';
  end;
  perform app.log_time_event(r, 'corrected', jsonb_build_object(
    'from', jsonb_build_object('started_at', prev.started_at, 'ended_at', prev.ended_at, 'note_changed', prev.note is distinct from v_note),
    'to', jsonb_build_object('started_at', r.started_at, 'ended_at', r.ended_at)));
  return next r;
end;
$$;

-- Soft delete by the owner. The row and its history stay; totals ignore it.
create function public.delete_time_entry(p_entry uuid, p_expected_version int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_uid();
  r public.time_entries;
begin
  perform app.lock_user_time(v_uid);
  select * into r from public.time_entries where id = p_entry and user_id = v_uid for update;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if r.deleted_at is not null then
    return;
  end if;
  if not app.can_write_team(r.team_id) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if r.ended_at is null then
    raise exception 'stop the timer before deleting it' using errcode = '22023';
  end if;
  if r.version <> p_expected_version then
    raise exception 'this entry changed since you loaded it' using errcode = '40001';
  end if;
  update public.time_entries set deleted_at = now() where id = r.id returning * into r;
  perform app.log_time_event(r, 'deleted', '{}'::jsonb);
end;
$$;

-- Team totals: the separate capability (DECISIONS D-022). Only the team's own
-- lead; one aggregate for the period, no rows, notes, people or per-person
-- figures; suppressed when fewer than 3 people logged time (subtraction risk).
create function public.team_time_totals(p_team uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_seconds bigint;
  v_people int;
  v_tz text;
begin
  perform app.require_uid();
  if not app.is_team_lead(p_team) then
    return null;
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'choose a period of up to one year' using errcode = '22023';
  end if;
  select coalesce(nullif(p.timezone, ''), 'UTC') into v_tz from public.profiles p where p.id = auth.uid();
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_tz) then
    v_tz := 'UTC';
  end if;
  select coalesce(sum(e.duration_seconds), 0), count(distinct e.user_id) into v_seconds, v_people
  from public.time_entries e
  where e.team_id = p_team and e.deleted_at is null and e.ended_at is not null
    and e.started_at >= (p_from::timestamp at time zone v_tz)
    and e.started_at < ((p_to + 1)::timestamp at time zone v_tz);
  return jsonb_build_object(
    'from', p_from, 'to', p_to,
    'suppressed', v_people < 3,
    'total_seconds', case when v_people < 3 then null else v_seconds end
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Event-driven stop rule (spec §4.6, §8.5 step 5)
-- ---------------------------------------------------------------------------
create function app.timers_on_membership_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.active and not new.active then
    perform app.auto_stop_timers(new.profile_id, null, new.team_id, null, 'access_lost', true);
  end if;
  return new;
end;
$$;
create trigger team_memberships_stop_timers after update of active on public.team_memberships
  for each row execute function app.timers_on_membership_change();

create function app.timers_on_member_state() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.state = 'suspended' and old.state <> 'suspended' then
    perform app.auto_stop_timers(new.profile_id, new.org_id, null, null, 'suspended', false);
  end if;
  return new;
end;
$$;
create trigger org_memberships_stop_timers after update of state on public.organization_memberships
  for each row execute function app.timers_on_member_state();

create function app.timers_on_grant_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'active' and new.status <> 'active' and old.scope = 'edit' then
    perform app.auto_stop_timers(new.grantee_id, null, new.team_id, null, 'access_lost', true);
  end if;
  return new;
end;
$$;
create trigger grants_stop_timers after update of status on public.team_access_grants
  for each row execute function app.timers_on_grant_change();

create function app.timers_on_task_archive() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    perform app.auto_stop_timers(null, null, null, new.id, 'task_archived', false);
  end if;
  return new;
end;
$$;
create trigger tasks_stop_timers after update of archived_at on public.tasks
  for each row execute function app.timers_on_task_archive();

create function app.timers_on_team_archive() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    perform app.auto_stop_timers(null, null, new.id, null, 'access_lost', false);
  end if;
  return new;
end;
$$;
create trigger teams_stop_timers after update of archived_at on public.teams
  for each row execute function app.timers_on_team_archive();

-- ---------------------------------------------------------------------------
-- RLS and grants: owners read their own rows; nobody writes directly.
-- ---------------------------------------------------------------------------
alter table public.time_entries enable row level security;
alter table public.time_entry_events enable row level security;

create policy time_entries_select_own on public.time_entries for select to authenticated
  using (user_id = (select auth.uid()) and app.active_org_member(org_id));
create policy time_entry_events_select_own on public.time_entry_events for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.time_entries, public.time_entry_events to authenticated;

grant execute on function
  public.start_timer(uuid),
  public.stop_timer(uuid),
  public.current_timer(),
  public.add_time_entry(uuid, timestamptz, timestamptz, text, uuid),
  public.correct_time_entry(uuid, int, timestamptz, timestamptz, text),
  public.delete_time_entry(uuid, int),
  public.team_time_totals(uuid, date, date)
  to authenticated;
