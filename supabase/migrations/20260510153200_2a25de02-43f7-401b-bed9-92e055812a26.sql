-- Add rate columns to employees
ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS hourly_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_rate numeric NOT NULL DEFAULT 0;

-- Create collaborator work logs table
CREATE TABLE IF NOT EXISTS public.collaborator_work_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  hours_worked numeric NOT NULL DEFAULT 0,
  days_worked numeric NOT NULL DEFAULT 0,
  hourly_rate numeric NOT NULL DEFAULT 0,
  daily_rate numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  budget_id uuid,
  client_id uuid,
  description text,
  status text NOT NULL DEFAULT 'pending',
  linked_transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.collaborator_work_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own work logs" ON public.collaborator_work_logs
  FOR SELECT TO authenticated USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Users can insert own work logs" ON public.collaborator_work_logs
  FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()) OR (user_id = get_data_owner_id(auth.uid())));
CREATE POLICY "Users can update own work logs" ON public.collaborator_work_logs
  FOR UPDATE TO authenticated USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Users can delete own work logs" ON public.collaborator_work_logs
  FOR DELETE TO authenticated USING (can_access_data(auth.uid(), user_id));

CREATE TRIGGER trg_work_logs_updated_at
  BEFORE UPDATE ON public.collaborator_work_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_work_logs_user_date ON public.collaborator_work_logs(user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_work_logs_employee ON public.collaborator_work_logs(employee_id);