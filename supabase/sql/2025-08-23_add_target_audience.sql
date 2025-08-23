alter table public.founder_inputs
  add column if not exists target_audience text;
-- After applying in Studio, you can refresh the REST layer with:
-- NOTIFY pgrst, 'reload schema';
