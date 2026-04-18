ALTER TABLE public.company_settings 
  ADD COLUMN IF NOT EXISTS min_margin numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS default_commission numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_goal numeric NOT NULL DEFAULT 0;