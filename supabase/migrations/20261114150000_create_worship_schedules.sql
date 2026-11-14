create sequence public.worship_schedule_order_seq;

create table public.worship_schedules (
  id uuid primary key default gen_random_uuid(),
  day text not null check (char_length(btrim(day)) between 1 and 40),
  time text not null check (char_length(btrim(time)) between 1 and 40),
  service_name text not null check (char_length(btrim(service_name)) between 1 and 120),
  note text not null default '' check (char_length(note) <= 300),
  sort_order bigint not null default nextval('public.worship_schedule_order_seq'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter sequence public.worship_schedule_order_seq owned by public.worship_schedules.sort_order;
create index worship_schedules_active_order_idx on public.worship_schedules (sort_order, id) where archived_at is null;

create table public.worship_schedule_legacy_draft (
  id boolean primary key default true check (id),
  rows jsonb not null,
  captured_at timestamptz not null default now()
);

alter table public.worship_schedules enable row level security;
alter table public.worship_schedule_legacy_draft enable row level security;
revoke all on public.worship_schedules, public.worship_schedule_legacy_draft from public, anon, authenticated;
revoke all on sequence public.worship_schedule_order_seq from public, anon, authenticated;
grant select on public.worship_schedules to anon, authenticated;
grant insert, update, delete on public.worship_schedules to authenticated;
grant usage on sequence public.worship_schedule_order_seq to authenticated;
grant select on public.worship_schedule_legacy_draft to authenticated;
grant all on public.worship_schedules, public.worship_schedule_legacy_draft to service_role;

create policy "Public can read active worship schedules" on public.worship_schedules
  for select to anon, authenticated using (archived_at is null);
create policy "Admins can read all worship schedules" on public.worship_schedules
  for select to authenticated using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can create worship schedules" on public.worship_schedules
  for insert to authenticated with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can update worship schedules" on public.worship_schedules
  for update to authenticated using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can delete worship schedules" on public.worship_schedules
  for delete to authenticated using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can read preserved schedule draft" on public.worship_schedule_legacy_draft
  for select to authenticated using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into public.worship_schedules (id, day, time, service_name, note)
select (item.value ->> 'id')::uuid, item.value ->> 'day', item.value ->> 'time',
  item.value ->> 'serviceName', coalesce(item.value ->> 'note', '')
from public.landing_page_published as published
cross join lateral jsonb_array_elements(coalesce(published.content #> '{schedule,rows}', '[]'::jsonb)) with ordinality as item(value, position)
where published.id = true
order by item.position;

insert into public.worship_schedule_legacy_draft (id, rows)
select true, coalesce(draft.content #> '{schedule,rows}', '[]'::jsonb)
from public.landing_page_drafts as draft
left join public.landing_page_published as published on published.id = draft.id
where draft.id = true
  and coalesce(draft.content #> '{schedule,rows}', '[]'::jsonb)
    is distinct from coalesce(published.content #> '{schedule,rows}', '[]'::jsonb);

create function public.move_worship_schedule(schedule_id uuid, direction text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_order bigint;
  neighbor_id uuid;
  neighbor_order bigint;
begin
  if (select auth.jwt() -> 'app_metadata' ->> 'role') is distinct from 'admin'
    or direction not in ('up', 'down') or direction is null then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(729321854);
  select sort_order into current_order from public.worship_schedules
    where id = schedule_id and archived_at is null for update;
  if not found then return false; end if;

  if direction = 'up' then
    select id, sort_order into neighbor_id, neighbor_order from public.worship_schedules
      where archived_at is null and (sort_order, id) < (current_order, schedule_id)
      order by sort_order desc, id desc limit 1 for update;
  else
    select id, sort_order into neighbor_id, neighbor_order from public.worship_schedules
      where archived_at is null and (sort_order, id) > (current_order, schedule_id)
      order by sort_order, id limit 1 for update;
  end if;
  if neighbor_id is null then return false; end if;
  update public.worship_schedules
    set sort_order = case when id = schedule_id then neighbor_order else current_order end,
        updated_at = now()
    where id in (schedule_id, neighbor_id) and archived_at is null;
  return found;
end;
$$;
revoke all on function public.move_worship_schedule(uuid, text) from public, anon, authenticated;
grant execute on function public.move_worship_schedule(uuid, text) to authenticated;
