ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS complexity_factor numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS finish_type text;