-- QMatus Team Tracker — Work Request / Intake: the controlled cross-team boundary.
--
-- Shared surface (request audience + target team): work_requests,
--   work_request_audience, work_request_messages, work_request_status_events.
-- Internal surface (target team readers only): work_request_triage,
--   work_request_internal_notes, work_request_task_links.
-- Reading a request never grants access to the private tasks linked behind it.

create type public.request_status as enum (
  'draft', 'submitted', 'in_triage', 'needs_info', 'accepted', 'in_progress', 'delivered', 'closed', 'declined'
);

create table public.work_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  number int generated always as identity,
  source_team_id uuid,
  target_team_id uuid not null,
  submitter_id uuid not null references public.profiles (id),
  title text not null check (char_length(btrim(title)) between 3 and 160),
  problem text not null check (char_length(btrim(problem)) between 1 and 5000),
  outcome text not null check (char_length(btrim(outcome)) between 1 and 3000),
  acceptance_criteria text check (acceptance_criteria is null or char_length(acceptance_criteria) <= 3000),
  links text check (links is null or char_length(links) <= 2000),
  requested_priority public.task_priority not null default 'none',
  requested_date date,
  committed_priority public.task_priority,
  committed_date date,
  status public.request_status not null default 'draft',
  outcome_reason text check (outcome_reason is null or char_length(outcome_reason) <= 1000),
  duplicate_of uuid references public.work_requests (id),
  client_key uuid not null,
  submitted_at timestamptz,
  last_public_update_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submitter_id, client_key),
  foreign key (org_id, target_team_id) references public.teams (org_id, id),
  foreign key (org_id, source_team_id) references public.teams (org_id, id),
  check (source_team_id is null or source_team_id <> target_team_id),
  check (duplicate_of is null or duplicate_of <> id)
);
create index work_requests_target_idx on public.work_requests (target_team_id, status, submitted_at desc);
create index work_requests_submitter_idx on public.work_requests (submitter_id, created_at desc);

create table public.work_request_audience (
  request_id uuid not null references public.work_requests (id) on delete cascade,
  profile_id uuid not null references public.profiles (id),
  added_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (request_id, profile_id)
);
create index work_request_audience_profile_idx on public.work_request_audience (profile_id);

create table public.work_request_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.work_requests (id),
  author_id uuid not null references public.profiles (id),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index work_request_messages_idx on public.work_request_messages (request_id, created_at);

-- Every row here is requester-safe by construction: a status change and an
-- optional summary that a target-team member chose to publish.
create table public.work_request_status_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.work_requests (id),
  actor_id uuid references public.profiles (id),
  kind text not null check (kind in ('status', 'update')),
  from_status public.request_status,
  to_status public.request_status not null,
  public_summary text check (public_summary is null or char_length(public_summary) <= 2000),
  created_at timestamptz not null default now()
);
create index work_request_events_idx on public.work_request_status_events (request_id, created_at);

create table public.work_request_triage (
  request_id uuid primary key references public.work_requests (id),
  target_team_id uuid not null references public.teams (id),
  triage_owner_id uuid,
  updated_at timestamptz not null default now(),
  foreign key (target_team_id, triage_owner_id) references public.team_memberships (team_id, profile_id)
);

create table public.work_request_internal_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.work_requests (id),
  target_team_id uuid not null references public.teams (id),
  author_id uuid not null references public.profiles (id),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index work_request_notes_idx on public.work_request_internal_notes (request_id, created_at);

create table public.work_request_task_links (
  request_id uuid not null references public.work_requests (id),
  team_id uuid not null,
  task_id uuid not null,
  linked_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (request_id, task_id),
  foreign key (team_id, task_id) references public.tasks (team_id, id)
);
create index work_request_task_links_task_idx on public.work_request_task_links (task_id);

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------
create function app.can_read_request(p_request uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.work_requests r
    where r.id = p_request
      and app.active_org_member(r.org_id)
      and (
        r.submitter_id = (select auth.uid())
        or (r.status <> 'draft' and (
          exists (select 1 from public.work_request_audience a where a.request_id = r.id and a.profile_id = (select auth.uid()))
          or app.can_read_team(r.target_team_id)
        ))
      )
  );
$$;

create function app.can_triage_request(p_request uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.work_requests r
    where r.id = p_request and r.status <> 'draft' and app.is_team_member(r.target_team_id)
  );
$$;

create function app.request_target_team(p_request uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select target_team_id from public.work_requests where id = p_request;
$$;

grant execute on function app.can_read_request(uuid), app.can_triage_request(uuid), app.request_target_team(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Submission (idempotent on submitter + client_key)
-- ---------------------------------------------------------------------------
create function public.submit_work_request(
  p_client_key uuid,
  p_target_team uuid,
  p_title text,
  p_problem text,
  p_outcome text,
  p_requested_priority public.task_priority,
  p_as_draft boolean,
  p_source_team uuid default null,
  p_acceptance_criteria text default null,
  p_links text default null,
  p_requested_date date default null,
  p_audience uuid[] default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_uid();
  v_org uuid;
  v_id uuid;
  v_status public.request_status := case when p_as_draft then 'draft' else 'submitted' end;
  v_member uuid;
  r record;
begin
  select id into v_id from public.work_requests where submitter_id = v_uid and client_key = p_client_key;
  if v_id is not null then
    return v_id; -- duplicate submission of the same form: return the original
  end if;

  select t.org_id into v_org
  from public.teams t
  join public.organization_memberships om on om.org_id = t.org_id and om.profile_id = v_uid
  where t.id = p_target_team and t.accepts_requests and t.archived_at is null
    and om.state = 'active' and om.can_request;
  if v_org is null then
    raise exception 'that team is not accepting requests right now' using errcode = '22023';
  end if;
  if p_source_team is not null and not app.is_team_member(p_source_team) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if p_source_team = p_target_team then
    raise exception 'use the team board for work inside your own team' using errcode = '22023';
  end if;
  if p_requested_date is not null and p_requested_date < current_date then
    raise exception 'requested date cannot be in the past' using errcode = '22023';
  end if;

  insert into public.work_requests (
    org_id, source_team_id, target_team_id, submitter_id, title, problem, outcome, acceptance_criteria, links,
    requested_priority, requested_date, status, client_key, submitted_at
  ) values (
    v_org, p_source_team, p_target_team, v_uid, btrim(p_title), btrim(p_problem), btrim(p_outcome),
    nullif(btrim(p_acceptance_criteria), ''), nullif(btrim(p_links), ''),
    coalesce(p_requested_priority, 'none'), p_requested_date, v_status, p_client_key,
    case when p_as_draft then null else now() end
  ) returning id into v_id;

  insert into public.work_request_audience (request_id, profile_id, added_by) values (v_id, v_uid, v_uid);
  foreach v_member in array coalesce(p_audience, '{}'::uuid[]) loop
    if v_member <> v_uid and exists (
      select 1 from public.organization_memberships where org_id = v_org and profile_id = v_member and state = 'active'
    ) then
      insert into public.work_request_audience (request_id, profile_id, added_by) values (v_id, v_member, v_uid)
      on conflict do nothing;
    end if;
  end loop;

  insert into public.work_request_triage (request_id, target_team_id) values (v_id, p_target_team);

  if not p_as_draft then
    insert into public.work_request_status_events (request_id, actor_id, kind, from_status, to_status)
    values (v_id, v_uid, 'status', null, 'submitted');
    for r in
      select tm.profile_id from public.team_memberships tm
      where tm.team_id = p_target_team and tm.active and tm.role = 'lead'
    loop
      perform app.notify(v_org, r.profile_id, 'request_submitted', 'request', v_id, 'request_submitted:' || v_id);
    end loop;
  end if;

  perform app.audit(v_org, 'work_request.created', p_target_team, 'work_request', v_id,
    jsonb_build_object('status', v_status));
  return v_id;
end;
$$;
grant execute on function public.submit_work_request(uuid, uuid, text, text, text, public.task_priority, boolean, uuid, text, text, date, uuid[])
  to authenticated;

create function public.submit_draft_request(p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.work_requests; m record;
begin
  perform app.require_uid();
  select * into r from public.work_requests where id = p_request for update;
  if not found or r.submitter_id <> auth.uid() or not app.active_org_member(r.org_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if r.status <> 'draft' then
    raise exception 'this request was already submitted' using errcode = '40001';
  end if;
  if r.requested_date is not null and r.requested_date < current_date then
    raise exception 'requested date cannot be in the past' using errcode = '22023';
  end if;
  if not exists (select 1 from public.teams where id = r.target_team_id and accepts_requests and archived_at is null) then
    raise exception 'that team is not accepting requests right now' using errcode = '22023';
  end if;
  update public.work_requests set status = 'submitted', submitted_at = now(), updated_at = now() where id = p_request;
  insert into public.work_request_status_events (request_id, actor_id, kind, from_status, to_status)
  values (p_request, auth.uid(), 'status', 'draft', 'submitted');
  for m in select profile_id from public.team_memberships where team_id = r.target_team_id and active and role = 'lead' loop
    perform app.notify(r.org_id, m.profile_id, 'request_submitted', 'request', p_request, 'request_submitted:' || p_request);
  end loop;
end;
$$;
grant execute on function public.submit_draft_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Triage transitions (target team only), version-guarded by expected status.
-- ---------------------------------------------------------------------------
create function app.request_transition_allowed(p_from public.request_status, p_to public.request_status)
returns boolean language sql immutable as $$
  select (p_from, p_to) in (
    ('submitted', 'in_triage'), ('submitted', 'declined'),
    ('in_triage', 'needs_info'), ('in_triage', 'accepted'), ('in_triage', 'declined'),
    ('needs_info', 'in_triage'), ('needs_info', 'declined'),
    ('accepted', 'in_progress'), ('accepted', 'delivered'), ('accepted', 'declined'),
    ('in_progress', 'delivered'), ('in_progress', 'accepted'),
    ('delivered', 'closed'), ('delivered', 'in_progress'),
    ('closed', 'in_triage'), ('declined', 'in_triage')
  );
$$;

create function public.transition_work_request(
  p_request uuid,
  p_expected public.request_status,
  p_to public.request_status,
  p_public_summary text default null,
  p_reason text default null,
  p_committed_priority public.task_priority default null,
  p_committed_date date default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.work_requests; a record;
begin
  perform app.require_uid();
  select * into r from public.work_requests where id = p_request for update;
  if not found or not app.can_triage_request(p_request) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if r.status <> p_expected then
    raise exception 'this request changed since you loaded it' using errcode = '40001';
  end if;
  if not app.request_transition_allowed(r.status, p_to) then
    raise exception 'that status change is not allowed' using errcode = '23514';
  end if;
  if p_to in ('declined', 'closed') and char_length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  if r.status in ('closed', 'declined') and char_length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'a reason is required to reopen' using errcode = '22023';
  end if;

  update public.work_requests set
    status = p_to,
    committed_priority = case when p_to = 'accepted' then coalesce(p_committed_priority, committed_priority) else committed_priority end,
    committed_date = case when p_to = 'accepted' then coalesce(p_committed_date, committed_date) else committed_date end,
    outcome_reason = case when p_to in ('declined', 'closed') then btrim(p_reason) else outcome_reason end,
    last_public_update_at = now(),
    updated_at = now()
  where id = p_request;

  insert into public.work_request_status_events (request_id, actor_id, kind, from_status, to_status, public_summary)
  values (p_request, auth.uid(), 'status', r.status, p_to,
    nullif(btrim(coalesce(p_public_summary, case when p_to in ('declined', 'closed') then p_reason end)), ''));

  for a in select profile_id from public.work_request_audience where request_id = p_request loop
    perform app.notify(r.org_id, a.profile_id, 'request_status', 'request', p_request);
  end loop;
end;
$$;
grant execute on function public.transition_work_request(uuid, public.request_status, public.request_status, text, text, public.task_priority, date)
  to authenticated;

create function public.publish_request_update(p_request uuid, p_summary text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.work_requests; a record;
begin
  perform app.require_uid();
  select * into r from public.work_requests where id = p_request;
  if not found or not app.can_triage_request(p_request) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_summary, ''))) not between 1 and 2000 then
    raise exception 'write a short update to publish' using errcode = '22023';
  end if;
  insert into public.work_request_status_events (request_id, actor_id, kind, from_status, to_status, public_summary)
  values (p_request, auth.uid(), 'update', r.status, r.status, btrim(p_summary));
  update public.work_requests set last_public_update_at = now() where id = p_request;
  for a in select profile_id from public.work_request_audience where request_id = p_request loop
    perform app.notify(r.org_id, a.profile_id, 'request_update', 'request', p_request);
  end loop;
end;
$$;
grant execute on function public.publish_request_update(uuid, text) to authenticated;

-- Accept + create private tasks atomically. The expected-status guard makes a
-- retried call fail with a conflict instead of creating a second task tree.
create function public.accept_work_request(
  p_request uuid,
  p_expected public.request_status,
  p_committed_priority public.task_priority,
  p_committed_date date default null,
  p_public_summary text default null,
  p_tasks jsonb default '[]'::jsonb
) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  r public.work_requests;
  t jsonb;
  v_task uuid;
  v_ids uuid[] := '{}';
begin
  perform app.require_uid();
  select * into r from public.work_requests where id = p_request;
  if not found or not app.can_triage_request(p_request) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_tasks, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_tasks, '[]'::jsonb)) > 20 then
    raise exception 'invalid task list' using errcode = '22023';
  end if;

  perform public.transition_work_request(p_request, p_expected, 'accepted', p_public_summary, null,
    p_committed_priority, p_committed_date);

  for t in select * from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) loop
    insert into public.tasks (team_id, title, type, priority, assignee_id, due_date, description)
    values (
      r.target_team_id,
      t ->> 'title',
      coalesce((t ->> 'type')::public.task_type, 'task'),
      coalesce((t ->> 'priority')::public.task_priority, coalesce(p_committed_priority, 'none')),
      nullif(t ->> 'assignee_id', '')::uuid,
      p_committed_date,
      'Created from work request REQ-' || r.number || '.'
    ) returning id into v_task;
    insert into public.work_request_task_links (request_id, team_id, task_id, linked_by)
    values (p_request, r.target_team_id, v_task, auth.uid());
    insert into public.task_activity (team_id, task_id, actor_id, event, data)
    values (r.target_team_id, v_task, auth.uid(), 'linked_to_request', jsonb_build_object('request_number', r.number));
    v_ids := v_ids || v_task;
  end loop;

  return v_ids;
end;
$$;
grant execute on function public.accept_work_request(uuid, public.request_status, public.task_priority, date, text, jsonb)
  to authenticated;

create function public.link_request_task(p_request uuid, p_task uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.work_requests; v_team uuid;
begin
  perform app.require_uid();
  select * into r from public.work_requests where id = p_request;
  if not found or not app.can_triage_request(p_request) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  select team_id into v_team from public.tasks where id = p_task;
  if v_team is distinct from r.target_team_id then
    raise exception 'only tasks from the receiving team can be linked' using errcode = '22023';
  end if;
  insert into public.work_request_task_links (request_id, team_id, task_id, linked_by)
  values (p_request, v_team, p_task, auth.uid()) on conflict do nothing;
end;
$$;
grant execute on function public.link_request_task(uuid, uuid) to authenticated;

create function public.add_request_audience(p_request uuid, p_profile uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.work_requests;
begin
  perform app.require_uid();
  select * into r from public.work_requests where id = p_request;
  if not found or not (r.submitter_id = auth.uid() or app.is_team_lead(r.target_team_id))
     or not app.active_org_member(r.org_id) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organization_memberships where org_id = r.org_id and profile_id = p_profile and state = 'active') then
    raise exception 'person is not an active workspace member' using errcode = '22023';
  end if;
  insert into public.work_request_audience (request_id, profile_id, added_by) values (p_request, p_profile, auth.uid())
  on conflict do nothing;
  perform app.audit(r.org_id, 'work_request.audience_added', r.target_team_id, 'work_request', p_request,
    jsonb_build_object('profile', p_profile));
end;
$$;
grant execute on function public.add_request_audience(uuid, uuid) to authenticated;

create function app.request_children_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.work_requests; a record;
begin
  new.author_id := auth.uid();
  new.created_at := now();
  select * into r from public.work_requests where id = new.request_id;
  if tg_table_name = 'work_request_internal_notes' then
    new.target_team_id := r.target_team_id;
  elsif tg_table_name = 'work_request_messages' then
    -- Notify everyone on the shared surface except the author.
    for a in select profile_id from public.work_request_audience where request_id = r.id loop
      perform app.notify(r.org_id, a.profile_id, 'request_message', 'request', r.id);
    end loop;
    if not app.is_team_member(r.target_team_id) then
      for a in select profile_id from public.team_memberships where team_id = r.target_team_id and active and role = 'lead' loop
        perform app.notify(r.org_id, a.profile_id, 'request_message', 'request', r.id);
      end loop;
    end if;
  end if;
  return new;
end;
$$;
create trigger work_request_messages_before_insert before insert on public.work_request_messages
  for each row execute function app.request_children_before_insert();
create trigger work_request_notes_before_insert before insert on public.work_request_internal_notes
  for each row execute function app.request_children_before_insert();

create function app.work_requests_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Direct updates by the submitter are limited to editing their own draft.
  if old.status <> 'draft' and current_user = 'authenticated' then
    raise exception 'submitted requests change only through triage' using errcode = '42501';
  end if;
  if new.requested_date is not null and new.requested_date < current_date and new.requested_date is distinct from old.requested_date then
    raise exception 'requested date cannot be in the past' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger work_requests_before_update before update on public.work_requests
  for each row execute function app.work_requests_before_update();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.work_requests enable row level security;
alter table public.work_request_audience enable row level security;
alter table public.work_request_messages enable row level security;
alter table public.work_request_status_events enable row level security;
alter table public.work_request_triage enable row level security;
alter table public.work_request_internal_notes enable row level security;
alter table public.work_request_task_links enable row level security;

create policy requests_select on public.work_requests for select to authenticated using (app.can_read_request(id));
create policy requests_update_draft on public.work_requests for update to authenticated
  using (submitter_id = (select auth.uid()) and status = 'draft' and app.active_org_member(org_id))
  with check (submitter_id = (select auth.uid()) and status = 'draft');

create policy audience_select on public.work_request_audience for select to authenticated
  using (app.can_read_request(request_id));

create policy messages_select on public.work_request_messages for select to authenticated
  using (app.can_read_request(request_id));
create policy messages_insert on public.work_request_messages for insert to authenticated
  with check (
    app.can_read_request(request_id)
    and exists (select 1 from public.work_requests r where r.id = request_id and r.status <> 'draft')
    and (
      exists (select 1 from public.work_request_audience a where a.request_id = work_request_messages.request_id and a.profile_id = (select auth.uid()))
      or app.is_team_member(app.request_target_team(request_id))
    )
  );

create policy events_select on public.work_request_status_events for select to authenticated
  using (app.can_read_request(request_id));

-- Internal records: target team readers only. Audience membership is irrelevant here.
create policy triage_select on public.work_request_triage for select to authenticated
  using (app.can_read_team(target_team_id));
create policy triage_update on public.work_request_triage for update to authenticated
  using (app.is_team_member(target_team_id)) with check (app.is_team_member(target_team_id));

create policy notes_select on public.work_request_internal_notes for select to authenticated
  using (app.can_read_team(target_team_id));
create policy notes_insert on public.work_request_internal_notes for insert to authenticated
  with check (app.is_team_member(app.request_target_team(request_id)));

create policy task_links_select on public.work_request_task_links for select to authenticated
  using (app.can_read_team(team_id));

grant select on public.work_requests, public.work_request_audience, public.work_request_messages,
  public.work_request_status_events, public.work_request_triage, public.work_request_internal_notes,
  public.work_request_task_links to authenticated;
grant update (title, problem, outcome, acceptance_criteria, links, requested_priority, requested_date)
  on public.work_requests to authenticated;
grant insert (request_id, body) on public.work_request_messages to authenticated;
grant insert (request_id, body) on public.work_request_internal_notes to authenticated;
grant update (triage_owner_id) on public.work_request_triage to authenticated;
