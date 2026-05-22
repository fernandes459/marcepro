-- Backfill approved_at for legacy closed budgets (use updated_at as best-effort approval date)
UPDATE public.budgets
SET approved_at = COALESCE(approved_at, updated_at, created_at)
WHERE status IN ('approved', 'in_production')
  AND approved_at IS NULL;

-- Add lost_reason column (structured, separate from notes blob)
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Index to speed up period filters by approval date
CREATE INDEX IF NOT EXISTS idx_budgets_approved_at ON public.budgets(approved_at);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON public.budgets(status);