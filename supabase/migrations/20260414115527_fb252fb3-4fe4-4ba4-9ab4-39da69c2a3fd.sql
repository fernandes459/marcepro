
CREATE TABLE public.payment_milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  percentage NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  production_stage TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date DATE,
  paid_date DATE,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own milestones"
ON public.payment_milestones FOR SELECT TO authenticated
USING (can_access_data(auth.uid(), user_id));

CREATE POLICY "Users can insert own milestones"
ON public.payment_milestones FOR INSERT TO authenticated
WITH CHECK ((user_id = auth.uid()) OR (user_id = get_data_owner_id(auth.uid())));

CREATE POLICY "Users can update own milestones"
ON public.payment_milestones FOR UPDATE TO authenticated
USING (can_access_data(auth.uid(), user_id));

CREATE POLICY "Users can delete own milestones"
ON public.payment_milestones FOR DELETE TO authenticated
USING (can_access_data(auth.uid(), user_id));
