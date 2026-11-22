-- APLEX MOVIES: TMDB-linked direct download URLs
-- Run once in Supabase SQL Editor.
-- Store only URLs for files you own or are authorized to distribute.

create table if not exists public.title_direct_links (
  id uuid primary key default gen_random_uuid(),
  tmdb_id bigint not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  quality text not null check (quality in ('480p', '720p', '1080p', '4K', 'Other')),
  button_text text not null default 'Download',
  direct_url text not null check (direct_url ~* '^https?://'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tmdb_id, media_type, quality)
);

alter table public.title_direct_links enable row level security;

drop policy if exists "Public can read active title direct links" on public.title_direct_links;
create policy "Public can read active title direct links"
  on public.title_direct_links for select
  using (is_active = true);

drop policy if exists "Admins can read all title direct links" on public.title_direct_links;
create policy "Admins can read all title direct links"
  on public.title_direct_links for select to authenticated
  using (exists (select 1 from public.site_admins where site_admins.user_id = auth.uid()));

drop policy if exists "Admins can insert title direct links" on public.title_direct_links;
create policy "Admins can insert title direct links"
  on public.title_direct_links for insert to authenticated
  with check (exists (select 1 from public.site_admins where site_admins.user_id = auth.uid()));

drop policy if exists "Admins can update title direct links" on public.title_direct_links;
create policy "Admins can update title direct links"
  on public.title_direct_links for update to authenticated
  using (exists (select 1 from public.site_admins where site_admins.user_id = auth.uid()))
  with check (exists (select 1 from public.site_admins where site_admins.user_id = auth.uid()));

drop policy if exists "Admins can delete title direct links" on public.title_direct_links;
create policy "Admins can delete title direct links"
  on public.title_direct_links for delete to authenticated
  using (exists (select 1 from public.site_admins where site_admins.user_id = auth.uid()));

grant select on public.title_direct_links to anon, authenticated;
grant insert, update, delete on public.title_direct_links to authenticated;
