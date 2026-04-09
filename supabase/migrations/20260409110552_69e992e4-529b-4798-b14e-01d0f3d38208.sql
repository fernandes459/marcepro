
-- Add owner_id to user_roles to track which admin invited the collaborator
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS owner_id uuid;

-- Function to get the data owner for a user (returns the admin's user_id if the user is a team member, or the user's own id if they are admin)
CREATE OR REPLACE FUNCTION public.get_data_owner_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.user_roles WHERE user_id = _user_id AND owner_id IS NOT NULL LIMIT 1),
    _user_id
  )
$$;

-- Helper: check if user can access data owned by a specific user_id
CREATE OR REPLACE FUNCTION public.can_access_data(_user_id uuid, _data_owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _data_owner_id = _user_id
    OR _data_owner_id = public.get_data_owner_id(_user_id)
$$;

-- ===================== UPDATE RLS POLICIES =====================

-- CLIENTS
DROP POLICY IF EXISTS "Users can view own clients" ON public.clients;
CREATE POLICY "Users can view own clients" ON public.clients FOR SELECT TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can insert own clients" ON public.clients;
CREATE POLICY "Users can insert own clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id = public.get_data_owner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own clients" ON public.clients;
CREATE POLICY "Users can update own clients" ON public.clients FOR UPDATE TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own clients" ON public.clients;
CREATE POLICY "Users can delete own clients" ON public.clients FOR DELETE TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

-- BUDGETS
DROP POLICY IF EXISTS "Users can view own budgets" ON public.budgets;
CREATE POLICY "Users can view own budgets" ON public.budgets FOR SELECT TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can insert own budgets" ON public.budgets;
CREATE POLICY "Users can insert own budgets" ON public.budgets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id = public.get_data_owner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own budgets" ON public.budgets;
CREATE POLICY "Users can update own budgets" ON public.budgets FOR UPDATE TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own budgets" ON public.budgets;
CREATE POLICY "Users can delete own budgets" ON public.budgets FOR DELETE TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

-- FINANCIAL_TRANSACTIONS
DROP POLICY IF EXISTS "Users can view own transactions" ON public.financial_transactions;
CREATE POLICY "Users can view own transactions" ON public.financial_transactions FOR SELECT TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.financial_transactions;
CREATE POLICY "Users can insert own transactions" ON public.financial_transactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id = public.get_data_owner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own transactions" ON public.financial_transactions;
CREATE POLICY "Users can update own transactions" ON public.financial_transactions FOR UPDATE TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own transactions" ON public.financial_transactions;
CREATE POLICY "Users can delete own transactions" ON public.financial_transactions FOR DELETE TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

-- PRODUCTION_TASKS
DROP POLICY IF EXISTS "Users can view own production tasks" ON public.production_tasks;
CREATE POLICY "Users can view own production tasks" ON public.production_tasks FOR SELECT TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can insert own production tasks" ON public.production_tasks;
CREATE POLICY "Users can insert own production tasks" ON public.production_tasks FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id = public.get_data_owner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own production tasks" ON public.production_tasks;
CREATE POLICY "Users can update own production tasks" ON public.production_tasks FOR UPDATE TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own production tasks" ON public.production_tasks;
CREATE POLICY "Users can delete own production tasks" ON public.production_tasks FOR DELETE TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

-- BANK_ACCOUNTS
DROP POLICY IF EXISTS "Users can view own bank accounts" ON public.bank_accounts;
CREATE POLICY "Users can view own bank accounts" ON public.bank_accounts FOR SELECT TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can insert own bank accounts" ON public.bank_accounts;
CREATE POLICY "Users can insert own bank accounts" ON public.bank_accounts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id = public.get_data_owner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own bank accounts" ON public.bank_accounts;
CREATE POLICY "Users can update own bank accounts" ON public.bank_accounts FOR UPDATE TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own bank accounts" ON public.bank_accounts;
CREATE POLICY "Users can delete own bank accounts" ON public.bank_accounts FOR DELETE TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

-- BANK_TRANSFERS
DROP POLICY IF EXISTS "Users can view own transfers" ON public.bank_transfers;
CREATE POLICY "Users can view own transfers" ON public.bank_transfers FOR SELECT TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can insert own transfers" ON public.bank_transfers;
CREATE POLICY "Users can insert own transfers" ON public.bank_transfers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id = public.get_data_owner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can delete own transfers" ON public.bank_transfers;
CREATE POLICY "Users can delete own transfers" ON public.bank_transfers FOR DELETE TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

-- EMPLOYEES
DROP POLICY IF EXISTS "Users can view own employees" ON public.employees;
CREATE POLICY "Users can view own employees" ON public.employees FOR SELECT TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can insert own employees" ON public.employees;
CREATE POLICY "Users can insert own employees" ON public.employees FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id = public.get_data_owner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own employees" ON public.employees;
CREATE POLICY "Users can update own employees" ON public.employees FOR UPDATE TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can delete own employees" ON public.employees;
CREATE POLICY "Users can delete own employees" ON public.employees FOR DELETE TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

-- COMPANY_SETTINGS
DROP POLICY IF EXISTS "Users can view own settings" ON public.company_settings;
CREATE POLICY "Users can view own settings" ON public.company_settings FOR SELECT TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

DROP POLICY IF EXISTS "Users can insert own settings" ON public.company_settings;
CREATE POLICY "Users can insert own settings" ON public.company_settings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id = public.get_data_owner_id(auth.uid()));

DROP POLICY IF EXISTS "Users can update own settings" ON public.company_settings;
CREATE POLICY "Users can update own settings" ON public.company_settings FOR UPDATE TO authenticated
  USING (public.can_access_data(auth.uid(), user_id));

-- BUDGET_ITEMS (uses budget ownership, needs updating too)
DROP POLICY IF EXISTS "Users can manage budget items via budget" ON public.budget_items;
CREATE POLICY "Users can manage budget items via budget" ON public.budget_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM budgets WHERE budgets.id = budget_items.budget_id AND public.can_access_data(auth.uid(), budgets.user_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM budgets WHERE budgets.id = budget_items.budget_id AND public.can_access_data(auth.uid(), budgets.user_id)
  ));
