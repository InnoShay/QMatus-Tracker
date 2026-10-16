-- QMatus Team Tracker — work execution: workflow statuses, projects, milestones,
-- tasks, labels, checklists, comments, activity and in-app notifications.
--
-- Every team-owned row carries team_id, and every relationship between
-- team-owned rows is a composite foreign key that includes team_id, so a task
-- can never point at another team's project, milestone, parent or label.

create type public.status_category as enum ('backlog', 'unstarted', 'started', 'completed', 'canceled');
create type public.task_type as enum ('task', 'bug', 'feature', 'chore', 'research', 'documentation');
create type public.task_priority as enum ('none', 'low', 'medium', 'high', 'urgent');
create type public.project_status as enum ('planned', 'active', 'paused', 'completed');
create type public.project_health as enum ('on_track', 'at_risk', 'off_track');

-- ---------------------------------------------------------------------------
-- Workflow
-- ---------------------------------------------------------------------------
create table public.task_statuses (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id),
  key text not null check (key ~ '^[a-z_]{2,24}$'),
  label text not null check (char_length(label) between 1 and 32),
  category public.status_category not null,
  position int not null,
  unique (team_id, id),
  unique (team_id, key),
  unique (team_id, position)
);

create table public.task_status_transitions (
  team_id uuid not null,
  from_status uuid not null,
  to_status uuid not null,
  primary key (team_id, from_status, to_status),
  foreign key (team_id, from_status) references public.task_statuses (team_id, id),
  foreign key (team_id, to_status) references public.task_statuses (team_id, id),
  check (from_status <> to_status)
);

-- Default workflow (spec §7.6): Backlog → Ready → In Progress → In Review → Done,
-- Canceled as a terminal alternative. Done can only be reached from started work.
create function app.seed_team_workflow() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  s record;
  ids jsonb := '{}'::jsonb;
  pair text[];
  pairs text[][] := array[
    ['backlog','ready'], ['backlog','in_progress'], ['backlog','canceled'],
    ['ready','backlog'], ['ready','in_progress'], ['ready','canceled'],
    ['in_progress','backlog'], ['in_progress','ready'], ['in_progress','in_review'],
    ['in_progress','done'], ['in_progress','canceled'],
    ['in_review','in_progress'], ['in_review','done'], ['in_review','ready'], ['in_review','canceled'],
    ['done','in_progress'], ['done','in_review'], ['done','ready'], ['done','backlog'],
    ['canceled','backlog'], ['canceled','ready']
  ];
begin
  for s in
    select * from (values
      ('backlog', 'Backlog', 'backlog'::public.status_category, 1),
      ('ready', 'Ready', 'unstarted'::public.status_category, 2),
      ('in_progress', 'In Progress', 'started'::public.status_category, 3),
      ('in_review', 'In Review', 'started'::public.status_category, 4),
      ('done', 'Done', 'completed'::public.status_category, 5),
      ('canceled', 'Canceled', 'canceled'::public.status_category, 6)
    ) as v(key, label, category, position)
  loop
    with ins as (
      insert into public.task_statuses (team_id, key, label, category, position)
      values (new.id, s.key, s.label, s.category, s.position)
      returning id
    )
    select ids || jsonb_build_object(s.key, ins.id) into ids from ins;
  end loop;

  foreach pair slice 1 in array pairs loop
    insert into public.task_status_transitions (team_id, from_status, to_status)
    values (new.id, (ids ->> pair[1])::uuid, (ids ->> pair[2])::uuid);
  end loop;

  insert into public.team_issue_counters (team_id) values (new.id);
  return new;
end;
$$;
create trigger teams_seed_workflow after insert on public.teams
  for each row execute function app.seed_team_workflow();

-- ---------------------------------------------------------------------------
-- Projects and milestones
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  purpose text check (purpose is null or char_length(purpose) <= 2000),
  lead_id uuid,
  status public.project_status not null default 'planned',
  health public.project_health,
  start_date date,
  target_date date,
  latest_update text check (latest_update is null or char_length(latest_update) <= 2000),
  latest_update_at timestamptz,
  latest_update_by uuid references public.profiles (id),
  archived_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, id),
  foreign key (org_id, team_id) references public.teams (org_id, id),
  foreign key (team_id, lead_id) references public.team_memberships (team_id, profile_id),
  check (target_date is null or start_date is null or target_date >= start_date)
);
create index projects_team_idx on public.projects (team_id) where archived_at is null;

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  project_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  completion_criterion text check (completion_criterion is null or char_length(completion_criterion) <= 500),
  due_date date,
  owner_id uuid,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (team_id, id),
  unique (team_id, project_id, id),
  foreign key (team_id, project_id) references public.projects (team_id, id),
  foreign key (team_id, owner_id) references public.team_memberships (team_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  number int not null,
  issue_key text not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (description is null or char_length(description) <= 20000),
  type public.task_type not null default 'task',
  status_id uuid not null,
  priority public.task_priority not null default 'none',
  assignee_id uuid,
  reviewer_id uuid,
  creator_id uuid not null references public.profiles (id),
  project_id uuid,
  milestone_id uuid,
  parent_id uuid,
  start_date date,
  due_date date,
  estimate_points smallint check (estimate_points is null or estimate_points between 0 and 100),
  blocked boolean not null default false,
  blocked_reason text check (blocked_reason is null or char_length(blocked_reason) <= 500),
  rank numeric not null,
  completed_at timestamptz,
  archived_at timestamptz,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, id),
  unique (team_id, number),
  unique (org_id, issue_key),
  foreign key (org_id, team_id) references public.teams (org_id, id),
  foreign key (team_id, status_id) references public.task_statuses (team_id, id),
  foreign key (team_id, assignee_id) references public.team_memberships (team_id, profile_id),
  foreign key (team_id, reviewer_id) references public.team_memberships (team_id, profile_id),
  foreign key (team_id, project_id) references public.projects (team_id, id),
  foreign key (team_id, project_id, milestone_id) references public.milestones (team_id, project_id, id),
  foreign key (team_id, parent_id) references public.tasks (team_id, id),
  check (milestone_id is null or project_id is not null),
  check (parent_id is null or parent_id <> id),
  check (not blocked or char_length(btrim(coalesce(blocked_reason, ''))) > 0),
  check (due_date is null or start_date is null or due_date >= start_date)
);
create index tasks_board_idx on public.tasks (team_id, status_id, rank) where archived_at is null;
create index tasks_assignee_idx on public.tasks (assignee_id) where archived_at is null;
create index tasks_project_idx on public.tasks (project_id) where project_id is not null;
create index tasks_parent_idx on public.tasks (parent_id) where parent_id is not null;
create index tasks_due_idx on public.tasks (team_id, due_date) where archived_at is null and completed_at is null;

create table public.task_labels (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id),
  name text not null check (char_length(btrim(name)) between 1 and 32),
  unique (team_id, id),
  unique (team_id, name)
);

create table public.task_label_links (
  team_id uuid not null,
  task_id uuid not null,
  label_id uuid not null,
  primary key (task_id, label_id),
  foreign key (team_id, task_id) references public.tasks (team_id, id) on delete cascade,
  foreign key (team_id, label_id) references public.task_labels (team_id, id) on delete cascade
);

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  task_id uuid not null,
  body text not null check (char_length(btrim(body)) between 1 and 300),
  position int not null default 0,
  done boolean not null default false,
  done_by uuid references public.profiles (id),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (team_id, task_id) references public.tasks (team_id, id) on delete cascade
);
create index task_checklist_task_idx on public.task_checklist_items (task_id, position);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  task_id uuid not null,
  author_id uuid not null references public.profiles (id),
  body text not null check (char_length(body) <= 10000),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (team_id, task_id) references public.tasks (team_id, id),
  check (deleted_at is not null or char_length(btrim(body)) > 0)
);
create index task_comments_task_idx on public.task_comments (task_id, created_at);

-- Append-oriented business history. Rows are written only by triggers.
create table public.task_activity (
  id bigint generated always as identity primary key,
  team_id uuid not null,
  task_id uuid not null,
  actor_id uuid references public.profiles (id),
  event text not null check (event in (
    'created', 'status_changed', 'assigned', 'unassigned', 'priority_changed', 'due_changed',
    'blocked', 'unblocked', 'archived', 'restored', 'commented', 'title_changed',
    'project_changed', 'completed', 'reopened', 'linked_to_request'
  )),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 1000),
  created_at timestamptz not null default now(),
  foreign key (team_id, task_id) references public.tasks (team_id, id)
);
create index task_activity_task_idx on public.task_activity (task_id, created_at);
create trigger task_activity_immutable before update or delete on public.task_activity
  for each row execute function app.forbid_mutation();

-- Notifications are pointers, not content. Titles are resolved at read time
-- through RLS, so revoked access never leaks through a stored notification.
create table public.notifications (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id),
  recipient_id uuid not null references public.profiles (id),
  actor_id uuid references public.profiles (id),
  kind text not null check (kind in (
    'task_assigned', 'task_commented', 'review_requested', 'request_submitted', 'request_status', 'request_message',
    'request_update', 'grant_pending', 'grant_decided', 'grant_revoked'
  )),
  resource_type text not null check (resource_type in ('task', 'request', 'grant')),
  resource_id uuid not null,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_id, dedupe_key)
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

create function app.notify(
  p_org uuid, p_recipient uuid, p_kind text, p_resource_type text, p_resource uuid, p_dedupe text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_recipient is null or p_recipient = auth.uid() then
    return;
  end if;
  insert into public.notifications (org_id, recipient_id, actor_id, kind, resource_type, resource_id, dedupe_key)
  values (p_org, p_recipient, auth.uid(), p_kind, p_resource_type, p_resource, p_dedupe)
  on conflict (recipient_id, dedupe_key) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Task integrity triggers
-- ---------------------------------------------------------------------------
create function app.assert_assignable(p_team uuid, p_profile uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_profile is null then
    return;
  end if;
  if not exists (
    select 1 from public.team_memberships tm
    join public.organization_memberships om on om.org_id = tm.org_id and om.profile_id = tm.profile_id
    where tm.team_id = p_team and tm.profile_id = p_profile and tm.active and om.state = 'active'
  ) then
    raise exception 'assignee must be an active member of this team' using errcode = '23514';
  end if;
end;
$$;

create function app.tasks_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_prefix text;
  v_number int;
  v_category public.status_category;
begin
  -- Ownership is derived, never trusted from the client.
  select org_id, issue_prefix into new.org_id, v_prefix from public.teams where id = new.team_id;
  if v_prefix is null then
    raise exception 'team not found' using errcode = 'P0002';
  end if;

  update public.team_issue_counters set next_number = next_number + 1
  where team_id = new.team_id
  returning next_number - 1 into v_number;
  new.number := v_number;
  new.issue_key := v_prefix || '-' || v_number;

  if auth.uid() is not null then
    new.creator_id := auth.uid();
  end if;

  if new.status_id is null then
    select id into new.status_id from public.task_statuses where team_id = new.team_id order by position limit 1;
  end if;
  select category into v_category from public.task_statuses where id = new.status_id and team_id = new.team_id;

  perform app.assert_assignable(new.team_id, new.assignee_id);
  perform app.assert_assignable(new.team_id, new.reviewer_id);

  if new.parent_id is not null and exists (
    select 1 from public.tasks where id = new.parent_id and parent_id is not null
  ) then
    raise exception 'subtasks can only be one level deep' using errcode = '23514';
  end if;

  select coalesce(max(rank), 0) + 1024 into new.rank
  from public.tasks where team_id = new.team_id and status_id = new.status_id;

  new.completed_at := case when v_category = 'completed' then now() else null end;
  new.archived_at := null;
  new.version := 1;
  new.created_at := now();
  new.updated_at := now();
  if not new.blocked then
    new.blocked_reason := null;
  end if;
  return new;
end;
$$;
create trigger tasks_before_insert before insert on public.tasks
  for each row execute function app.tasks_before_insert();

create function app.tasks_before_update() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_from public.status_category;
  v_to public.status_category;
begin
  if new.id <> old.id or new.org_id <> old.org_id or new.team_id <> old.team_id
     or new.number <> old.number or new.issue_key <> old.issue_key
     or new.creator_id <> old.creator_id or new.created_at <> old.created_at then
    raise exception 'immutable task field changed' using errcode = '42501';
  end if;

  if new.status_id <> old.status_id then
    if not exists (
      select 1 from public.task_status_transitions
      where team_id = new.team_id and from_status = old.status_id and to_status = new.status_id
    ) then
      raise exception 'that status change is not allowed' using errcode = '23514';
    end if;
    select category into v_from from public.task_statuses where id = old.status_id;
    select category into v_to from public.task_statuses where id = new.status_id;
    if v_to = 'completed' and v_from <> 'completed' then
      new.completed_at := now();
    elsif v_to <> 'completed' then
      new.completed_at := null;
    end if;
  else
    new.completed_at := old.completed_at;
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    perform app.assert_assignable(new.team_id, new.assignee_id);
  end if;
  if new.reviewer_id is distinct from old.reviewer_id then
    perform app.assert_assignable(new.team_id, new.reviewer_id);
  end if;

  if new.parent_id is distinct from old.parent_id and new.parent_id is not null then
    if exists (select 1 from public.tasks where id = new.parent_id and parent_id is not null)
       or exists (select 1 from public.tasks where parent_id = new.id) then
      raise exception 'subtasks can only be one level deep' using errcode = '23514';
    end if;
  end if;

  if not new.blocked then
    new.blocked_reason := null;
  end if;

  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
create trigger tasks_before_update before update on public.tasks
  for each row execute function app.tasks_before_update();

create function app.tasks_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_from text;
  v_to text;
  v_to_cat public.status_category;
  v_from_cat public.status_category;
begin
  if tg_op = 'INSERT' then
    insert into public.task_activity (team_id, task_id, actor_id, event) values (new.team_id, new.id, v_uid, 'created');
    if new.assignee_id is not null then
      perform app.notify(new.org_id, new.assignee_id, 'task_assigned', 'task', new.id);
    end if;
    return new;
  end if;

  if new.status_id <> old.status_id then
    select label, category into v_from, v_from_cat from public.task_statuses where id = old.status_id;
    select label, category into v_to, v_to_cat from public.task_statuses where id = new.status_id;
    insert into public.task_activity (team_id, task_id, actor_id, event, data)
    values (new.team_id, new.id, v_uid,
      case when v_to_cat = 'completed' and v_from_cat <> 'completed' then 'completed'
           when v_from_cat = 'completed' and v_to_cat <> 'completed' then 'reopened'
           else 'status_changed' end,
      jsonb_build_object('from', v_from, 'to', v_to));
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.task_activity (team_id, task_id, actor_id, event, data)
    values (new.team_id, new.id, v_uid,
      case when new.assignee_id is null then 'unassigned' else 'assigned' end,
      jsonb_build_object('from', old.assignee_id, 'to', new.assignee_id));
    perform app.notify(new.org_id, new.assignee_id, 'task_assigned', 'task', new.id);
  end if;

  if new.reviewer_id is distinct from old.reviewer_id and new.reviewer_id is not null then
    perform app.notify(new.org_id, new.reviewer_id, 'review_requested', 'task', new.id);
  end if;

  if new.priority <> old.priority then
    insert into public.task_activity (team_id, task_id, actor_id, event, data)
    values (new.team_id, new.id, v_uid, 'priority_changed', jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;
  if new.due_date is distinct from old.due_date then
    insert into public.task_activity (team_id, task_id, actor_id, event, data)
    values (new.team_id, new.id, v_uid, 'due_changed', jsonb_build_object('from', old.due_date, 'to', new.due_date));
  end if;
  if new.blocked <> old.blocked then
    insert into public.task_activity (team_id, task_id, actor_id, event)
    values (new.team_id, new.id, v_uid, case when new.blocked then 'blocked' else 'unblocked' end);
  end if;
  if new.title <> old.title then
    insert into public.task_activity (team_id, task_id, actor_id, event) values (new.team_id, new.id, v_uid, 'title_changed');
  end if;
  if new.project_id is distinct from old.project_id then
    insert into public.task_activity (team_id, task_id, actor_id, event) values (new.team_id, new.id, v_uid, 'project_changed');
  end if;
  if new.archived_at is distinct from old.archived_at then
    insert into public.task_activity (team_id, task_id, actor_id, event)
    values (new.team_id, new.id, v_uid, case when new.archived_at is null then 'restored' else 'archived' end);
  end if;
  return new;
end;
$$;
create trigger tasks_after_write after insert or update on public.tasks
  for each row execute function app.tasks_after_write();

-- Board move: status and rank in one validated, version-checked operation.
-- Rank is computed server-side between the given neighbours; the client never
-- writes rank directly.
create function public.move_task(
  p_task uuid, p_status uuid, p_expected_version int, p_after uuid default null, p_before uuid default null
) returns table (id uuid, status_id uuid, rank numeric, version int)
language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks;
  v_lo numeric;
  v_hi numeric;
  v_rank numeric;
begin
  perform app.require_uid();
  select * into t from public.tasks where tasks.id = p_task for update;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if not app.can_write_team(t.team_id) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if t.version <> p_expected_version then
    raise exception 'this task changed since you loaded it' using errcode = '40001';
  end if;

  if p_after is not null then
    select tk.rank into v_lo from public.tasks tk
    where tk.id = p_after and tk.team_id = t.team_id and tk.status_id = p_status;
  end if;
  if p_before is not null then
    select tk.rank into v_hi from public.tasks tk
    where tk.id = p_before and tk.team_id = t.team_id and tk.status_id = p_status;
  end if;

  if v_lo is null and v_hi is null then
    select coalesce(max(tk.rank), 0) + 1024 into v_rank from public.tasks tk
    where tk.team_id = t.team_id and tk.status_id = p_status and tk.id <> t.id;
  elsif v_lo is null then
    v_rank := v_hi - 1024;
  elsif v_hi is null then
    v_rank := v_lo + 1024;
  else
    if v_hi <= v_lo then
      raise exception 'board order changed; refresh and try again' using errcode = '40001';
    end if;
    v_rank := (v_lo + v_hi) / 2;
  end if;

  update public.tasks tk set status_id = p_status, rank = v_rank where tk.id = t.id;

  return query select tk.id, tk.status_id, tk.rank, tk.version from public.tasks tk where tk.id = t.id;
end;
$$;
grant execute on function public.move_task(uuid, uuid, int, uuid, uuid) to authenticated;

-- Comments
create function app.comments_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
    new.created_at := now();
    new.edited_at := null;
    new.deleted_at := null;
    select team_id into new.team_id from public.tasks where id = new.task_id;
    return new;
  end if;
  if new.task_id <> old.task_id or new.author_id <> old.author_id or new.team_id <> old.team_id
     or new.created_at <> old.created_at then
    raise exception 'immutable comment field changed' using errcode = '42501';
  end if;
  if old.deleted_at is not null then
    raise exception 'comment was deleted' using errcode = '22023';
  end if;
  if new.deleted_at is not null then
    new.deleted_at := now();
    new.body := '';
  elsif new.body <> old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;
create trigger task_comments_before_write before insert or update on public.task_comments
  for each row execute function app.comments_before_write();

create function app.comments_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = new.task_id;
  insert into public.task_activity (team_id, task_id, actor_id, event) values (new.team_id, new.task_id, new.author_id, 'commented');
  perform app.notify(t.org_id, t.assignee_id, 'task_commented', 'task', t.id);
  if t.creator_id is distinct from t.assignee_id then
    perform app.notify(t.org_id, t.creator_id, 'task_commented', 'task', t.id);
  end if;
  return new;
end;
$$;
create trigger task_comments_after_insert after insert on public.task_comments
  for each row execute function app.comments_after_insert();

create function app.checklist_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    select team_id into new.team_id from public.tasks where id = new.task_id;
  elsif new.task_id <> old.task_id or new.team_id <> old.team_id then
    raise exception 'immutable checklist field changed' using errcode = '42501';
  end if;
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.done_by := auth.uid();
    new.done_at := now();
  elsif not new.done then
    new.done_by := null;
    new.done_at := null;
  end if;
  return new;
end;
$$;
create trigger task_checklist_before_write before insert or update on public.task_checklist_items
  for each row execute function app.checklist_before_write();

create function app.projects_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    select org_id into new.org_id from public.teams where id = new.team_id;
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
  elsif new.team_id <> old.team_id or new.org_id <> old.org_id or new.created_by <> old.created_by then
    raise exception 'immutable project field changed' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' or new.latest_update is distinct from old.latest_update then
    if new.latest_update is not null then
      new.latest_update_at := now();
      new.latest_update_by := auth.uid();
    end if;
  end if;
  perform app.assert_assignable(new.team_id, new.lead_id);
  new.updated_at := now();
  return new;
end;
$$;
create trigger projects_before_write before insert or update on public.projects
  for each row execute function app.projects_before_write();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.task_statuses enable row level security;
alter table public.task_status_transitions enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.task_labels enable row level security;
alter table public.task_label_links enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_activity enable row level security;
alter table public.notifications enable row level security;

create policy statuses_select on public.task_statuses for select to authenticated using (app.can_read_team(team_id));
create policy transitions_select on public.task_status_transitions for select to authenticated using (app.can_read_team(team_id));

create policy projects_select on public.projects for select to authenticated using (app.can_read_team(team_id));
create policy projects_insert on public.projects for insert to authenticated with check (app.can_write_team(team_id));
create policy projects_update on public.projects for update to authenticated
  using (app.can_write_team(team_id)) with check (app.can_write_team(team_id));

create policy milestones_select on public.milestones for select to authenticated using (app.can_read_team(team_id));
create policy milestones_insert on public.milestones for insert to authenticated with check (app.can_write_team(team_id));
create policy milestones_update on public.milestones for update to authenticated
  using (app.can_write_team(team_id)) with check (app.can_write_team(team_id));

create policy tasks_select on public.tasks for select to authenticated using (app.can_read_team(team_id));
create policy tasks_insert on public.tasks for insert to authenticated with check (app.can_write_team(team_id));
create policy tasks_update on public.tasks for update to authenticated
  using (app.can_write_team(team_id)) with check (app.can_write_team(team_id));

create policy labels_select on public.task_labels for select to authenticated using (app.can_read_team(team_id));
create policy labels_insert on public.task_labels for insert to authenticated with check (app.can_write_team(team_id));

create policy label_links_select on public.task_label_links for select to authenticated using (app.can_read_team(team_id));
create policy label_links_insert on public.task_label_links for insert to authenticated with check (app.can_write_team(team_id));
create policy label_links_delete on public.task_label_links for delete to authenticated using (app.can_write_team(team_id));

create policy checklist_select on public.task_checklist_items for select to authenticated using (app.can_read_team(team_id));
create policy checklist_insert on public.task_checklist_items for insert to authenticated
  with check (app.can_write_team((select t.team_id from public.tasks t where t.id = task_id)));
create policy checklist_update on public.task_checklist_items for update to authenticated
  using (app.can_write_team(team_id)) with check (app.can_write_team(team_id));
create policy checklist_delete on public.task_checklist_items for delete to authenticated using (app.can_write_team(team_id));

create policy comments_select on public.task_comments for select to authenticated using (app.can_read_team(team_id));
create policy comments_insert on public.task_comments for insert to authenticated
  with check (app.can_comment_team((select t.team_id from public.tasks t where t.id = task_id)));
create policy comments_update_own on public.task_comments for update to authenticated
  using (author_id = (select auth.uid()) and app.can_comment_team(team_id))
  with check (author_id = (select auth.uid()) and app.can_comment_team(team_id));

create policy activity_select on public.task_activity for select to authenticated using (app.can_read_team(team_id));

create policy notifications_select on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

grant select on public.task_statuses, public.task_status_transitions, public.projects, public.milestones,
  public.tasks, public.task_labels, public.task_label_links, public.task_checklist_items,
  public.task_comments, public.task_activity, public.notifications to authenticated;

grant insert (team_id, name, purpose, lead_id, status, health, start_date, target_date, latest_update)
  on public.projects to authenticated;
grant update (name, purpose, lead_id, status, health, start_date, target_date, latest_update, archived_at)
  on public.projects to authenticated;

grant insert (team_id, project_id, name, completion_criterion, due_date, owner_id, position)
  on public.milestones to authenticated;
grant update (name, completion_criterion, due_date, owner_id, done, position) on public.milestones to authenticated;

grant insert (team_id, title, description, type, status_id, priority, assignee_id, reviewer_id, project_id,
  milestone_id, parent_id, start_date, due_date, estimate_points, blocked, blocked_reason)
  on public.tasks to authenticated;
-- status_id is writable only through the transition-checked trigger; rank only via move_task.
grant update (title, description, type, status_id, priority, assignee_id, reviewer_id, project_id, milestone_id,
  parent_id, start_date, due_date, estimate_points, blocked, blocked_reason, archived_at)
  on public.tasks to authenticated;

grant insert (team_id, name) on public.task_labels to authenticated;
grant insert, delete on public.task_label_links to authenticated;
grant insert (task_id, body, position, done) on public.task_checklist_items to authenticated;
grant update (body, position, done) on public.task_checklist_items to authenticated;
grant delete on public.task_checklist_items to authenticated;
grant insert (task_id, body) on public.task_comments to authenticated;
grant update (body, deleted_at) on public.task_comments to authenticated;
grant update (read_at) on public.notifications to authenticated;
