alter table public.events
  add column end_date date,
  add constraint events_end_date_after_event_date_check
    check (end_date is null or end_date >= event_date);

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

  if coalesce(event_row.end_date, event_row.event_date)
    < (now() at time zone 'UTC')::date then
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
