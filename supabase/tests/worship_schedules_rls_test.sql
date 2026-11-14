begin;
select plan(10);

insert into public.worship_schedules (id, day, time, service_name, sort_order, archived_at) values
  ('00000000-0000-4000-8000-000000000a01', 'Sunday', '9 AM', 'Schedule test first', -200, null),
  ('00000000-0000-4000-8000-000000000a02', 'Sunday', '11 AM', 'Schedule test second', -199, null),
  ('00000000-0000-4000-8000-000000000a03', 'Friday', '6 PM', 'Schedule test archived', -198, now());

select ok((select relrowsecurity from pg_class where oid = 'public.worship_schedules'::regclass), 'RLS is enabled');
select ok(not has_table_privilege('anon', 'public.worship_schedule_legacy_draft', 'select'), 'Anonymous visitors cannot read the old draft');
set local role anon;
select is((select count(*) from public.worship_schedules where service_name like 'Schedule test%'), 2::bigint, 'Anonymous visitors see active schedules only');
select throws_ok($$insert into public.worship_schedules (day, time, service_name) values ('Sun', '9 AM', 'Unauthorized')$$, '42501', null, 'Anonymous visitors cannot insert schedules');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"app_metadata":{"role":"contributor"}}', true);
select is((select count(*) from public.worship_schedules where service_name like 'Schedule test%'), 2::bigint, 'Contributors cannot read archived schedules');
select throws_ok($$insert into public.worship_schedules (day, time, service_name) values ('Sun', '9 AM', 'Unauthorized')$$, '42501', null, 'Contributors cannot insert schedules');
select ok(not public.move_worship_schedule('00000000-0000-4000-8000-000000000a01', 'down'), 'Contributors cannot reorder schedules');
select set_config('request.jwt.claims', '{"app_metadata":{"role":"admin"}}', true);
select is((select count(*) from public.worship_schedules where service_name like 'Schedule test%'), 3::bigint, 'Admins can read archived schedules');
select ok(public.move_worship_schedule('00000000-0000-4000-8000-000000000a01', 'down'), 'Admins can reorder schedules');
select is((select service_name from public.worship_schedules where id in ('00000000-0000-4000-8000-000000000a01', '00000000-0000-4000-8000-000000000a02') order by sort_order limit 1), 'Schedule test second', 'Reordering changes public display order');
reset role;
select * from finish();
rollback;
