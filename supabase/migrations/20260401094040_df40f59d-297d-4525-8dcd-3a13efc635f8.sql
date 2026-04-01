
-- Production tasks table
CREATE TABLE public.production_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  budget_id UUID REFERENCES public.budgets(id) ON DELETE SET NULL,
  project_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  assignee TEXT,
  due_date DATE,
  stage TEXT NOT NULL DEFAULT 'corte' CHECK (stage IN ('corte', 'borda', 'usinagem', 'montagem')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.production_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own production tasks" ON public.production_tasks
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own production tasks" ON public.production_tasks
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own production tasks" ON public.production_tasks
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own production tasks" ON public.production_tasks
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Financial transactions table
CREATE TABLE public.financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  recurrence TEXT DEFAULT 'none' CHECK (recurrence IN ('none', 'monthly', 'weekly', 'yearly')),
  is_fixed BOOLEAN NOT NULL DEFAULT false,
  payment_method TEXT,
  budget_id UUID REFERENCES public.budgets(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions" ON public.financial_transactions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own transactions" ON public.financial_transactions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own transactions" ON public.financial_transactions
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own transactions" ON public.financial_transactions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Employees / team members table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'production' CHECK (role IN ('admin', 'manager', 'sales', 'production', 'assembly', 'partner')),
  email TEXT,
  phone TEXT,
  cpf TEXT,
  salary NUMERIC DEFAULT 0,
  hire_date DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own employees" ON public.employees
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own employees" ON public.employees
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own employees" ON public.employees
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own employees" ON public.employees
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Company settings table
CREATE TABLE public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name TEXT,
  cnpj TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  cep TEXT,
  default_margin NUMERIC DEFAULT 40,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.company_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own settings" ON public.company_settings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own settings" ON public.company_settings
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Enable realtime for production tasks
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_tasks;
