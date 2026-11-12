BEGIN;
SELECT plan(8);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.landing_page_visitor_sessions'::regclass),
  'RLS is enabled'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.landing_page_visitor_sessions', 'SELECT'),
  'anon cannot read visitor sessions'
);
SELECT ok(
  NOT has_table_privilege('anon', 'public.landing_page_visitor_sessions', 'INSERT'),
  'anon cannot insert visitor sessions directly'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.landing_page_visitor_sessions', 'SELECT'),
  'authenticated cannot read visitor sessions directly'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.landing_page_visitor_sessions', 'INSERT'),
  'authenticated cannot insert visitor sessions directly'
);
SELECT ok(
  has_table_privilege('service_role', 'public.landing_page_visitor_sessions', 'SELECT'),
  'service_role can read visitor sessions server-side'
);
SELECT ok(
  has_table_privilege('service_role', 'public.landing_page_visitor_sessions', 'INSERT'),
  'service_role can record visitor sessions server-side'
);
SELECT ok(
  (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'service_role'),
  'service_role bypasses RLS for server-side operations'
);

SELECT * FROM finish();
ROLLBACK;
