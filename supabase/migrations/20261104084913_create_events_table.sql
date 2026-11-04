create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null check (char_length(btrim(description)) between 1 and 3000),
  event_date date not null,
  starts_at time without time zone not null,
  ends_at time without time zone,
  location text not null check (char_length(btrim(location)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_event_date_starts_at_idx
  on public.events (event_date, starts_at);

alter table public.events enable row level security;

revoke all on table public.events from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on table public.events to anon, authenticated;
grant insert, update, delete on table public.events to authenticated;
grant all on table public.events to service_role;

create policy "Anyone can read events"
  on public.events
  for select
  to anon, authenticated
  using (true);

create policy "Admins can create events"
  on public.events
  for insert
  to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can update events"
  on public.events
  for update
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can delete events"
  on public.events
  for delete
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');