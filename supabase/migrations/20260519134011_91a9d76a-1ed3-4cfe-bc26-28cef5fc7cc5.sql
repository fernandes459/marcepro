-- Material multiplier per budget (item 3: 1x/2x/3x regional pricing)
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS material_multiplier numeric NOT NULL DEFAULT 1;

-- Region pricing presets (for the configurable m² value)
CREATE TABLE IF NOT EXISTS public.region_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  name text NOT NULL,
  multiplier numeric NOT NULL DEFAULT 1,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.region_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view region_pricing" ON public.region_pricing
  FOR SELECT TO authenticated USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Members insert region_pricing" ON public.region_pricing
  FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()) OR (user_id = get_data_owner_id(auth.uid())));
CREATE POLICY "Members update region_pricing" ON public.region_pricing
  FOR UPDATE TO authenticated USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Members delete region_pricing" ON public.region_pricing
  FOR DELETE TO authenticated USING (can_access_data(auth.uid(), user_id));

CREATE TRIGGER region_pricing_set_updated BEFORE UPDATE ON public.region_pricing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER region_pricing_set_company BEFORE INSERT ON public.region_pricing
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();