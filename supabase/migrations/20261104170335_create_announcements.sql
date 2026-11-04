create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  body text not null default '' check (char_length(body) <= 3000),
  pdf_path text,
  pdf_name text,
  slide_paths text[] not null default '{}',
  slide_names text[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.announcements'::regclass
       and conname = 'announcements_presentation_check'
  ) then
    alter table public.announcements
      add constraint announcements_presentation_check check (
        (
          pdf_path is not null
          and pdf_name is not null
          and cardinality(slide_paths) = 0
          and cardinality(slide_names) = 0
        )
        or (
          pdf_path is null
          and pdf_name is null
          and cardinality(slide_paths) > 0
          and cardinality(slide_paths) <= 20
          and cardinality(slide_paths) = cardinality(slide_names)
          and array_position(slide_paths, null) is null
          and array_position(slide_names, null) is null
        )
      );
  end if;
end;
$$;

create index if not exists announcements_published_created_at_idx
  on public.announcements (archived_at, created_at desc);

alter table public.announcements enable row level security;

revoke all on table public.announcements from public, anon, authenticated;
grant select on table public.announcements to anon, authenticated;
grant insert, update, delete on table public.announcements to authenticated;
grant all on table public.announcements to service_role;

drop policy if exists "Public can read published announcements"
  on public.announcements;
create policy "Public can read published announcements"
  on public.announcements
  for select
  to anon, authenticated
  using (archived_at is null);

drop policy if exists "Admins can view all announcements"
  on public.announcements;
create policy "Admins can view all announcements"
  on public.announcements
  for select
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can create announcements"
  on public.announcements;
create policy "Admins can create announcements"
  on public.announcements
  for insert
  to authenticated
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can update announcements"
  on public.announcements;
create policy "Admins can update announcements"
  on public.announcements
  for update
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admins can delete announcements"
  on public.announcements;
create policy "Admins can delete announcements"
  on public.announcements
  for delete
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'church-announcements',
  'church-announcements',
  true,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload announcement presentation files"
  on storage.objects;
create policy "Admins can upload announcement presentation files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'church-announcements'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Admins can update announcement presentation files"
  on storage.objects;
create policy "Admins can update announcement presentation files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'church-announcements'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'church-announcements'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

drop policy if exists "Admins can delete announcement presentation files"
  on storage.objects;
create policy "Admins can delete announcement presentation files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'church-announcements'
    and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );