-- QMatus Team Tracker — foundation: identity, organization, teams, invitations,
-- access grants, audit events and the central authorization helpers.
--
-- Security model (see docs/SECURITY_MODEL.md):
--   * Every exposed table has RLS enabled and explicit, least-privilege SQL grants.
--   * Org/team ownership is enforced with composite foreign keys.
--   * Admin/owner roles never imply private-team content access.
--   * Privileged state changes (memberships, grants, invitations) go through
--     SECURITY DEFINER functions that authorize the caller explicitly and write
--     an append-only audit event in the same transaction.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, anon;

-- Nothing is reachable by default; every grant below is deliberate.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, public;
alter default privileges for role postgres in schema app revoke execute on functions from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.org_role as enum ('owner', 'admin', 'member');
create type public.member_state as enum ('active', 'suspended');
create type public.team_role as enum ('lead', 'member');
-- 'management' grants are deferred (DECISIONS.md D-007); not representable in V1.
create type public.grant_scope as enum ('dashboard_summary', 'workspace_read', 'collaboration', 'edit');
create type public.grant_status as enum ('pending', 'active', 'rejected', 'revoked');
create type public.theme_pref as enum ('system', 'light', 'dark');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  email text not null check (char_length(email) <= 254),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://[^\s]+$'),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  title text check (title is null or char_length(title) <= 80),
  -- L0–L5 is descriptive metadata only. It is never read by any policy.
  level text check (level is null or level in ('L0', 'L1', 'L2', 'L3', 'L4', 'L5')),
  theme public.theme_pref not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  org_id uuid not null references public.organizations (id),
  profile_id uuid not null references public.profiles (id),
  role public.org_role not null default 'member',
  state public.member_state not null default 'active',
  -- Requester capability: may submit Work Requests into other teams' intake.
  can_request boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, profile_id)
);
create index organization_memberships_profile_idx on public.organization_memberships (profile_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  slug text not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  issue_prefix text not null check (issue_prefix ~ '^[A-Z]{2,6}$'),
  description text check (description is null or char_length(description) <= 280),
  accepts_requests boolean not null default false,
  wip_limit_in_progress int check (wip_limit_in_progress is null or wip_limit_in_progress between 1 and 99),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, slug),
  unique (org_id, issue_prefix)
);

-- Kept out of `teams` so that reading a team row never reveals its task volume.
create table public.team_issue_counters (
  team_id uuid primary key references public.teams (id),
  next_number int not null default 1 check (next_number > 0)
);

create table public.team_memberships (
  org_id uuid not null,
  team_id uuid not null,
  profile_id uuid not null references public.profiles (id),
  role public.team_role not null default 'member',
  active boolean not null default true,
  added_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (team_id, profile_id),
  foreign key (org_id, team_id) references public.teams (org_id, id),
  foreign key (org_id, profile_id) references public.organization_memberships (org_id, profile_id),
  check (active or removed_at is not null)
);
create index team_memberships_profile_idx on public.team_memberships (profile_id) where active;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  org_role public.org_role not null default 'member' check (org_role <> 'owner'),
  team_id uuid,
  team_role public.team_role,
  -- SHA-256 of a 256-bit random token; the raw token is never stored.
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  invited_by uuid not null references public.profiles (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  foreign key (org_id, team_id) references public.teams (org_id, id),
  check ((team_id is null) = (team_role is null)),
  check (expires_at > created_at),
  check (not (accepted_at is not null and revoked_at is not null))
);
create unique index invitations_one_pending_per_email
  on public.invitations (org_id, email) where accepted_at is null and revoked_at is null;

create table public.team_access_grants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  team_id uuid not null,
  grantee_id uuid not null,
  issuer_id uuid not null,
  scope public.grant_scope not null,
  reason text not null check (char_length(btrim(reason)) between 10 and 500),
  expires_at timestamptz,
  status public.grant_status not null,
  approver_id uuid references public.profiles (id),
  decided_at timestamptz,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  revoked_by uuid references public.profiles (id),
  revoked_at timestamptz,
  revoke_reason text check (revoke_reason is null or char_length(revoke_reason) <= 500),
  created_at timestamptz not null default now(),
  foreign key (org_id, team_id) references public.teams (org_id, id),
  foreign key (org_id, grantee_id) references public.organization_memberships (org_id, profile_id),
  foreign key (org_id, issuer_id) references public.organization_memberships (org_id, profile_id),
  -- No self-grants, no self-approval, issuer cannot be their own second approver.
  check (grantee_id <> issuer_id),
  check (approver_id is null or (approver_id <> grantee_id and approver_id <> issuer_id)),
  check (expires_at is null or expires_at > created_at),
  check ((status = 'revoked') = (revoked_at is not null))
);
create index team_access_grants_grantee_idx on public.team_access_grants (grantee_id, team_id) where status = 'active';
create index team_access_grants_team_idx on public.team_access_grants (team_id, status);

create table public.audit_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id),
  actor_id uuid references public.profiles (id),
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  team_id uuid references public.teams (id),
  target_type text check (target_type is null or target_type ~ '^[a-z_]+$'),
  target_id uuid,
  -- Allowlisted, non-sensitive metadata only. Never bodies, tokens or secrets.
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 2000),
  correlation_id uuid,
  created_at timestamptz not null default now()
);
create index audit_events_org_time_idx on public.audit_events (org_id, created_at desc);

-- Append-only, even for the table owner acting through the app.
create function app.forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception 'audit events are append-only' using errcode = '42501';
end;
$$;
create trigger audit_events_immutable
  before update or delete on public.audit_events
  for each row execute function app.forbid_mutation();
create trigger audit_events_no_truncate
  before truncate on public.audit_events
  for each statement execute function app.forbid_mutation();

-- ---------------------------------------------------------------------------
-- Authorization helpers. SECURITY DEFINER so policies can consult membership
-- tables without recursive RLS; each only answers questions about the caller.
-- ---------------------------------------------------------------------------
create function app.active_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.org_id = p_org and m.profile_id = (select auth.uid()) and m.state = 'active'
  );
$$;

create function app.is_org_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.org_id = p_org and m.profile_id = (select auth.uid())
      and m.state = 'active' and m.role in ('owner', 'admin')
  );
$$;

create function app.is_team_member(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.team_memberships tm
    join public.organization_memberships om
      on om.org_id = tm.org_id and om.profile_id = tm.profile_id
    join public.teams t on t.id = tm.team_id
    where tm.team_id = p_team and tm.profile_id = (select auth.uid())
      and tm.active and om.state = 'active' and t.archived_at is null
  );
$$;

create function app.is_team_lead(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.team_memberships tm
    join public.organization_memberships om
      on om.org_id = tm.org_id and om.profile_id = tm.profile_id
    where tm.team_id = p_team and tm.profile_id = (select auth.uid())
      and tm.active and tm.role = 'lead' and om.state = 'active'
  );
$$;

-- Expiry is evaluated on every call; no scheduled job is needed for enforcement.
create function app.has_team_grant(p_team uuid, p_scopes public.grant_scope[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.team_access_grants g
    join public.organization_memberships om
      on om.org_id = g.org_id and om.profile_id = g.grantee_id
    join public.teams t on t.id = g.team_id
    where g.team_id = p_team and g.grantee_id = (select auth.uid())
      and g.status = 'active' and (g.expires_at is null or g.expires_at > now())
      and g.scope = any (p_scopes) and om.state = 'active' and t.archived_at is null
  );
$$;

create function app.can_read_team(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_team_member(p_team)
      or app.has_team_grant(p_team, array['workspace_read', 'collaboration', 'edit']::public.grant_scope[]);
$$;

create function app.can_comment_team(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_team_member(p_team)
      or app.has_team_grant(p_team, array['collaboration', 'edit']::public.grant_scope[]);
$$;

create function app.can_write_team(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_team_member(p_team)
      or app.has_team_grant(p_team, array['edit']::public.grant_scope[]);
$$;

create function app.can_view_team_summary(p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.can_read_team(p_team)
      or app.has_team_grant(p_team, array['dashboard_summary']::public.grant_scope[]);
$$;

create function app.shares_org_with(p_profile uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organization_memberships mine
    join public.organization_memberships theirs on theirs.org_id = mine.org_id
    where mine.profile_id = (select auth.uid()) and mine.state = 'active'
      and theirs.profile_id = p_profile
  );
$$;

create function app.require_uid() returns uuid
language plpgsql stable set search_path = '' as $$
declare v uuid := auth.uid();
begin
  if v is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  return v;
end;
$$;

-- Internal: only called by trusted SECURITY DEFINER functions/triggers.
create function app.audit(
  p_org uuid, p_action text, p_team uuid, p_target_type text, p_target_id uuid, p_metadata jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_events (org_id, actor_id, action, team_id, target_type, target_id, metadata)
  values (p_org, auth.uid(), p_action, p_team, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
$$;

grant execute on function
  app.active_org_member(uuid), app.is_org_admin(uuid), app.is_team_member(uuid), app.is_team_lead(uuid),
  app.has_team_grant(uuid, public.grant_scope[]), app.can_read_team(uuid), app.can_comment_team(uuid),
  app.can_write_team(uuid), app.can_view_team_summary(uuid), app.shares_org_with(uuid), app.require_uid()
  to authenticated;

-- ---------------------------------------------------------------------------
-- Profile provisioning from auth.users
-- ---------------------------------------------------------------------------
create function app.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

create function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function app.touch_updated_at();
create trigger org_memberships_touch before update on public.organization_memberships
  for each row execute function app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.teams enable row level security;
alter table public.team_issue_counters enable row level security;
alter table public.team_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.team_access_grants enable row level security;
alter table public.audit_events enable row level security;

create policy organizations_select on public.organizations for select to authenticated
  using (app.active_org_member(id));

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or app.shares_org_with(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy org_memberships_select on public.organization_memberships for select to authenticated
  using (profile_id = (select auth.uid()) or app.active_org_member(org_id));

-- Team names are visible to people who can enter the team, to summary-grant
-- holders, and to org admins who administer membership. Never to everyone.
create policy teams_select on public.teams for select to authenticated
  using (app.can_view_team_summary(id) or app.is_org_admin(org_id));

create policy team_memberships_select on public.team_memberships for select to authenticated
  using (profile_id = (select auth.uid()) or app.can_read_team(team_id) or app.is_org_admin(org_id));

create policy invitations_select_admin on public.invitations for select to authenticated
  using (app.is_org_admin(org_id));

create policy grants_select on public.team_access_grants for select to authenticated
  using (
    grantee_id = (select auth.uid())
    or issuer_id = (select auth.uid())
    or app.is_org_admin(org_id)
    or app.is_team_lead(team_id)
  );

-- Admins see workspace events; team leads see their own team's events.
create policy audit_select on public.audit_events for select to authenticated
  using (app.is_org_admin(org_id) or (team_id is not null and app.is_team_lead(team_id)));

-- team_issue_counters: no policies => no access for app roles.

grant select on public.organizations, public.profiles, public.organization_memberships, public.teams,
  public.team_memberships, public.invitations, public.team_access_grants, public.audit_events to authenticated;
-- Profile self-service is column-scoped; level/email are not self-editable.
grant update (display_name, avatar_url, timezone, title, theme) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Intake directory: which teams accept Work Requests. Reveals only id + name
-- of teams that explicitly opted in, to active members with requester capability.
-- ---------------------------------------------------------------------------
create function public.list_intake_teams()
returns table (id uuid, name text, slug text)
language sql stable security definer set search_path = '' as $$
  select t.id, t.name, t.slug
  from public.teams t
  join public.organization_memberships om
    on om.org_id = t.org_id and om.profile_id = (select auth.uid())
  where t.accepts_requests and t.archived_at is null and om.state = 'active' and om.can_request
  order by t.name;
$$;
grant execute on function public.list_intake_teams() to authenticated;

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------
create function public.create_invitation(
  p_org uuid, p_email text, p_org_role public.org_role, p_token_hash text,
  p_team uuid default null, p_team_role public.team_role default null, p_valid_days int default 7
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_uid();
  v_id uuid;
  v_email text := lower(btrim(p_email));
begin
  if not app.is_org_admin(p_org) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if p_org_role = 'owner' then
    raise exception 'owners cannot be invited' using errcode = '22023';
  end if;
  if p_org_role = 'admin' and not exists (
    select 1 from public.organization_memberships
    where org_id = p_org and profile_id = v_uid and role = 'owner' and state = 'active'
  ) then
    raise exception 'only an owner can invite an admin' using errcode = '42501';
  end if;
  if p_valid_days not between 1 and 30 then
    raise exception 'invalid expiry' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.organization_memberships om join public.profiles p on p.id = om.profile_id
    where om.org_id = p_org and p.email = v_email
  ) then
    raise exception 'already a member' using errcode = '23505';
  end if;

  -- Re-inviting replaces (revokes) any pending invitation for this email.
  update public.invitations set revoked_at = now(), revoked_by = v_uid
  where org_id = p_org and email = v_email and accepted_at is null and revoked_at is null;

  insert into public.invitations (org_id, email, org_role, team_id, team_role, token_hash, invited_by, expires_at)
  values (p_org, v_email, p_org_role, p_team, p_team_role, p_token_hash, v_uid, now() + make_interval(days => p_valid_days))
  returning id into v_id;

  perform app.audit(p_org, 'invitation.created', p_team, 'invitation', v_id,
    jsonb_build_object('org_role', p_org_role, 'team_role', p_team_role, 'valid_days', p_valid_days));
  return v_id;
end;
$$;

create function public.revoke_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_team uuid;
begin
  perform app.require_uid();
  select org_id, team_id into v_org, v_team from public.invitations where id = p_invitation;
  if v_org is null or not app.is_org_admin(v_org) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  update public.invitations set revoked_at = now(), revoked_by = auth.uid()
  where id = p_invitation and accepted_at is null and revoked_at is null;
  if not found then
    raise exception 'invitation is no longer pending' using errcode = '22023';
  end if;
  perform app.audit(v_org, 'invitation.revoked', v_team, 'invitation', p_invitation, '{}'::jsonb);
end;
$$;

-- Public, token-gated lookup. Reveals the workspace name and invited email only
-- for a currently valid token; every other case collapses to a generic state.
create function public.peek_invitation(p_token_hash text)
returns table (state text, workspace_name text, email text)
language plpgsql stable security definer set search_path = '' as $$
declare r record;
begin
  select i.*, o.name as org_name into r
  from public.invitations i join public.organizations o on o.id = i.org_id
  where i.token_hash = p_token_hash;
  if not found or r.revoked_at is not null then
    return query select 'invalid'::text, null::text, null::text;
  elsif r.accepted_at is not null then
    return query select 'used'::text, null::text, null::text;
  elsif r.expires_at <= now() then
    return query select 'expired'::text, null::text, null::text;
  else
    return query select 'valid'::text, r.org_name::text, r.email::text;
  end if;
end;
$$;

-- Atomic, single-use acceptance by the signed-in invitee.
create function public.accept_invitation(p_token_hash text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_uid();
  v_email text;
  r public.invitations;
begin
  select lower(email) into v_email from auth.users where id = v_uid;

  select * into r from public.invitations
  where token_hash = p_token_hash
  for update;

  if not found or r.revoked_at is not null or r.accepted_at is not null or r.expires_at <= now()
     or r.email <> v_email then
    raise exception 'invitation is not valid' using errcode = '22023';
  end if;

  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = r.id;

  insert into public.organization_memberships (org_id, profile_id, role)
  values (r.org_id, v_uid, r.org_role)
  on conflict (org_id, profile_id) do nothing;

  if r.team_id is not null then
    insert into public.team_memberships (org_id, team_id, profile_id, role, added_by)
    values (r.org_id, r.team_id, v_uid, r.team_role, r.invited_by)
    on conflict (team_id, profile_id) do update set active = true, removed_at = null, role = excluded.role;
  end if;

  perform app.audit(r.org_id, 'invitation.accepted', r.team_id, 'invitation', r.id, '{}'::jsonb);
  return r.org_id;
end;
$$;

grant execute on function public.create_invitation(uuid, text, public.org_role, text, uuid, public.team_role, int) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.peek_invitation(text) to anon, authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Membership administration
-- ---------------------------------------------------------------------------
create function public.admin_add_team_member(p_team uuid, p_profile uuid, p_role public.team_role)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.require_uid(); v_org uuid;
begin
  select org_id into v_org from public.teams where id = p_team and archived_at is null;
  if v_org is null or not app.is_org_admin(v_org) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  -- An admin cannot enrol themselves into private team content (DECISIONS.md D-004).
  if p_profile = v_uid then
    raise exception 'you cannot add yourself to a team' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.organization_memberships
    where org_id = v_org and profile_id = p_profile and state = 'active'
  ) then
    raise exception 'person is not an active workspace member' using errcode = '22023';
  end if;

  insert into public.team_memberships (org_id, team_id, profile_id, role, added_by)
  values (v_org, p_team, p_profile, p_role, v_uid)
  on conflict (team_id, profile_id) do update
    set active = true, removed_at = null, role = excluded.role, added_by = excluded.added_by;

  perform app.audit(v_org, 'team_membership.added', p_team, 'profile', p_profile, jsonb_build_object('role', p_role));
end;
$$;

create function public.admin_set_team_role(p_team uuid, p_profile uuid, p_role public.team_role)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.require_uid(); v_org uuid;
begin
  select org_id into v_org from public.teams where id = p_team;
  if v_org is null or not app.is_org_admin(v_org) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if p_profile = v_uid then
    raise exception 'you cannot change your own team role' using errcode = '42501';
  end if;
  update public.team_memberships set role = p_role where team_id = p_team and profile_id = p_profile and active;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  perform app.audit(v_org, 'team_membership.role_changed', p_team, 'profile', p_profile, jsonb_build_object('role', p_role));
end;
$$;

create function public.admin_remove_team_member(p_team uuid, p_profile uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  perform app.require_uid();
  select org_id into v_org from public.teams where id = p_team;
  if v_org is null or not app.is_org_admin(v_org) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  -- Access ends immediately: every helper checks `active`. History is preserved.
  update public.team_memberships set active = false, removed_at = now()
  where team_id = p_team and profile_id = p_profile and active;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  perform app.audit(v_org, 'team_membership.removed', p_team, 'profile', p_profile, '{}'::jsonb);
end;
$$;

create function public.admin_set_member_state(p_org uuid, p_profile uuid, p_state public.member_state)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.require_uid(); v_target_role public.org_role;
begin
  if not app.is_org_admin(p_org) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if p_profile = v_uid then
    raise exception 'you cannot change your own account state' using errcode = '42501';
  end if;
  select role into v_target_role from public.organization_memberships where org_id = p_org and profile_id = p_profile;
  if v_target_role is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if v_target_role = 'owner' then
    raise exception 'an owner cannot be suspended from the app' using errcode = '42501';
  end if;
  if v_target_role = 'admin' and not exists (
    select 1 from public.organization_memberships where org_id = p_org and profile_id = v_uid and role = 'owner'
  ) then
    raise exception 'only an owner can change an admin' using errcode = '42501';
  end if;
  update public.organization_memberships set state = p_state where org_id = p_org and profile_id = p_profile;
  perform app.audit(p_org, case when p_state = 'suspended' then 'member.suspended' else 'member.reactivated' end,
    null, 'profile', p_profile, '{}'::jsonb);
end;
$$;

grant execute on function public.admin_add_team_member(uuid, uuid, public.team_role) to authenticated;
grant execute on function public.admin_set_team_role(uuid, uuid, public.team_role) to authenticated;
grant execute on function public.admin_remove_team_member(uuid, uuid) to authenticated;
grant execute on function public.admin_set_member_state(uuid, uuid, public.member_state) to authenticated;

-- ---------------------------------------------------------------------------
-- Access grants (spec §4.4–4.5, §8.3–8.4)
-- ---------------------------------------------------------------------------
create function public.issue_grant(
  p_team uuid, p_grantee uuid, p_scope public.grant_scope, p_reason text, p_expires_at timestamptz default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_uid();
  v_org uuid;
  v_id uuid;
  v_status public.grant_status;
begin
  select org_id into v_org from public.teams where id = p_team and archived_at is null;
  if v_org is null or not app.is_org_admin(v_org) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if p_grantee = v_uid then
    raise exception 'you cannot grant access to yourself' using errcode = '42501';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'expiry must be in the future' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.organization_memberships where org_id = v_org and profile_id = p_grantee and state = 'active'
  ) then
    raise exception 'person is not an active workspace member' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.team_access_grants
    where team_id = p_team and grantee_id = p_grantee and scope = p_scope
      and (status = 'pending' or (status = 'active' and (expires_at is null or expires_at > now())))
  ) then
    raise exception 'an equivalent grant already exists' using errcode = '23505';
  end if;

  -- Summary-only grants are active on issue; private-content grants need a second approver.
  v_status := case when p_scope = 'dashboard_summary' then 'active' else 'pending' end;

  insert into public.team_access_grants (org_id, team_id, grantee_id, issuer_id, scope, reason, expires_at, status)
  values (v_org, p_team, p_grantee, v_uid, p_scope, btrim(p_reason), p_expires_at, v_status)
  returning id into v_id;

  perform app.audit(v_org, 'access_grant.issued', p_team, 'access_grant', v_id,
    jsonb_build_object('scope', p_scope, 'status', v_status, 'grantee', p_grantee,
                       'expires_at', p_expires_at));

  if v_status = 'active' then
    perform app.notify(v_org, p_grantee, 'grant_decided', 'grant', v_id);
  else
    -- Ask whoever may approve: the team's leads, or other admins if it has none.
    perform app.notify(v_org, a.profile_id, 'grant_pending', 'grant', v_id)
    from (
      select tm.profile_id from public.team_memberships tm
      join public.organization_memberships om on om.org_id = tm.org_id and om.profile_id = tm.profile_id
      where tm.team_id = p_team and tm.active and tm.role = 'lead' and om.state = 'active'
      union
      select om.profile_id from public.organization_memberships om
      where om.org_id = v_org and om.state = 'active' and om.role in ('owner', 'admin')
        and not exists (
          select 1 from public.team_memberships tm
          where tm.team_id = p_team and tm.active and tm.role = 'lead'
        )
    ) a
    where a.profile_id not in (p_grantee, v_uid);
  end if;
  return v_id;
end;
$$;

-- Who may approve a pending private-content grant: the target team's lead; if the
-- team has no active lead, another active owner/admin. Never grantee or issuer.
create function app.can_approve_grant(p_grant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_access_grants g
    where g.id = p_grant and g.status = 'pending'
      and (select auth.uid()) not in (g.grantee_id, g.issuer_id)
      and (
        app.is_team_lead(g.team_id)
        or (
          not exists (
            select 1 from public.team_memberships tm
            join public.organization_memberships om on om.org_id = tm.org_id and om.profile_id = tm.profile_id
            where tm.team_id = g.team_id and tm.active and tm.role = 'lead' and om.state = 'active'
          )
          and app.is_org_admin(g.org_id)
        )
      )
  );
$$;
grant execute on function app.can_approve_grant(uuid) to authenticated;

create function public.decide_grant(p_grant uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.team_access_grants;
begin
  perform app.require_uid();
  select * into r from public.team_access_grants where id = p_grant for update;
  if not found or not app.can_approve_grant(p_grant) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if r.expires_at is not null and r.expires_at <= now() then
    raise exception 'this request has already expired' using errcode = '22023';
  end if;
  update public.team_access_grants
  set status = case when p_approve then 'active'::public.grant_status else 'rejected'::public.grant_status end,
      approver_id = auth.uid(), decided_at = now(), decision_note = nullif(btrim(p_note), '')
  where id = p_grant;
  perform app.audit(r.org_id, case when p_approve then 'access_grant.approved' else 'access_grant.rejected' end,
    r.team_id, 'access_grant', p_grant, jsonb_build_object('scope', r.scope, 'grantee', r.grantee_id));
  perform app.notify(r.org_id, r.grantee_id, 'grant_decided', 'grant', p_grant);
  perform app.notify(r.org_id, r.issuer_id, 'grant_decided', 'grant', p_grant);
end;
$$;

create function public.revoke_grant(p_grant uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.team_access_grants;
begin
  perform app.require_uid();
  select * into r from public.team_access_grants where id = p_grant for update;
  if not found or not (app.is_org_admin(r.org_id) or app.is_team_lead(r.team_id)) then
    raise exception 'not permitted' using errcode = '42501';
  end if;
  if r.status not in ('pending', 'active') then
    raise exception 'this grant is no longer active' using errcode = '22023';
  end if;
  update public.team_access_grants
  set status = 'revoked', revoked_at = now(), revoked_by = auth.uid(), revoke_reason = nullif(btrim(p_reason), '')
  where id = p_grant;
  perform app.audit(r.org_id, 'access_grant.revoked', r.team_id, 'access_grant', p_grant,
    jsonb_build_object('scope', r.scope, 'grantee', r.grantee_id));
  perform app.notify(r.org_id, r.grantee_id, 'grant_revoked', 'grant', p_grant);
end;
$$;

grant execute on function public.issue_grant(uuid, uuid, public.grant_scope, text, timestamptz) to authenticated;
grant execute on function public.decide_grant(uuid, boolean, text) to authenticated;
grant execute on function public.revoke_grant(uuid, text) to authenticated;
