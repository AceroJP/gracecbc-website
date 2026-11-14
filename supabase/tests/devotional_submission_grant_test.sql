begin;
select plan(14);

select has_function(
  'public', 'issue_devotional_submission_grant',
  array['text', 'uuid', 'timestamp with time zone'],
  'Submission grant function is installed'
);

select ok(
  has_function_privilege('service_role', 'public.issue_devotional_submission_grant(text,uuid,timestamptz)', 'execute'),
  'The server can issue submission grants'
);
select ok(
  not has_function_privilege('anon', 'public.issue_devotional_submission_grant(text,uuid,timestamptz)', 'execute'),
  'Anonymous clients cannot issue submission grants'
);
select ok(
  not has_function_privilege('authenticated', 'public.issue_devotional_submission_grant(text,uuid,timestamptz)', 'execute'),
  'Authenticated clients cannot issue submission grants'
);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000101', 'grant-approved@example.invalid'),
  ('00000000-0000-4000-8000-000000000102', 'grant-pending@example.invalid'),
  ('00000000-0000-4000-8000-000000000103', 'grant-unverified@example.invalid');

insert into public.devotional_contributors (id, auth_user_id, full_name, username, email_verified_at, status) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', 'Approved test', 'grant-approved-test', now(), 'approved'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000102', 'Pending test', 'grant-pending-test', now(), 'pending_admin_approval'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000103', 'Unverified test', 'grant-unverified-test', null, 'approved');

select is(public.issue_devotional_submission_grant(repeat('a', 64), '00000000-0000-4000-8000-000000000299', now() + interval '5 minutes'), false, 'A missing contributor cannot obtain a grant');
select is(public.issue_devotional_submission_grant(repeat('a', 64), '00000000-0000-4000-8000-000000000202', now() + interval '5 minutes'), false, 'An unapproved contributor cannot obtain a grant');
select is(public.issue_devotional_submission_grant(repeat('a', 64), '00000000-0000-4000-8000-000000000203', now() + interval '5 minutes'), false, 'An unverified contributor cannot obtain a grant');
select is(public.issue_devotional_submission_grant(repeat('a', 64), '00000000-0000-4000-8000-000000000201', now() - interval '1 minute'), false, 'Expired grants are rejected');
select is(public.issue_devotional_submission_grant('invalid', '00000000-0000-4000-8000-000000000201', now() + interval '5 minutes'), false, 'Malformed grants are rejected');
select is(public.issue_devotional_submission_grant(repeat('a', 64), '00000000-0000-4000-8000-000000000201', now() + interval '5 minutes'), true, 'An approved verified contributor obtains a grant');
select is(public.issue_devotional_submission_grant(repeat('a', 64), '00000000-0000-4000-8000-000000000201', now() + interval '5 minutes'), false, 'Duplicate grants are rejected');

select is(
  (select status from public.create_devotional_submission(repeat('a', 64), 'Test devotional', 'grant-test-devotional', 'John 1:1', 'KJV', 'A verse', 'A message', 'An application', 'A prayer')),
  'submitted', 'A grant can submit a devotional'
);
select is(
  (select status from public.devotionals where slug = 'grant-test-devotional'),
  'pending_review', 'Submitted devotionals require review'
);
select is(
  (select status from public.create_devotional_submission(repeat('a', 64), 'Test devotional', 'grant-test-devotional-2', 'John 1:1', 'KJV', 'A verse', 'A message', 'An application', 'A prayer')),
  'invalid_grant', 'A submission grant cannot be reused'
);

select * from finish();
rollback;
