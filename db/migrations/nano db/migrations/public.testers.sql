-- Extensions used below
create extension if not exists citext;

-- Ensure testers table exists (skip if you already have it)
create table if not exists public.testers (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  display_name text,
  telegram_handle text,
  wallet_address text,
  created_at timestamptz not null default now()
);

-- ✅ Add user_id if missing
alter table public.testers
  add column if not exists user_id uuid;

-- ✅ Unique on user_id when present (one tester row per auth user)
create unique index if not exists testers_user_id_unique
  on public.testers(user_id) where user_id is not null;

-- ✅ FK to auth.users(id)
alter table public.testers
  drop constraint if exists testers_user_id_fk;
alter table public.testers
  add constraint testers_user_id_fk
  foreign key (user_id) references auth.users(id) on delete cascade;

-- ✅ Backfill user_id from email, if possible
update public.testers t
set user_id = u.id
from auth.users u
where t.user_id is null
  and lower(t.email) = lower(u.email);

-- ✅ RLS and policies
alter table public.testers enable row level security;

drop policy if exists "testers can view self" on public.testers;
drop policy if exists "testers can insert self" on public.testers;
drop policy if exists "testers can update self" on public.testers;

create policy "testers can view self"
  on public.testers for select
  using (auth.uid() = user_id);

create policy "testers can insert self"
  on public.testers for insert
  with check (auth.uid() = user_id);

create policy "testers can update self"
  on public.testers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Replace public.responses with your actual table name (e.g., public.responses_sb)
alter table public.responses add column if not exists tester_id uuid;
create index if not exists responses_tester_id_idx on public.responses(tester_id);

alter table public.responses enable row level security;

drop policy if exists "tester can see own responses" on public.responses;
create policy "tester can see own responses"
  on public.responses for select
  using (tester_id = auth.uid());
