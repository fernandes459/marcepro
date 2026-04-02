
-- Bank accounts table
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  bank_name TEXT,
  account_type TEXT NOT NULL DEFAULT 'corrente',
  agency TEXT,
  account_number TEXT,
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#3B82F6',
  is_main BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank accounts" ON public.bank_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own bank accounts" ON public.bank_accounts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own bank accounts" ON public.bank_accounts FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can delete own bank accounts" ON public.bank_accounts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Bank transfers table
CREATE TABLE public.bank_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  from_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transfers" ON public.bank_transfers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own transfers" ON public.bank_transfers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own transfers" ON public.bank_transfers FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Add bank_account_id to financial_transactions
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES public.bank_accounts(id);
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS order_number TEXT;
