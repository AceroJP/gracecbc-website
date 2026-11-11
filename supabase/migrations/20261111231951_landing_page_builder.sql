create table public.landing_page_drafts (
  id boolean primary key default true check (id),
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.landing_page_published (
  id boolean primary key default true check (id),
  content jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default now()
);

alter table public.landing_page_drafts enable row level security;
alter table public.landing_page_published enable row level security;
grant usage on schema public to anon, authenticated;

revoke all on table public.landing_page_drafts
  from public, anon, authenticated;
revoke all on table public.landing_page_published
  from public, anon, authenticated;
grant select, insert, update, delete on table public.landing_page_drafts
  to authenticated;
grant select on table public.landing_page_published to anon, authenticated;
grant insert, update, delete on table public.landing_page_published
  to authenticated;
grant all on table public.landing_page_drafts,
  public.landing_page_published to service_role;

create policy "Admins can manage landing page drafts"
  on public.landing_page_drafts
  for all
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Public can read published landing page"
  on public.landing_page_published
  for select
  to anon, authenticated
  using (true);

create policy "Admins can manage published landing page"
  on public.landing_page_published
  for all
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into public.landing_page_drafts (id, content)
values (
  true,
  '{
    "sectionOrder": ["hero", "welcome", "schedule", "livestream", "announcements", "events", "devotionals", "contact"],
    "visibility": {
      "hero": false,
      "welcome": false,
      "schedule": false,
      "livestream": false,
      "announcements": true,
      "events": true,
      "devotionals": false,
      "contact": false
    },
    "hero": {
      "headline": "",
      "subtext": "",
      "image": {"path": null, "alt": ""},
      "buttons": []
    },
    "welcome": {
      "text": "",
      "image": {"path": null, "alt": ""}
    },
    "schedule": {"rows": []},
    "livestream": {"url": "", "label": ""},
    "contact": {
      "address": "",
      "phone": "",
      "email": "",
      "facebookUrl": "",
      "mapUrl": ""
    },
    "devotionals": {"count": 3},
    "announcements": {
      "title": "Announcements",
      "intro": "",
      "count": 3,
      "pinnedId": null
    },
    "events": {
      "title": "Events",
      "intro": "",
      "count": 3
    }
  }'::jsonb
);

insert into public.landing_page_published (id, content)
select id, content from public.landing_page_drafts;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'landing-page-images',
  'landing-page-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins can upload landing page images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'landing-page-images'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Admins can update landing page images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'landing-page-images'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'landing-page-images'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

create policy "Admins can delete landing page images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'landing-page-images'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );