alter table public.founder_inputs
  add column if not exists target_audience text;
-- After applying in Studio, refresh REST:
-- NOTIFY pgrst, 'reload schema';
