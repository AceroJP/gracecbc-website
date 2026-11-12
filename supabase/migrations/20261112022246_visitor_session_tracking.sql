create table public.landing_page_visitor_sessions (
  session_hash text primary key
    check (session_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

alter table public.landing_page_visitor_sessions enable row level security;

grant usage on schema public to service_role;
revoke all on table public.landing_page_visitor_sessions
  from public, anon, authenticated;
grant select, insert on table public.landing_page_visitor_sessions
  to service_role;