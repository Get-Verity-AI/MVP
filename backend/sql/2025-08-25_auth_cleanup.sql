-- Enable uuid generator
create extension if not exists pgcrypto;

-- FOUNDERS
update public.founders set id = gen_random_uuid() where id is null;
alter table public.founders
  alter column id set default gen_random_uuid(),
  alter column id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'founders_email_key') then
    alter table public.founders add constraint founders_email_key unique (email);
  end if;
end $$;

alter table public.founders drop column if exists password_hash;

-- TESTERS
update public.testers set id = gen_random_uuid() where id is null;
alter table public.testers
  alter column id set default gen_random_uuid(),
  alter column id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'testers_email_key') then
    alter table public.testers add constraint testers_email_key unique (email);
  end if;
end $$;

alter table public.testers drop column if exists password_hash;

-- Reminder to refresh Supabase schema cache (run in dashboard SQL):
-- select pg_notify('pgrst', 'reload schema');
