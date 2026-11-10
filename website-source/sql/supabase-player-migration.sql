-- APLEX MOVIES: add support for multiple player links per movie.
-- Run this file once in Supabase Dashboard -> SQL Editor for an existing project.
-- Adds download_url, supports multiple player links, removes the old hard-coded VidSrc demo URL,
-- and copies only other existing custom single-player URLs into Player 1.

create extension if not exists pgcrypto;

alter table public.movies add column if not exists download_url text;

create table if not exists public.movie_players (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid not null references public.movies(id) on delete cascade,
  label text not null default 'Player 1',
  player_url text not null check (length(trim(player_url)) > 0),
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists movie_players_movie_order_idx
  on public.movie_players(movie_id, sort_order, created_at);

-- Remove the previously hard-coded example URL if it was saved into old data.
update public.movies
set player_url = null
where regexp_replace(lower(split_part(split_part(trim(player_url), '?', 1), '#', 1)), '/+$', '') = 'https://vidsrc.to/embed/movie/19995';

delete from public.movie_players
where regexp_replace(lower(split_part(split_part(trim(player_url), '?', 1), '#', 1)), '/+$', '') = 'https://vidsrc.to/embed/movie/19995';

alter table public.movie_players enable row level security;

drop policy if exists "Public can read players for published movies" on public.movie_players;
create policy "Public can read players for published movies" on public.movie_players
for select to anon, authenticated
using (exists (
  select 1 from public.movies m
  where m.id = movie_players.movie_id and m.status = 'published'
));

drop policy if exists "Admins manage movie players" on public.movie_players;
create policy "Admins manage movie players" on public.movie_players
for all to authenticated
using (public.is_movie_admin())
with check (public.is_movie_admin());

grant select on public.movie_players to anon, authenticated;
grant insert, update, delete on public.movie_players to authenticated;

-- Backfill the previous single custom player URL as Player 1 without overwriting player lists.
insert into public.movie_players (movie_id, label, player_url, sort_order)
select m.id, 'Player 1', m.player_url, 1
from public.movies m
where m.player_url is not null
  and length(trim(m.player_url)) > 0
  and regexp_replace(lower(split_part(split_part(trim(m.player_url), '?', 1), '#', 1)), '/+$', '') <> 'https://vidsrc.to/embed/movie/19995'
  and not exists (
    select 1 from public.movie_players mp where mp.movie_id = m.id
  );
