-- Customer profile data for TallyLink accounts.
-- Email/password credentials and verified email remain managed by Supabase Auth.
create table if not exists public.tl_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  mobile text not null default '',
  business_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tl_profiles enable row level security;
revoke all on public.tl_profiles from anon, authenticated;
grant select, update on public.tl_profiles to authenticated;

create policy "tl_users_can_read_own_profile"
  on public.tl_profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "tl_users_can_update_own_profile"
  on public.tl_profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.tl_create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tl_profiles (id, full_name, mobile, business_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'mobile', ''),
    coalesce(new.raw_user_meta_data ->> 'business_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists tl_on_auth_user_created_profile on auth.users;
create trigger tl_on_auth_user_created_profile
  after insert on auth.users
  for each row execute procedure public.tl_create_profile_for_new_user();
