do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'landing_page_published'
  ) then
    execute 'alter publication supabase_realtime add table public.landing_page_published';
  end if;
end
$$;