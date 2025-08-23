alter table public.founder_inputs
  add column if not exists target_audience text;

alter table public.sessions
  add column if not exists status text default 'draft';
