-- APLEX Movies: per-title magnet links for content the site owner is authorized to distribute.
-- Run this once in Supabase SQL Editor after your existing APLEX Supabase setup.

create table if not exists public.title_magnet_links (
  id uuid primary key default gen_random_uuid(),
  tmdb_id bigint not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  yts_title text not null default '',
  yts_year integer check (yts_year is null or yts_year between 1870 and 2200),
  quality text not null default 'Authorized magnet',
  magnet_uri text not null check (magnet_uri ~* '^magnet:[?]xt=urn:btih:([a-f0-9]{40}|[a-z2-7]{32})(&|$)'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tmdb_id, media_type)
);

create index if not exists title_magnet_links_active_lookup_idx
  on public.title_magnet_links (tmdb_id, media_type, is_active);

alter table public.title_magnet_links enable row level security;

drop policy if exists "Public can read enabled title magnet links" on public.title_magnet_links;
create policy "Public can read enabled title magnet links"
  on public.title_magnet_links
  for select to anon, authenticated
  using (is_active = true);

drop policy if exists "Admins manage title magnet links" on public.title_magnet_links;
create policy "Admins manage title magnet links"
  on public.title_magnet_links
  for all to authenticated
  using (public.is_movie_admin())
  with check (public.is_movie_admin());

grant select on public.title_magnet_links to anon, authenticated;
grant insert, update, delete on public.title_magnet_links to authenticated;
