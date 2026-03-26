
-- Clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  cpf_cnpj TEXT,
  cep TEXT,
  address TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  total_spent NUMERIC DEFAULT 0,
  budgets_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clients" ON public.clients
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own clients" ON public.clients
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete own clients" ON public.clients
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Budgets table
CREATE TABLE public.budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  project_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'expired')),
  total_cost NUMERIC NOT NULL DEFAULT 0,
  profit_margin NUMERIC NOT NULL DEFAULT 40,
  final_price NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budgets" ON public.budgets
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert own budgets" ON public.budgets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own budgets" ON public.budgets
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete own budgets" ON public.budgets
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Budget items table
CREATE TABLE public.budget_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID REFERENCES public.budgets(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  material_cost NUMERIC NOT NULL DEFAULT 0,
  labor_cost NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0
);

ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage budget items via budget" ON public.budget_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.budgets WHERE budgets.id = budget_items.budget_id AND budgets.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.budgets WHERE budgets.id = budget_items.budget_id AND budgets.user_id = auth.uid()));

-- Sequence for budget codes
CREATE SEQUENCE public.budget_code_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_budget_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.code := 'ORC-' || LPAD(nextval('public.budget_code_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_budget_code
  BEFORE INSERT ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_budget_code();
