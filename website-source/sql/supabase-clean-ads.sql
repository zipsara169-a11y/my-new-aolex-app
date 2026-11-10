-- APLEX Movies: remove legacy advertisement code/data while preserving normal download buttons.
-- Run this once in Supabase SQL Editor for an EXISTING project.
-- It copies valid download_button URLs to site_download_buttons, deletes other ad placements,
-- and drops the old public.site_ads table (including its ad_code column and policies).

begin;

alter table public.movies add column if not exists language text;

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

-- Migrate existing normal download links only. All banner/popup/inline ad records are discarded.
do $$
begin
  if to_regclass('public.site_ads') is not null then
    alter table public.site_ads add column if not exists button_text text not null default '';
    execute $copy$
      insert into public.site_download_buttons
        (id, name, button_text, target_url, is_active, sort_order, created_at, updated_at)
      select id, name, coalesce(nullif(button_text, ''), name), target_url,
             is_active, sort_order, created_at, updated_at
      from public.site_ads
      where placement = 'download_button'
        and target_url is not null
        and length(trim(target_url)) > 0
      on conflict (id) do update set
        name = excluded.name,
        button_text = excluded.button_text,
        target_url = excluded.target_url,
        is_active = excluded.is_active,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at
    $copy$;
    drop table public.site_ads;
  end if;
end $$;

create index if not exists site_download_buttons_active_order_idx
  on public.site_download_buttons(is_active, sort_order, created_at);

alter table public.site_download_buttons enable row level security;
drop policy if exists "Public can read enabled download buttons" on public.site_download_buttons;
create policy "Public can read enabled download buttons" on public.site_download_buttons
for select to anon, authenticated using (is_active = true);
drop policy if exists "Admins manage download buttons" on public.site_download_buttons;
create policy "Admins manage download buttons" on public.site_download_buttons
for all to authenticated using (public.is_movie_admin()) with check (public.is_movie_admin());

grant select on public.site_download_buttons to anon, authenticated;
grant insert, update, delete on public.site_download_buttons to authenticated;

commit;
