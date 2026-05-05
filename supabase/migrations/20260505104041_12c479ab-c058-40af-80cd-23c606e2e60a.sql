ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS seller_id uuid,
  ADD COLUMN IF NOT EXISTS project_type text,
  ADD COLUMN IF NOT EXISTS budget_mode text NOT NULL DEFAULT 'completo';

CREATE INDEX IF NOT EXISTS budgets_seller_id_idx ON public.budgets(seller_id);