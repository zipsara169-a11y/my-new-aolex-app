-- APLEX Movies global seasonal theme setting (existing Supabase project)
-- Run once in Supabase SQL Editor. Safe to re-run.

create table if not exists public.site_settings (
  setting_key text primary key,
  setting_value text not null,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (setting_key, setting_value)
values ('active_theme', 'ruby')
on conflict (setting_key) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "Public can read active site theme" on public.site_settings;
create policy "Public can read active site theme" on public.site_settings
for select to anon, authenticated using (setting_key = 'active_theme');

drop policy if exists "Admins manage site settings" on public.site_settings;
create policy "Admins manage site settings" on public.site_settings
for all to authenticated using (public.is_movie_admin()) with check (public.is_movie_admin());

grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;
