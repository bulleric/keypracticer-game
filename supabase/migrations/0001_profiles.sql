-- Keypracticer Game: one saved profile per player.
-- Run this once in the Supabase SQL editor (or `supabase db push`).

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- The whole game profile (stars, streak, badges, settings), as the app saves it.
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Every player can only read and write their own row.
alter table public.profiles enable row level security;

create policy "Players read their own profile" on public.profiles
  for select using (auth.uid() = user_id);
create policy "Players create their own profile" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "Players update their own profile" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- "Delete account" in the app (an App Store requirement). Deleting the auth
-- user removes the profile too (on delete cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
