grant update, delete on table public.event_registrations to authenticated;

create policy "Admins can update event registrations"
  on public.event_registrations
  for update
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can delete event registrations"
  on public.event_registrations
  for delete
  to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');