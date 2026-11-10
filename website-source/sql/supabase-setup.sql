-- APLEX MOVIES: paste the whole file into Supabase SQL Editor and click Run.
-- Then create an Auth user and manually add its UID to public.site_admins (instructions in README-SI.txt).

create extension if not exists pgcrypto;

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now()
);
insert into public.site_settings (setting_key, setting_value) values ('active_theme', 'ruby') on conflict (setting_key) do nothing;

create table if not exists public.movie_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.movies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  imdb_id text not null unique,
  tmdb_id integer,
  overview text not null default '',
  release_date date,
  language text,
  runtime integer check (runtime is null or runtime >= 0),
  rating numeric(3,1) check (rating is null or (rating >= 0 and rating <= 10)),
  genres text not null default '',
  poster_url text,
  backdrop_url text,
  trailer_key text,
  player_url text,
  download_url text,
  category_id uuid references public.movie_categories(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','published')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- Only ordinary download links are supported; no provider snippets, popups, or ad placements.
create table if not exists public.site_download_buttons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  button_text text not null default '',
  target_url text not null check (length(trim(target_url)) > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists site_download_buttons_active_order_idx
  on public.site_download_buttons(is_active, sort_order, created_at);

create index if not exists movies_status_created_idx on public.movies(status, created_at desc);
create index if not exists movies_category_idx on public.movies(category_id);
create index if not exists movies_title_idx on public.movies using gin (to_tsvector('simple', title || ' ' || coalesce(overview,'') || ' ' || coalesce(genres,'')));

create or replace function public.is_movie_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.site_admins where user_id = auth.uid());
$$;
revoke all on function public.is_movie_admin() from public;
grant execute on function public.is_movie_admin() to authenticated;

alter table public.site_admins enable row level security;
alter table public.movie_categories enable row level security;
alter table public.movies enable row level security;
alter table public.movie_players enable row level security;
alter table public.site_download_buttons enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "Admins can read their own admin row" on public.site_admins;
create policy "Admins can read their own admin row" on public.site_admins
for select to authenticated using (user_id = auth.uid());

drop policy if exists "Public can read categories" on public.movie_categories;
create policy "Public can read categories" on public.movie_categories
for select to anon, authenticated using (true);
drop policy if exists "Admins manage categories" on public.movie_categories;
create policy "Admins manage categories" on public.movie_categories
for all to authenticated using (public.is_movie_admin()) with check (public.is_movie_admin());

drop policy if exists "Public can read published movies" on public.movies;
create policy "Public can read published movies" on public.movies
for select to anon, authenticated using (status = 'published');
drop policy if exists "Admins manage movies" on public.movies;
create policy "Admins manage movies" on public.movies
for all to authenticated using (public.is_movie_admin()) with check (public.is_movie_admin());

drop policy if exists "Public can read players for published movies" on public.movie_players;
create policy "Public can read players for published movies" on public.movie_players
for select to anon, authenticated using (exists (select 1 from public.movies m where m.id = movie_players.movie_id and m.status = 'published'));
drop policy if exists "Admins manage movie players" on public.movie_players;
create policy "Admins manage movie players" on public.movie_players
for all to authenticated using (public.is_movie_admin()) with check (public.is_movie_admin());

grant select on public.movie_categories, public.movies to anon, authenticated;
grant select on public.site_admins to authenticated;
grant insert, update, delete on public.movie_categories, public.movies to authenticated;

drop policy if exists "Public can read enabled download buttons" on public.site_download_buttons;
create policy "Public can read enabled download buttons" on public.site_download_buttons
for select to anon, authenticated using (is_active = true);
drop policy if exists "Admins manage download buttons" on public.site_download_buttons;
create policy "Admins manage download buttons" on public.site_download_buttons
for all to authenticated using (public.is_movie_admin()) with check (public.is_movie_admin());

grant select on public.site_download_buttons to anon, authenticated;
grant insert, update, delete on public.site_download_buttons to authenticated;

grant select on public.movie_players to anon, authenticated;
grant insert, update, delete on public.movie_players to authenticated;

-- Public poster delivery; only signed-in admins can upload/change/delete objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('movie-artwork', 'movie-artwork', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif'];

drop policy if exists "Public can view movie artwork" on storage.objects;
create policy "Public can view movie artwork" on storage.objects
for select to anon, authenticated using (bucket_id = 'movie-artwork');
drop policy if exists "Admins can upload movie artwork" on storage.objects;
create policy "Admins can upload movie artwork" on storage.objects
for insert to authenticated with check (bucket_id = 'movie-artwork' and public.is_movie_admin());
drop policy if exists "Admins can update movie artwork" on storage.objects;
create policy "Admins can update movie artwork" on storage.objects
for update to authenticated using (bucket_id = 'movie-artwork' and public.is_movie_admin()) with check (bucket_id = 'movie-artwork' and public.is_movie_admin());
drop policy if exists "Admins can delete movie artwork" on storage.objects;
create policy "Admins can delete movie artwork" on storage.objects
for delete to authenticated using (bucket_id = 'movie-artwork' and public.is_movie_admin());

insert into public.movie_categories (name, slug, sort_order) values
 ('Action','action',1), ('Adventure','adventure',2), ('Animation','animation',3),
 ('Comedy','comedy',4), ('Crime','crime',5), ('Documentary','documentary',6),
 ('Drama','drama',7), ('Fantasy','fantasy',8), ('Horror','horror',9),
 ('Mystery','mystery',10), ('Romance','romance',11), ('Science Fiction','science-fiction',12),
 ('Thriller','thriller',13), ('War','war',14), ('Western','western',15),
 ('Sinhala Movies','sinhala-movies',16), ('Tamil Movies','tamil-movies',17), ('Bollywood','bollywood',18), ('Anime','anime',19), ('Family','family',20)
on conflict (slug) do nothing;

drop policy if exists "Public can read active site theme" on public.site_settings;
create policy "Public can read active site theme" on public.site_settings
for select to anon, authenticated using (setting_key = 'active_theme');
drop policy if exists "Admins manage site settings" on public.site_settings;
create policy "Admins manage site settings" on public.site_settings
for all to authenticated using (public.is_movie_admin()) with check (public.is_movie_admin());
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;
