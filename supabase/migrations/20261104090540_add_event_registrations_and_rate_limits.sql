alter table public.events
  add column registration_enabled boolean not null default false,
  add column registration_fields jsonb not null default '[]'::jsonb
    check (jsonb_typeof(registration_fields) = 'array'),
  add column registration_deadline date,
  add column registration_capacity integer
    check (registration_capacity is null or registration_capacity > 0);

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  form_snapshot jsonb not null check (jsonb_typeof(form_snapshot) = 'array'),
  submitted_at timestamptz not null default now()
);

create index event_registrations_event_submitted_idx
  on public.event_registrations (event_id, submitted_at desc);

alter table public.event_registrations enable row level security;

revoke all on table public.event_registrations from public, anon, authenticated;
grant select on table public.event_registrations to authenticated;
grant all on table public.event_registrations to service_role;

create policy "Admins can view event registrations"
  on public.event_registrations
  for select
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table private.registration_rate_limits (
  request_hash text not null,
  bucket_start timestamptz not null,
  attempts integer not null check (attempts > 0),
  expires_at timestamptz not null,
  primary key (request_hash, bucket_start)
);

create index registration_rate_limits_expires_at_idx
  on private.registration_rate_limits (expires_at);

alter table private.registration_rate_limits enable row level security;
revoke all on table private.registration_rate_limits from public, anon, authenticated;
grant all on table private.registration_rate_limits to service_role;

create or replace function public.consume_event_registration_rate_limit(
  p_request_hash text,
  p_bucket_start timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_count integer;
begin
  delete from private.registration_rate_limits
  where expires_at < now();

  insert into private.registration_rate_limits (
    request_hash,
    bucket_start,
    attempts,
    expires_at
  )
  values (
    p_request_hash,
    p_bucket_start,
    1,
    p_bucket_start + interval '15 minutes'
  )
  on conflict (request_hash, bucket_start)
  do update set attempts = private.registration_rate_limits.attempts + 1
  returning attempts into attempt_count;

  return attempt_count <= 5;
end;
$$;

revoke all on function public.consume_event_registration_rate_limit(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.consume_event_registration_rate_limit(text, timestamptz)
  to service_role;

create or replace function public.submit_event_registration(
  p_event_id uuid,
  p_answers jsonb,
  p_form_snapshot jsonb
)
returns table (status text, registration_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.events%rowtype;
  registration_count bigint;
  new_registration_id uuid;
begin
  if jsonb_typeof(p_answers) <> 'object'
    or jsonb_typeof(p_form_snapshot) <> 'array' then
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  select *
    into event_row
    from public.events
   where id = p_event_id
   for update;

  if not found or not event_row.registration_enabled then
    return query select 'unavailable'::text, null::uuid;
    return;
  end if;

  if event_row.registration_fields is distinct from p_form_snapshot then
    return query select 'form_changed'::text, null::uuid;
    return;
  end if;

  if event_row.registration_deadline is not null
    and (now() at time zone 'UTC')::date > event_row.registration_deadline then
    return query select 'closed'::text, null::uuid;
    return;
  end if;

  if event_row.event_date < (now() at time zone 'UTC')::date then
    return query select 'closed'::text, null::uuid;
    return;
  end if;

  if event_row.registration_capacity is not null then
    select count(*)
      into registration_count
      from public.event_registrations
     where event_id = p_event_id;

    if registration_count >= event_row.registration_capacity then
      return query select 'full'::text, null::uuid;
      return;
    end if;
  end if;

  insert into public.event_registrations (event_id, answers, form_snapshot)
  values (p_event_id, p_answers, p_form_snapshot)
  returning id into new_registration_id;

  return query select 'submitted'::text, new_registration_id;
end;
$$;

revoke all on function public.submit_event_registration(uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_event_registration(uuid, jsonb, jsonb)
  to service_role;