-- QMatus Team Tracker — Parking Lot, Library, scoped search and the
-- allowlisted dashboard-summary aggregate.

create type public.idea_state as enum ('captured', 'reviewing', 'promoted', 'archived');
create type public.library_kind as enum ('doc', 'link', 'image', 'tool');

create table public.parking_ideas (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  creator_id uuid not null references public.profiles (id),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text check (body is null or char_length(body) <= 5000),
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  state public.idea_state not null default 'captured',
  pinned boolean not null default false,
  promoted_task_id uuid,
  promoted_request_id uuid references public.work_requests (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (team_id, id),
  foreign key (org_id, team_id) references public.teams (org_id, id),
  foreign key (team_id, promoted_task_id) references public.tasks (team_id, id)
);
create index parking_ideas_team_idx on public.parking_ideas (team_id, state, updated_at desc);

create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  owner_id uuid not null references public.profiles (id),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  kind public.library_kind not null default 'link',
  -- Links only in V1 (no uploads, no server-side fetching). http(s) only.
  url text not null check (char_length(url) <= 2000 and url ~ '^https?://[^\s<>"]+$'),
  description text check (description is null or char_length(description) <= 1000),
  tags text[] not null default '{}' check (cardinality(tags) <= 8),
  project_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (org_id, team_id) references public.teams (org_id, id),
  foreign key (team_id, project_id) references public.projects (team_id, id)
);
create index library_items_team_idx on public.library_items (team_id, updated_at desc) where archived_at is null;

create function app.team_owned_before_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    select org_id into new.org_id from public.teams where id = new.team_id;
    if tg_table_name = 'parking_ideas' then
      new.creator_id := auth.uid();
    else
      new.owner_id := auth.uid();
    end if;
    new.created_at := now();
  elsif new.team_id <> old.team_id or new.org_id <> old.org_id then
    raise exception 'immutable field changed' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger parking_ideas_before_write before insert or update on public.parking_ideas
  for each row execute function app.team_owned_before_write();
create trigger library_items_before_write before insert or update on public.library_items
  for each row execute function app.team_owned_before_write();

alter table public.parking_ideas enable row level security;
alter table public.library_items enable row level security;

create policy ideas_select on public.parking_ideas for select to authenticated using (app.can_read_team(team_id));
create policy ideas_insert on public.parking_ideas for insert to authenticated with check (app.can_write_team(team_id));
create policy ideas_update on public.parking_ideas for update to authenticated
  using (app.can_write_team(team_id)) with check (app.can_write_team(team_id));

create policy library_select on public.library_items for select to authenticated using (app.can_read_team(team_id));
create policy library_insert on public.library_items for insert to authenticated with check (app.can_write_team(team_id));
create policy library_update on public.library_items for update to authenticated
  using (app.can_write_team(team_id)) with check (app.can_write_team(team_id));

grant select on public.parking_ideas, public.library_items to authenticated;
grant insert (team_id, title, body, tags, pinned) on public.parking_ideas to authenticated;
grant update (title, body, tags, state, pinned) on public.parking_ideas to authenticated;
grant insert (team_id, title, kind, url, description, tags, project_id) on public.library_items to authenticated;
grant update (title, kind, url, description, tags, project_id, archived_at) on public.library_items to authenticated;

-- Same-team promotion: create the task and link the idea in one transaction.
-- SECURITY INVOKER: the caller's own RLS rights decide whether this is allowed.
create function public.promote_idea_to_task(p_idea uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare i public.parking_ideas; v_task uuid;
begin
  perform app.require_uid();
  select * into i from public.parking_ideas where id = p_idea for update;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if i.state = 'promoted' then
    raise exception 'this idea was already promoted' using errcode = '40001';
  end if;
  insert into public.tasks (team_id, title, description)
  values (i.team_id, i.title, i.body)
  returning id into v_task;
  update public.parking_ideas set state = 'promoted' where id = p_idea;
  perform app.mark_idea_promoted(p_idea, v_task, null);
  return v_task;
end;
$$;

-- promoted_* columns are not client-writable; this narrow helper sets them.
create function app.mark_idea_promoted(p_idea uuid, p_task uuid, p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.can_write_team((select team_id from public.parking_ideas where id = p_idea)) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if p_request is not null and not exists (
    select 1 from public.work_requests where id = p_request and submitter_id = auth.uid()
  ) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  update public.parking_ideas
  set promoted_task_id = coalesce(p_task, promoted_task_id),
      promoted_request_id = coalesce(p_request, promoted_request_id),
      state = 'promoted'
  where id = p_idea;
end;
$$;
grant execute on function app.mark_idea_promoted(uuid, uuid, uuid) to authenticated;
grant execute on function public.promote_idea_to_task(uuid) to authenticated;

-- Cross-team promotion: the caller has already submitted a Work Request with
-- the content they chose to share; this only records the link on the idea.
create function public.link_idea_to_request(p_idea uuid, p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.require_uid();
  perform app.mark_idea_promoted(p_idea, null, p_request);
end;
$$;
grant execute on function public.link_idea_to_request(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Search: SECURITY INVOKER, so every branch is filtered by the caller's RLS.
-- ---------------------------------------------------------------------------
create function public.search_workspace(p_query text, p_limit int default 20)
returns table (kind text, id uuid, title text, ref text, team_slug text, team_name text)
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_q text := btrim(coalesce(p_query, ''));
  v_pattern text;
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if char_length(v_q) < 2 or char_length(v_q) > 100 then
    return;
  end if;
  v_pattern := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  (select 'task'::text, t.id, t.title, t.issue_key, tm.slug, tm.name
   from public.tasks t join public.teams tm on tm.id = t.team_id
   where t.archived_at is null and (t.title ilike v_pattern or t.issue_key ilike v_pattern)
   order by t.updated_at desc limit v_limit)
  union all
  (select 'project'::text, p.id, p.name, null::text, tm.slug, tm.name
   from public.projects p join public.teams tm on tm.id = p.team_id
   where p.archived_at is null and p.name ilike v_pattern
   order by p.updated_at desc limit v_limit)
  union all
  (select 'request'::text, r.id, r.title, 'REQ-' || r.number, null::text, null::text
   from public.work_requests r
   where r.title ilike v_pattern or ('REQ-' || r.number) ilike v_pattern
   order by r.updated_at desc limit v_limit)
  union all
  (select 'idea'::text, i.id, i.title, null::text, tm.slug, tm.name
   from public.parking_ideas i join public.teams tm on tm.id = i.team_id
   where i.state <> 'archived' and i.title ilike v_pattern
   order by i.updated_at desc limit v_limit)
  union all
  (select 'library'::text, l.id, l.title, null::text, tm.slug, tm.name
   from public.library_items l join public.teams tm on tm.id = l.team_id
   where l.archived_at is null and (l.title ilike v_pattern or coalesce(l.description, '') ilike v_pattern)
   order by l.updated_at desc limit v_limit);
end;
$$;
grant execute on function public.search_workspace(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard summary (spec §7.4). Allowlisted aggregates only. Summary-grant
-- viewers get small counts suppressed (< 3 reported as null).
-- ---------------------------------------------------------------------------
create function public.team_dashboard_summary(p_team uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_full boolean := app.can_read_team(p_team);
  v_result jsonb;
begin
  if not (v_full or app.has_team_grant(p_team, array['dashboard_summary']::public.grant_scope[])) then
    return null;
  end if;

  select jsonb_build_object(
    'backlog', count(*) filter (where s.category in ('backlog', 'unstarted')),
    'in_progress', count(*) filter (where s.key = 'in_progress'),
    'in_review', count(*) filter (where s.key = 'in_review'),
    'blocked', count(*) filter (where t.blocked and s.category not in ('completed', 'canceled')),
    'overdue', count(*) filter (where t.due_date < current_date and s.category not in ('completed', 'canceled')),
    'completed_14d', count(*) filter (where t.completed_at >= now() - interval '14 days')
  ) into v_result
  from public.tasks t join public.task_statuses s on s.id = t.status_id
  where t.team_id = p_team and t.archived_at is null;

  if not v_full then
    select jsonb_object_agg(key, case when (value)::int < 3 then null else value end)
    into v_result from jsonb_each(v_result);
  end if;
  return v_result || jsonb_build_object('full_access', v_full);
end;
$$;
grant execute on function public.team_dashboard_summary(uuid) to authenticated;
