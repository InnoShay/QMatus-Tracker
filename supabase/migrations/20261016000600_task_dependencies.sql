-- QMatus Team Tracker — P1 task dependencies and blockers (spec §7.14).
--
-- One relation: "blocker blocks blocked" (read from the other side as
-- "is blocked by"). The manual blocked flag/reason on tasks stays as it was;
-- a task can be flagged without a link and linked without the flag.
--
-- Rules enforced by the database, not the UI:
--   * no self-links (CHECK) and no duplicate live links (partial unique index);
--   * no cycles, including concurrent attempts: every insert takes a per-org
--     transaction lock and then walks the live graph (trigger below);
--   * both ends belong to the same organization, and each end is a composite
--     (team_id, task_id) FK, so a link can't point at a task of a team it
--     doesn't name;
--   * clients have no INSERT/UPDATE/DELETE grant. add_task_dependency needs
--     write access to the task being edited and read access to the other
--     task (unknown and unreadable look the same); remove_task_dependency needs
--     write access to either end;
--   * links are never deleted. Removal is soft (removed_at/removed_by) and both
--     tasks get an activity row, and tasks themselves are archived, not deleted,
--     so the history explaining a blocker survives (spec §7.14);
--   * nobody reads the table directly unless they can read BOTH ends. The task
--     detail and board use get_task_dependencies() / task_blocker_counts(), which
--     return a generic "a task you can't view" row for an unreadable end:
--     no id, key, title or team (DECISIONS D-025).
--   * links are warning-only: move_task and status changes are never refused
--     because of an open blocker (DECISIONS D-026).

create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  blocker_team_id uuid not null,
  blocker_task_id uuid not null,
  blocked_team_id uuid not null,
  blocked_task_id uuid not null,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  removed_by uuid references public.profiles (id),
  removed_at timestamptz,
  unique (org_id, id),
  foreign key (org_id, blocker_team_id) references public.teams (org_id, id),
  foreign key (org_id, blocked_team_id) references public.teams (org_id, id),
  foreign key (blocker_team_id, blocker_task_id) references public.tasks (team_id, id),
  foreign key (blocked_team_id, blocked_task_id) references public.tasks (team_id, id),
  check (blocker_task_id <> blocked_task_id),
  check ((removed_at is null) = (removed_by is null))
);
create unique index task_dependencies_live_pair on public.task_dependencies (blocker_task_id, blocked_task_id)
  where removed_at is null;
create index task_dependencies_blocked_idx on public.task_dependencies (blocked_task_id) where removed_at is null;
create index task_dependencies_blocker_idx on public.task_dependencies (blocker_task_id) where removed_at is null;

-- Dependency history on the task timeline. Data holds the other task's id
-- (a pointer), never its key or title; the reader resolves it under RLS.
alter table public.task_activity drop constraint task_activity_event_check;
alter table public.task_activity add constraint task_activity_event_check check (event in (
  'created', 'status_changed', 'assigned', 'unassigned', 'priority_changed', 'due_changed',
  'blocked', 'unblocked', 'archived', 'restored', 'commented', 'title_changed',
  'project_changed', 'completed', 'reopened', 'linked_to_request',
  'dependency_added', 'dependency_removed'
));

-- ---------------------------------------------------------------------------
-- Integrity: ends are immutable, removal is one-way, cycles are rejected.
-- ---------------------------------------------------------------------------
create function app.task_dependencies_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize every dependency insert in the organization, then check the
  -- graph: two concurrent "A blocks B" / "B blocks A" attempts can't both pass.
  perform pg_advisory_xact_lock(hashtextextended('qmatus.task_dependencies:' || new.org_id::text, 0));

  if exists (
    select 1 from public.task_dependencies d
    where d.blocker_task_id = new.blocker_task_id and d.blocked_task_id = new.blocked_task_id and d.removed_at is null
  ) then
    raise exception 'those tasks are already linked' using errcode = '23505';
  end if;

  -- A cycle exists if the new blocked task already (transitively) blocks the
  -- new blocker. Walk forward from the blocked task along live links.
  if exists (
    with recursive downstream (task_id) as (
      select new.blocked_task_id
      union
      select d.blocked_task_id
      from public.task_dependencies d
      join downstream s on d.blocker_task_id = s.task_id
      where d.removed_at is null
    )
    select 1 from downstream where task_id = new.blocker_task_id
  ) then
    raise exception 'that link would create a dependency loop' using errcode = '23514';
  end if;

  new.created_at := now();
  new.removed_at := null;
  new.removed_by := null;
  return new;
end;
$$;
create trigger task_dependencies_before_insert before insert on public.task_dependencies
  for each row execute function app.task_dependencies_before_insert();

create function app.task_dependencies_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.id <> old.id or new.org_id <> old.org_id
     or new.blocker_team_id <> old.blocker_team_id or new.blocker_task_id <> old.blocker_task_id
     or new.blocked_team_id <> old.blocked_team_id or new.blocked_task_id <> old.blocked_task_id
     or new.created_by <> old.created_by or new.created_at <> old.created_at
     or old.removed_at is not null then
    raise exception 'dependency links are append-only' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger task_dependencies_before_update before update on public.task_dependencies
  for each row execute function app.task_dependencies_before_update();
create trigger task_dependencies_no_delete before delete on public.task_dependencies
  for each row execute function app.forbid_mutation();

create function app.log_dependency(p_link public.task_dependencies, p_event text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.task_activity (team_id, task_id, actor_id, event, data) values
    (p_link.blocked_team_id, p_link.blocked_task_id, auth.uid(), p_event,
     jsonb_build_object('direction', 'blocked_by', 'task', p_link.blocker_task_id)),
    (p_link.blocker_team_id, p_link.blocker_task_id, auth.uid(), p_event,
     jsonb_build_object('direction', 'blocks', 'task', p_link.blocked_task_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Public operations
-- ---------------------------------------------------------------------------

-- Links the task being edited to another task by its issue key.
-- p_direction = 'blocked_by': the other task blocks p_task.
-- p_direction = 'blocks':     p_task blocks the other task.
create function public.add_task_dependency(p_task uuid, p_other_key text, p_direction text)
returns public.task_dependencies
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_uid();
  t public.tasks;
  o public.tasks;
  r public.task_dependencies;
begin
  if p_direction not in ('blocked_by', 'blocks') then
    raise exception 'choose blocked by or blocking' using errcode = '22023';
  end if;

  select * into t from public.tasks where id = p_task;
  if not found or not app.can_read_team(t.team_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if not app.can_write_team(t.team_id) then
    raise exception 'not permitted' using errcode = '42501';
  end if;

  -- Keys are unique per organization. A key in another org, an unknown key and
  -- a task in a team the caller can't read are indistinguishable.
  select * into o from public.tasks
  where org_id = t.org_id and issue_key = upper(btrim(coalesce(p_other_key, '')));
  if not found or not app.can_read_team(o.team_id) then
    raise exception 'no task you can view has that key' using errcode = 'P0002';
  end if;
  if o.id = t.id then
    raise exception 'a task can''t block itself' using errcode = '22023';
  end if;
  if t.archived_at is not null or o.archived_at is not null then
    raise exception 'archived tasks can''t take new links' using errcode = '22023';
  end if;
  if (select count(*) from public.task_dependencies d
      where d.removed_at is null and (d.blocker_task_id = t.id or d.blocked_task_id = t.id)) >= 50 then
    raise exception 'a task can have at most 50 links' using errcode = '22023';
  end if;

  insert into public.task_dependencies (org_id, blocker_team_id, blocker_task_id, blocked_team_id, blocked_task_id, created_by)
  select t.org_id,
         case when p_direction = 'blocked_by' then o.team_id else t.team_id end,
         case when p_direction = 'blocked_by' then o.id else t.id end,
         case when p_direction = 'blocked_by' then t.team_id else o.team_id end,
         case when p_direction = 'blocked_by' then t.id else o.id end,
         v_uid
  returning * into r;
  perform app.log_dependency(r, 'dependency_added');
  return r;
end;
$$;

-- Soft-removes a link. Allowed for anyone who can write either end, so a team
-- can clear a link to a task it can't see (it only sees the generic row).
create function public.remove_task_dependency(p_link uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_uid();
  r public.task_dependencies;
begin
  select * into r from public.task_dependencies where id = p_link for update;
  if not found or not (app.can_read_team(r.blocker_team_id) or app.can_read_team(r.blocked_team_id)) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if not (app.can_write_team(r.blocker_team_id) or app.can_write_team(r.blocked_team_id)) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if r.removed_at is not null then
    return; -- already removed: retries are harmless
  end if;
  update public.task_dependencies set removed_at = now(), removed_by = v_uid where id = r.id
  returning * into r;
  perform app.log_dependency(r, 'dependency_removed');
end;
$$;

-- Live links of one task, from the viewer's point of view. The other end is
-- described only when the viewer can read it; otherwise visible = false and
-- every identifying column is null. `resolved` (other end completed,
-- canceled or archived) is returned for both, so "blocked by 1 open task"
-- works without saying which (DECISIONS D-025).
create function public.get_task_dependencies(p_task uuid)
returns table (
  link_id uuid,
  direction text,
  visible boolean,
  task_id uuid,
  issue_key text,
  title text,
  team_slug text,
  team_name text,
  status_label text,
  status_category public.status_category,
  archived boolean,
  resolved boolean,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare t public.tasks;
begin
  perform app.require_uid();
  select * into t from public.tasks tk where tk.id = p_task;
  if not found or not app.can_read_team(t.team_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  return query
  with links as (
    select d.id, 'blocked_by'::text as dir, d.blocker_task_id as other, d.created_at
    from public.task_dependencies d where d.blocked_task_id = t.id and d.removed_at is null
    union all
    select d.id, 'blocks'::text, d.blocked_task_id, d.created_at
    from public.task_dependencies d where d.blocker_task_id = t.id and d.removed_at is null
  ), resolved as (
    select l.*, o.team_id as o_team, o.issue_key as o_key, o.title as o_title, o.archived_at as o_archived,
           s.label as s_label, s.category as s_category, tm.slug as o_slug, tm.name as o_team_name,
           app.can_read_team(o.team_id) as can_see
    from links l
    join public.tasks o on o.id = l.other
    join public.task_statuses s on s.id = o.status_id
    join public.teams tm on tm.id = o.team_id
  )
  select r.id, r.dir, r.can_see,
         case when r.can_see then r.other end,
         case when r.can_see then r.o_key end,
         case when r.can_see then r.o_title end,
         case when r.can_see then r.o_slug end,
         case when r.can_see then r.o_team_name end,
         case when r.can_see then r.s_label end,
         case when r.can_see then r.s_category end,
         case when r.can_see then r.o_archived is not null end,
         (r.s_category in ('completed', 'canceled') or r.o_archived is not null),
         r.created_at
  from resolved r
  order by r.dir, r.can_see desc, r.created_at;
end;
$$;

-- Open-blocker counts for a set of tasks (board, list, My Work cue). Tasks the
-- caller can't read are skipped. Hidden blockers count, without identity.
create function public.task_blocker_counts(p_tasks uuid[])
returns table (task_id uuid, open_blockers int)
language sql stable security definer set search_path = '' as $$
  select d.blocked_task_id, count(*)::int
  from public.task_dependencies d
  join public.tasks b on b.id = d.blocker_task_id
  join public.task_statuses s on s.id = b.status_id
  where (select auth.uid()) is not null
    and d.blocked_task_id = any ((coalesce(p_tasks, array[]::uuid[]))[1:1000])
    and d.removed_at is null
    and b.archived_at is null
    and s.category not in ('completed', 'canceled')
    and app.can_read_team(d.blocked_team_id)
  group by d.blocked_task_id;
$$;

-- ---------------------------------------------------------------------------
-- RLS and grants: a direct read needs both ends readable; nobody writes directly.
-- ---------------------------------------------------------------------------
alter table public.task_dependencies enable row level security;

create policy task_dependencies_select on public.task_dependencies for select to authenticated
  using (app.can_read_team(blocker_team_id) and app.can_read_team(blocked_team_id));

grant select on public.task_dependencies to authenticated;

grant execute on function
  public.add_task_dependency(uuid, text, text),
  public.remove_task_dependency(uuid),
  public.get_task_dependencies(uuid),
  public.task_blocker_counts(uuid[])
  to authenticated;
