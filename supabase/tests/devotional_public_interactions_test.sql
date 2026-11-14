begin;
select plan(14);

insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000301', 'interaction-test@example.invalid');
insert into public.devotional_contributors (id, auth_user_id, full_name, username, status, email_verified_at)
values ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000301', 'Test contributor', 'interaction-test', 'approved', now());
insert into public.devotionals (id, contributor_id, title, slug, bible_passage, bible_translation, key_verse, message, personal_application, closing_prayer, status)
values
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000302', 'Published', 'interaction-test-published', 'John 1:1', 'KJV', 'Verse', 'Message', 'Application', 'Prayer', 'published'),
  ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000302', 'Draft', 'interaction-test-draft', 'John 1:1', 'KJV', 'Verse', 'Message', 'Application', 'Prayer', 'pending_review');

select ok(not has_function_privilege('anon', 'public.toggle_named_devotional_reaction(uuid,text,text,text)', 'execute'), 'Anonymous users cannot bypass the server reaction action');
select ok(not has_function_privilege('authenticated', 'public.create_devotional_comment(uuid,text,text)', 'execute'), 'Signed-in users cannot bypass the server comment action');
select ok(has_function_privilege('service_role', 'public.create_devotional_comment(uuid,text,text)', 'execute'), 'The server can create comments');
select throws_ok($$select public.toggle_named_devotional_reaction('00000000-0000-4000-8000-000000000303', repeat('a',64), 'like', '')$$, 'P0001', 'A name is required', 'A name is required for likes');
select is((select reaction_count from public.toggle_named_devotional_reaction('00000000-0000-4000-8000-000000000303', repeat('a',64), 'like', 'Visitor')), 1, 'A named visitor can like a published devotional');
select is((select visitor_name from public.devotional_reactions where devotional_id = '00000000-0000-4000-8000-000000000303'), 'Visitor', 'The name is stored with the reaction');
select is((select reaction_count from public.toggle_named_devotional_reaction('00000000-0000-4000-8000-000000000303', repeat('a',64), 'like', 'Visitor')), 1, 'The same browser cannot like twice');
select is((select reaction_count from public.toggle_named_devotional_reaction('00000000-0000-4000-8000-000000000303', repeat('a',64), 'unlike', '')), 0, 'A visitor can remove their reaction');
select throws_ok($$select public.toggle_named_devotional_reaction('00000000-0000-4000-8000-000000000304', repeat('a',64), 'like', 'Visitor')$$, 'P0001', 'Devotional is unavailable', 'Draft devotionals cannot receive reactions');
select throws_ok($$select public.create_devotional_comment('00000000-0000-4000-8000-000000000304', 'Visitor', 'Hello')$$, 'P0001', 'Devotional is unavailable', 'Draft devotionals cannot receive comments');
select throws_ok($$select public.create_devotional_comment('00000000-0000-4000-8000-000000000303', '', 'Hello')$$, 'P0001', 'Invalid comment', 'Comments require a name');
select ok(public.create_devotional_comment('00000000-0000-4000-8000-000000000303', 'Visitor', 'Hello') is not null, 'A public visitor can comment on a published devotional');
insert into public.devotional_comments (devotional_id, author_name, content) values ('00000000-0000-4000-8000-000000000304', 'Visitor', 'Private draft comment');
set local role anon;
select is((select count(*) from public.devotional_comments where author_name = 'Visitor' and devotional_id in ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000304')), 1::bigint, 'Public readers can see only comments on published devotionals');
select throws_ok($$insert into public.devotional_comments (devotional_id, author_name, content) values ('00000000-0000-4000-8000-000000000303', 'Visitor', 'Bypass')$$, '42501', null, 'Anonymous users cannot directly insert comments');
reset role;
select * from finish();
rollback;
