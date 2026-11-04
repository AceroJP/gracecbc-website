alter table public.announcements
  drop constraint if exists announcements_categories_check;

alter table public.announcements
  add constraint announcements_categories_check check (
    array_position(categories, null) is null
    and array_position(categories, '') is null
    and cardinality(categories) <= 10
  );