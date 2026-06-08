
CREATE TABLE public.crm_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid,
  budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  assignee text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  due_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','cancelled')),
  origin text NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','ai')),
  ai_batch_id uuid,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_follow_ups_company ON public.crm_follow_ups(company_id, status, due_date);
CREATE INDEX idx_follow_ups_budget ON public.crm_follow_ups(budget_id);
CREATE INDEX idx_follow_ups_client ON public.crm_follow_ups(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_follow_ups TO authenticated;
GRANT ALL ON public.crm_follow_ups TO service_role;

ALTER TABLE public.crm_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view follow ups" ON public.crm_follow_ups
  FOR SELECT TO authenticated USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Members insert follow ups" ON public.crm_follow_ups
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id = get_data_owner_id(auth.uid()));
CREATE POLICY "Members update follow ups" ON public.crm_follow_ups
  FOR UPDATE TO authenticated USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Members delete follow ups" ON public.crm_follow_ups
  FOR DELETE TO authenticated USING (can_access_data(auth.uid(), user_id));

CREATE TRIGGER trg_follow_ups_company
  BEFORE INSERT ON public.crm_follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

CREATE TRIGGER trg_follow_ups_updated
  BEFORE UPDATE ON public.crm_follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
