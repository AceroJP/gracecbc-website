alter table public.devotional_reactions
  add column if not exists visitor_name text
  check (visitor_name is null or char_length(btrim(visitor_name)) between 1 and 80);

create table if not exists public.devotional_comments (
  id uuid primary key default gen_random_uuid(),
  devotional_id uuid not null references public.devotionals(id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 1 and 80),
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists devotional_comments_devotional_created_idx
  on public.devotional_comments (devotional_id, created_at desc, id desc);

alter table public.devotional_comments enable row level security;
revoke all on public.devotional_comments from public, anon, authenticated;
grant select on public.devotional_comments to anon, authenticated;
grant delete on public.devotional_comments to authenticated;
grant all on public.devotional_comments to service_role;

drop policy if exists "Public can read comments on published devotionals" on public.devotional_comments;
create policy "Public can read comments on published devotionals"
  on public.devotional_comments for select to anon, authenticated
  using (exists (
    select 1 from public.devotionals d
    where d.id = devotional_comments.devotional_id and d.status = 'published'
  ));

drop policy if exists "Admins can delete devotional comments" on public.devotional_comments;
create policy "Admins can delete devotional comments"
  on public.devotional_comments for delete to authenticated
  using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.toggle_devotional_reaction(
  p_devotional_id uuid,
  p_visitor_identifier_hash text,
  p_action text
)
returns table (liked boolean, reaction_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_rows integer;
begin
  if p_action is null
    or p_visitor_identifier_hash is null
    or p_action not in ('like', 'unlike')
    or p_visitor_identifier_hash !~ '^[a-f0-9]{64}$' then
    return query select false, 0;
    return;
  end if;

  perform 1 from public.devotionals d
   where d.id = p_devotional_id and d.status = 'published' for update;
  if not found then
    return query select false, 0;
    return;
  end if;

  if p_action = 'like' then
    insert into public.devotional_reactions (devotional_id, visitor_identifier_hash)
    values (p_devotional_id, p_visitor_identifier_hash)
    on conflict (devotional_id, visitor_identifier_hash) do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 1 then
      update public.devotionals d
         set reaction_count = d.reaction_count + 1, updated_at = now()
       where d.id = p_devotional_id returning d.reaction_count into v_count;
    else
      select d.reaction_count into v_count from public.devotionals d where d.id = p_devotional_id;
    end if;
  else
    delete from public.devotional_reactions r
     where r.devotional_id = p_devotional_id and r.visitor_identifier_hash = p_visitor_identifier_hash;
    if found then
      update public.devotionals d
         set reaction_count = greatest(d.reaction_count - 1, 0), updated_at = now()
       where d.id = p_devotional_id returning d.reaction_count into v_count;
    else
      select d.reaction_count into v_count from public.devotionals d where d.id = p_devotional_id;
    end if;
  end if;
  return query select p_action = 'like', v_count;
end;
$$;

create or replace function public.toggle_named_devotional_reaction(
  p_devotional_id uuid,
  p_visitor_identifier_hash text,
  p_action text,
  p_visitor_name text
)
returns table (liked boolean, reaction_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result record;
begin
  if p_action = 'like' and (p_visitor_name is null or char_length(btrim(p_visitor_name)) not between 1 and 80) then
    raise exception 'A name is required';
  end if;
  select * into v_result from public.toggle_devotional_reaction(p_devotional_id, p_visitor_identifier_hash, p_action);
  if p_action = 'like' and v_result.liked then
    update public.devotional_reactions r set visitor_name = btrim(p_visitor_name)
     where r.devotional_id = p_devotional_id and r.visitor_identifier_hash = p_visitor_identifier_hash;
  end if;
  if p_action = 'like' and not v_result.liked then
    raise exception 'Devotional is unavailable';
  end if;
  return query select v_result.liked, v_result.reaction_count;
end;
$$;

create or replace function public.create_devotional_comment(
  p_devotional_id uuid,
  p_author_name text,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_author_name is null or char_length(btrim(p_author_name)) not between 1 and 80
    or p_content is null or char_length(btrim(p_content)) not between 1 and 2000 then
    raise exception 'Invalid comment';
  end if;
  perform 1 from public.devotionals d where d.id = p_devotional_id and d.status = 'published' for share;
  if not found then
    raise exception 'Devotional is unavailable';
  end if;
  insert into public.devotional_comments (devotional_id, author_name, content)
  values (p_devotional_id, btrim(p_author_name), btrim(p_content)) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.toggle_devotional_reaction(uuid, text, text) from public, anon, authenticated;
revoke all on function public.toggle_named_devotional_reaction(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.create_devotional_comment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.toggle_devotional_reaction(uuid, text, text) to service_role;
grant execute on function public.toggle_named_devotional_reaction(uuid, text, text, text) to service_role;
grant execute on function public.create_devotional_comment(uuid, text, text) to service_role;

notify pgrst, 'reload schema';
