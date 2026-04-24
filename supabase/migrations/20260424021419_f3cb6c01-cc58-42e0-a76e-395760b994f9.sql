-- Add room/ambient grouping to budget items
ALTER TABLE public.budget_items
  ADD COLUMN IF NOT EXISTS room_label text;

-- Operational costs (fixed monthly) per user, used to amortize cost per project
CREATE TABLE IF NOT EXISTS public.operational_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  monthly_amount numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.operational_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own op costs"
  ON public.operational_costs FOR SELECT TO authenticated
  USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Users can insert own op costs"
  ON public.operational_costs FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) OR (user_id = get_data_owner_id(auth.uid())));
CREATE POLICY "Users can update own op costs"
  ON public.operational_costs FOR UPDATE TO authenticated
  USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Users can delete own op costs"
  ON public.operational_costs FOR DELETE TO authenticated
  USING (can_access_data(auth.uid(), user_id));

CREATE TRIGGER set_operational_costs_updated_at
  BEFORE UPDATE ON public.operational_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Configurable amortization basis on company_settings (avg projects/month for ratio)
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS avg_projects_per_month integer NOT NULL DEFAULT 4;