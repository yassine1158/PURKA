-- PURCA : schéma de la base Supabase
-- À exécuter une seule fois dans Supabase > SQL Editor.

-- Administrateurs autorisés (e-mails des comptes créés dans Authentication > Users)
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where email = auth.jwt() ->> 'email');
$$;

-- Demandes de devis envoyées depuis le site
create table if not exists public.quotes (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  company text not null check (char_length(company) between 1 and 200),
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 200),
  grade text check (grade in ('TSR10', 'TSR20', 'TSR10 + TSR20')),
  volume integer check (volume is null or volume between 1 and 1000000),
  country text check (country is null or char_length(country) <= 100),
  message text check (message is null or char_length(message) <= 4000),
  lang text check (lang in ('fr', 'en')),
  status text not null default 'nouveau' check (status in ('nouveau', 'en_cours', 'traite'))
);
alter table public.quotes enable row level security;

drop policy if exists "Visiteurs : envoyer une demande" on public.quotes;
create policy "Visiteurs : envoyer une demande" on public.quotes
  for insert to anon, authenticated
  with check (status = 'nouveau');

drop policy if exists "Admins : lire" on public.quotes;
create policy "Admins : lire" on public.quotes
  for select to authenticated using (public.is_admin());

drop policy if exists "Admins : modifier" on public.quotes;
create policy "Admins : modifier" on public.quotes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins : supprimer" on public.quotes;
create policy "Admins : supprimer" on public.quotes
  for delete to authenticated using (public.is_admin());

-- Coordonnées affichées sur le site
create table if not exists public.settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;

drop policy if exists "Tous : lire" on public.settings;
create policy "Tous : lire" on public.settings
  for select to anon, authenticated using (true);

drop policy if exists "Admins : modifier" on public.settings;
create policy "Admins : modifier" on public.settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.settings (key, value) values
  ('email', ''),
  ('phone', ''),
  ('address_fr', ''),
  ('address_en', '')
on conflict (key) do nothing;

-- Remplacer par l'e-mail du compte administrateur
insert into public.admins (email) values ('admin@exemple.com')
on conflict (email) do nothing;
