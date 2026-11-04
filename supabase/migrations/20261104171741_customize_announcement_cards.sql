alter table public.announcements
  add column if not exists categories text[] not null default '{}',
  add column if not exists background_path text,
  add column if not exists background_name text;

alter table public.announcements
  drop constraint if exists announcements_presentation_check;

alter table public.announcements
  add constraint announcements_presentation_check check (
    (
      pdf_path is null
      and pdf_name is null
      and cardinality(slide_paths) = 0
      and cardinality(slide_names) = 0
    )
    or (
      pdf_path is not null
      and pdf_name is not null
      and cardinality(slide_paths) = 0
      and cardinality(slide_names) = 0
    )
    or (
      pdf_path is null
      and pdf_name is null
      and cardinality(slide_paths) between 1 and 20
      and cardinality(slide_paths) = cardinality(slide_names)
      and array_position(slide_paths, null) is null
      and array_position(slide_names, null) is null
    )
  );

alter table public.announcements
  drop constraint if exists announcements_categories_check;

alter table public.announcements
  add constraint announcements_categories_check check (
    array_position(categories, null) is null
    and categories <@ array['sunday_worship', 'prayer_meeting']::text[]
  );

alter table public.announcements
  drop constraint if exists announcements_background_check;

alter table public.announcements
  add constraint announcements_background_check check (
    (background_path is null) = (background_name is null)
  );