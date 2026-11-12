BEGIN;
SELECT plan(3);

SELECT ok(
  (SELECT confdeltype = 'c'
   FROM pg_constraint
   WHERE conrelid = 'public.devotional_contributors'::regclass
     AND conname = 'devotional_contributors_auth_user_id_fkey'),
  'Deleting an Auth user cascades to its contributor profile'
);

SELECT ok(
  (SELECT confdeltype = 'c'
   FROM pg_constraint
   WHERE conrelid = 'public.devotional_applications'::regclass
     AND conname = 'devotional_applications_contributor_id_fkey'),
  'Deleting a contributor cascades to their applications'
);

SELECT ok(
  (SELECT confdeltype = 'c'
   FROM pg_constraint
   WHERE conrelid = 'public.devotionals'::regclass
     AND conname = 'devotionals_contributor_id_fkey'),
  'Deleting a contributor cascades to their devotionals'
);

SELECT * FROM finish();
ROLLBACK;
