alter table public.devotional_contributors
  drop constraint if exists devotional_contributors_auth_user_id_fkey;
alter table public.devotional_contributors
  add constraint devotional_contributors_auth_user_id_fkey
  foreign key (auth_user_id) references auth.users(id) on delete cascade;

alter table public.devotional_applications
  drop constraint if exists devotional_applications_contributor_id_fkey;
alter table public.devotional_applications
  add constraint devotional_applications_contributor_id_fkey
  foreign key (contributor_id)
  references public.devotional_contributors(id) on delete cascade;

alter table public.devotionals
  drop constraint if exists devotionals_contributor_id_fkey;
alter table public.devotionals
  add constraint devotionals_contributor_id_fkey
  foreign key (contributor_id)
  references public.devotional_contributors(id) on delete cascade;
