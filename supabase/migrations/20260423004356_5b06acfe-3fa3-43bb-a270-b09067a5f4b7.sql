CREATE TABLE IF NOT EXISTS public.material_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'un',
  supplier text,
  source text NOT NULL DEFAULT 'manual',
  notes text,
  import_batch text,
  last_imported_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.material_catalog ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS material_catalog_user_name_idx
  ON public.material_catalog (user_id, lower(name));

CREATE INDEX IF NOT EXISTS material_catalog_user_source_idx
  ON public.material_catalog (user_id, source);

CREATE POLICY "Users can view own materials"
ON public.material_catalog
FOR SELECT
USING (public.can_access_data(auth.uid(), user_id));

CREATE POLICY "Users can insert own materials"
ON public.material_catalog
FOR INSERT
WITH CHECK ((user_id = auth.uid()) OR (user_id = public.get_data_owner_id(auth.uid())));

CREATE POLICY "Users can update own materials"
ON public.material_catalog
FOR UPDATE
USING (public.can_access_data(auth.uid(), user_id));

CREATE POLICY "Users can delete own materials"
ON public.material_catalog
FOR DELETE
USING (public.can_access_data(auth.uid(), user_id));

CREATE TRIGGER set_material_catalog_updated_at
BEFORE UPDATE ON public.material_catalog
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.financial_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  color text,
  is_system boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT financial_categories_type_check CHECK (type IN ('income', 'expense'))
);

ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS financial_categories_user_type_slug_idx
  ON public.financial_categories (user_id, type, lower(slug));

CREATE INDEX IF NOT EXISTS financial_categories_user_type_order_idx
  ON public.financial_categories (user_id, type, sort_order, name);

CREATE POLICY "Users can view own financial categories"
ON public.financial_categories
FOR SELECT
USING (public.can_access_data(auth.uid(), user_id));

CREATE POLICY "Users can insert own financial categories"
ON public.financial_categories
FOR INSERT
WITH CHECK ((user_id = auth.uid()) OR (user_id = public.get_data_owner_id(auth.uid())));

CREATE POLICY "Users can update own financial categories"
ON public.financial_categories
FOR UPDATE
USING (public.can_access_data(auth.uid(), user_id));

CREATE POLICY "Users can delete own financial categories"
ON public.financial_categories
FOR DELETE
USING (public.can_access_data(auth.uid(), user_id));

CREATE TRIGGER set_financial_categories_updated_at
BEFORE UPDATE ON public.financial_categories
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();