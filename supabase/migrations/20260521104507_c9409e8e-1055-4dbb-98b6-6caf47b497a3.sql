UPDATE public.budgets
SET approved_at = updated_at
WHERE status IN ('approved', 'in_production')
  AND approved_at IS NULL;