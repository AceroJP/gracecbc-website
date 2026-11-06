create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table public.devotional_contributors (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 160),
  username text not null check (username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$'),
  normalized_username text generated always as (lower(btrim(username))) stored,
  email_verified_at timestamptz,
  status text not null default 'pending_email_verification'
    check (status in (
      'pending_email_verification',
      'pending_admin_approval',
      'approved',
      'rejected',
      'suspended'
    )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index devotional_contributors_normalized_username_idx
  on public.devotional_contributors (normalized_username);

create table public.devotional_applications (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.devotional_contributors(id) on delete restrict,
  status text not null default 'pending_email_verification'
    check (status in (
      'pending_email_verification',
      'pending_admin_approval',
      'approved',
      'rejected'
    )),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index devotional_applications_pending_contributor_idx
  on public.devotional_applications (contributor_id)
  where status in ('pending_email_verification', 'pending_admin_approval');

create index devotional_applications_status_submitted_idx
  on public.devotional_applications (status, submitted_at desc);

create table public.devotional_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '' check (char_length(description) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint devotional_categories_slug_key unique (slug)
);

create table public.devotionals (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references public.devotional_contributors(id) on delete restrict,
  category_id uuid references public.devotional_categories(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  bible_passage text not null check (char_length(btrim(bible_passage)) between 1 and 160),
  bible_translation text not null check (char_length(btrim(bible_translation)) between 1 and 40),
  key_verse text not null check (char_length(btrim(key_verse)) between 1 and 2000),
  message text not null check (char_length(btrim(message)) between 1 and 50000),
  personal_application text not null check (char_length(btrim(personal_application)) between 1 and 20000),
  closing_prayer text not null check (char_length(btrim(closing_prayer)) between 1 and 10000),
  status text not null default 'pending_review'
    check (status in ('pending_review', 'published', 'rejected', 'unpublished')),
  is_featured boolean not null default false,
  submitted_at timestamptz not null default now(),
  published_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejection_reason text check (rejection_reason is null or char_length(rejection_reason) <= 2000),
  moderation_note text check (moderation_note is null or char_length(moderation_note) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reaction_count integer not null default 0 check (reaction_count >= 0)
);

create index devotionals_status_published_at_idx
  on public.devotionals (status, published_at desc);

create index devotionals_category_published_at_idx
  on public.devotionals (category_id, published_at desc)
  where status = 'published';

create table public.devotional_reactions (
  id uuid primary key default gen_random_uuid(),
  devotional_id uuid not null references public.devotionals(id) on delete cascade,
  visitor_identifier_hash text not null check (visitor_identifier_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  constraint devotional_reactions_unique_visitor unique (devotional_id, visitor_identifier_hash)
);

create index devotional_reactions_devotional_idx
  on public.devotional_reactions (devotional_id);

create table public.devotional_reports (
  id uuid primary key default gen_random_uuid(),
  devotional_id uuid not null references public.devotionals(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 80),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'pending'
    check (status in ('pending', 'reviewed', 'dismissed')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index devotional_reports_status_created_idx
  on public.devotional_reports (status, created_at desc);

create table public.devotional_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(btrim(action)) between 1 and 80),
  entity_type text not null check (char_length(btrim(entity_type)) between 1 and 80),
  entity_id uuid,
  previous_status text,
  new_status text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index devotional_audit_log_entity_idx
  on public.devotional_audit_log (entity_type, entity_id, created_at desc);

create table private.devotional_submission_grants (
  grant_hash text primary key check (grant_hash ~ '^[a-f0-9]{64}$'),
  contributor_id uuid not null references public.devotional_contributors(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index devotional_submission_grants_expiry_idx
  on private.devotional_submission_grants (expires_at);

create table private.devotional_rate_limits (
  scope text not null,
  request_hash text not null,
  bucket_start timestamptz not null,
  attempts integer not null check (attempts > 0),
  expires_at timestamptz not null,
  primary key (scope, request_hash, bucket_start)
);

create index devotional_rate_limits_expiry_idx
  on private.devotional_rate_limits (expires_at);

alter table public.devotional_contributors enable row level security;
alter table public.devotional_applications enable row level security;
alter table public.devotional_categories enable row level security;
alter table public.devotionals enable row level security;
alter table public.devotional_reactions enable row level security;
alter table public.devotional_reports enable row level security;
alter table public.devotional_audit_log enable row level security;
alter table private.devotional_submission_grants enable row level security;
alter table private.devotional_rate_limits enable row level security;

revoke all on table public.devotional_contributors from public, anon, authenticated;
revoke all on table public.devotional_applications from public, anon, authenticated;
revoke all on table public.devotional_categories from public, anon, authenticated;
revoke all on table public.devotionals from public, anon, authenticated;
revoke all on table public.devotional_reactions from public, anon, authenticated;
revoke all on table public.devotional_reports from public, anon, authenticated;
revoke all on table public.devotional_audit_log from public, anon, authenticated;
revoke all on table private.devotional_submission_grants from public, anon, authenticated;
revoke all on table private.devotional_rate_limits from public, anon, authenticated;

grant select on table public.devotional_categories to anon, authenticated;
grant select on table public.devotionals to anon, authenticated;
grant select, insert, update, delete on table public.devotional_categories to authenticated;
grant select, insert, update, delete on table public.devotional_contributors to authenticated;
grant select, insert, update, delete on table public.devotional_applications to authenticated;
grant select, insert, update, delete on table public.devotionals to authenticated;
grant select on table public.devotional_reports to authenticated;
grant select on table public.devotional_audit_log to authenticated;

grant all on table public.devotional_contributors to service_role;
grant all on table public.devotional_applications to service_role;
grant all on table public.devotional_categories to service_role;
grant all on table public.devotionals to service_role;
grant all on table public.devotional_reactions to service_role;
grant all on table public.devotional_reports to service_role;
grant all on table public.devotional_audit_log to service_role;
grant all on table private.devotional_submission_grants to service_role;
grant all on table private.devotional_rate_limits to service_role;

create policy "Public can read active devotional categories"
  on public.devotional_categories
  for select
  to anon, authenticated
  using (is_active);

create policy "Admins can manage devotional categories"
  on public.devotional_categories
  for all
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Public can read published devotionals"
  on public.devotionals
  for select
  to anon, authenticated
  using (status = 'published');

create policy "Admins can manage devotionals"
  on public.devotionals
  for all
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can manage devotional contributors"
  on public.devotional_contributors
  for all
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can manage devotional applications"
  on public.devotional_applications
  for all
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can review devotional reports"
  on public.devotional_reports
  for select
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can read devotional audit log"
  on public.devotional_audit_log
  for select
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.consume_devotional_rate_limit(
  p_scope text,
  p_request_hash text,
  p_max_attempts integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket_start timestamptz;
  v_attempts integer;
begin
  if p_scope is null or p_scope = ''
    or p_request_hash is null or p_request_hash = ''
    or p_max_attempts <= 0
    or p_window_seconds <= 0 then
    return false;
  end if;

  v_bucket_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  delete from private.devotional_rate_limits
   where expires_at < now();

  insert into private.devotional_rate_limits (
    scope,
    request_hash,
    bucket_start,
    attempts,
    expires_at
  )
  values (
    p_scope,
    p_request_hash,
    v_bucket_start,
    1,
    v_bucket_start + make_interval(secs => p_window_seconds)
  )
  on conflict (scope, request_hash, bucket_start)
  do update set attempts = private.devotional_rate_limits.attempts + 1
  returning attempts into v_attempts;

  return v_attempts <= p_max_attempts;
end;
$$;

create or replace function public.create_devotional_submission(
  p_grant_hash text,
  p_title text,
  p_slug text,
  p_bible_passage text,
  p_bible_translation text,
  p_key_verse text,
  p_message text,
  p_personal_application text,
  p_closing_prayer text,
  p_category_id uuid default null
)
returns table (status text, devotional_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant private.devotional_submission_grants%rowtype;
  v_contributor public.devotional_contributors%rowtype;
  v_devotional_id uuid;
begin
  select *
    into v_grant
    from private.devotional_submission_grants
   where grant_hash = p_grant_hash
   for update;

  if not found
    or v_grant.consumed_at is not null
    or v_grant.expires_at <= now() then
    return query select 'invalid_grant'::text, null::uuid;
    return;
  end if;

  select *
    into v_contributor
    from public.devotional_contributors
   where id = v_grant.contributor_id
    for update;

  if not found or v_contributor.status <> 'approved' then
    return query select 'unauthorized'::text, null::uuid;
    return;
  end if;

  if p_category_id is not null
    and not exists (
      select 1
        from public.devotional_categories
       where id = p_category_id
         and is_active
    ) then
    return query select 'invalid_category'::text, null::uuid;
    return;
  end if;

  if exists (select 1 from public.devotionals where slug = p_slug) then
    return query select 'duplicate_slug'::text, null::uuid;
    return;
  end if;

  update private.devotional_submission_grants
     set consumed_at = now()
   where grant_hash = p_grant_hash;

  insert into public.devotionals (
    contributor_id,
    category_id,
    title,
    slug,
    bible_passage,
    bible_translation,
    key_verse,
    message,
    personal_application,
    closing_prayer,
    status
  )
  values (
    v_contributor.id,
    p_category_id,
    p_title,
    p_slug,
    p_bible_passage,
    p_bible_translation,
    p_key_verse,
    p_message,
    p_personal_application,
    p_closing_prayer,
    'pending_review'
  )
  returning id into v_devotional_id;

  return query select 'submitted'::text, v_devotional_id;
end;
$$;

create or replace function public.issue_devotional_submission_grant(
  p_grant_hash text,
  p_contributor_id uuid,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_grant_hash !~ '^[a-f0-9]{64}$'
    or p_expires_at <= now()
    or not exists (
      select 1
        from public.devotional_contributors
       where id = p_contributor_id
         and status = 'approved'
         and email_verified_at is not null
    ) then
    return false;
  end if;

  insert into private.devotional_submission_grants (
    grant_hash,
    contributor_id,
    expires_at
  )
  values (p_grant_hash, p_contributor_id, p_expires_at);

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

create or replace function public.toggle_devotional_reaction(
  p_devotional_id uuid,
  p_visitor_identifier_hash text,
  p_action text
)
returns table (liked boolean, reaction_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_rows integer;
  v_inserted boolean := false;
begin
  if p_action is null
    or p_visitor_identifier_hash is null
    or p_action not in ('like', 'unlike')
    or p_visitor_identifier_hash !~ '^[a-f0-9]{64}$' then
    return query select false, 0;
    return;
  end if;

  perform 1
    from public.devotionals
   where id = p_devotional_id
     and status = 'published'
   for update;

  if not found then
    return query select false, 0;
    return;
  end if;

  if p_action = 'like' then
    insert into public.devotional_reactions (
      devotional_id,
      visitor_identifier_hash
    )
    values (p_devotional_id, p_visitor_identifier_hash)
    on conflict (devotional_id, visitor_identifier_hash) do nothing;

    get diagnostics v_rows = row_count;
    v_inserted := v_rows = 1;

    if v_inserted then
      update public.devotionals
         set reaction_count = reaction_count + 1,
             updated_at = now()
       where id = p_devotional_id
       returning reaction_count into v_count;
    else
      select reaction_count into v_count
        from public.devotionals
       where id = p_devotional_id;
    end if;
  else
    delete from public.devotional_reactions
     where devotional_id = p_devotional_id
       and visitor_identifier_hash = p_visitor_identifier_hash;

    if found then
      update public.devotionals
         set reaction_count = greatest(reaction_count - 1, 0),
             updated_at = now()
       where id = p_devotional_id
       returning reaction_count into v_count;
    else
      select reaction_count into v_count
        from public.devotionals
       where id = p_devotional_id;
    end if;
  end if;

  return query select p_action = 'like', v_count;
end;
$$;

create or replace function public.create_devotional_report(
  p_devotional_id uuid,
  p_reason text,
  p_details text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report_id uuid;
begin
  if not exists (
    select 1
      from public.devotionals
     where id = p_devotional_id
       and status = 'published'
  ) then
    return null;
  end if;

  insert into public.devotional_reports (devotional_id, reason, details)
  values (p_devotional_id, p_reason, coalesce(p_details, ''))
  returning id into v_report_id;

  return v_report_id;
end;
$$;

revoke all on function public.consume_devotional_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.create_devotional_submission(text, text, text, text, text, text, text, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.issue_devotional_submission_grant(text, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.toggle_devotional_reaction(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.create_devotional_report(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.consume_devotional_rate_limit(text, text, integer, integer)
  to service_role;
grant execute on function public.create_devotional_submission(text, text, text, text, text, text, text, text, text, uuid)
  to service_role;
grant execute on function public.issue_devotional_submission_grant(text, uuid, timestamptz)
  to service_role;
grant execute on function public.toggle_devotional_reaction(uuid, text, text)
  to service_role;
grant execute on function public.create_devotional_report(uuid, text, text)
  to service_role;
