-- ============================================================
-- ONDA 4: PERFORMANCE + CRM + PCP + NOTIFICAÇÕES
-- ============================================================

-- ---------- 1. ÍNDICES DE PERFORMANCE ----------
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_fin_tx_company_date ON public.financial_transactions(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_fin_tx_user_status_due ON public.financial_transactions(user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_fin_tx_budget ON public.financial_transactions(budget_id);

CREATE INDEX IF NOT EXISTS idx_budgets_company_status ON public.budgets(company_id, status);
CREATE INDEX IF NOT EXISTS idx_budgets_user_created ON public.budgets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_client ON public.budgets(client_id);

CREATE INDEX IF NOT EXISTS idx_prod_tasks_company_stage ON public.production_tasks(company_id, stage);
CREATE INDEX IF NOT EXISTS idx_prod_tasks_due ON public.production_tasks(due_date);

CREATE INDEX IF NOT EXISTS idx_milestones_budget ON public.payment_milestones(budget_id);
CREATE INDEX IF NOT EXISTS idx_milestones_company_status ON public.payment_milestones(company_id, status);

CREATE INDEX IF NOT EXISTS idx_clients_company_name ON public.clients(company_id, name);

-- ---------- 2. CRM: LEADS ----------
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  name text NOT NULL,
  phone text,
  email text,
  source text DEFAULT 'manual', -- manual, indicacao, instagram, site, anuncio, outro
  stage text NOT NULL DEFAULT 'novo', -- novo, qualificado, proposta, negociacao, ganho, perdido
  estimated_value numeric NOT NULL DEFAULT 0,
  probability integer NOT NULL DEFAULT 50,
  next_contact_at timestamptz,
  assignee text,
  client_id uuid,
  budget_id uuid,
  notes text,
  lost_reason text,
  won_at timestamptz,
  lost_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view leads" ON public.leads FOR SELECT TO authenticated
USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Members insert leads" ON public.leads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id = get_data_owner_id(auth.uid()));
CREATE POLICY "Members update leads" ON public.leads FOR UPDATE TO authenticated
USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Members delete leads" ON public.leads FOR DELETE TO authenticated
USING (can_access_data(auth.uid(), user_id));

CREATE INDEX idx_leads_company_stage ON public.leads(company_id, stage);
CREATE INDEX idx_leads_next_contact ON public.leads(next_contact_at);

CREATE TRIGGER trg_leads_updated BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_leads_company BEFORE INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- ---------- 3. CRM: LEAD INTERACTIONS ----------
CREATE TABLE IF NOT EXISTS public.lead_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  lead_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'note', -- call, whatsapp, email, visit, meeting, note
  description text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view interactions" ON public.lead_interactions FOR SELECT TO authenticated
USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Members insert interactions" ON public.lead_interactions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id = get_data_owner_id(auth.uid()));
CREATE POLICY "Members delete interactions" ON public.lead_interactions FOR DELETE TO authenticated
USING (can_access_data(auth.uid(), user_id));

CREATE INDEX idx_interactions_lead ON public.lead_interactions(lead_id, occurred_at DESC);
CREATE TRIGGER trg_interactions_company BEFORE INSERT ON public.lead_interactions
FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- ---------- 4. PCP: CAPACIDADE PRODUTIVA ----------
CREATE TABLE IF NOT EXISTS public.production_capacity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  stage text NOT NULL, -- corte, borda, usinagem, montagem
  hours_per_day numeric NOT NULL DEFAULT 8,
  parallel_tasks integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, stage)
);
ALTER TABLE public.production_capacity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view capacity" ON public.production_capacity FOR SELECT TO authenticated
USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Members insert capacity" ON public.production_capacity FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id = get_data_owner_id(auth.uid()));
CREATE POLICY "Members update capacity" ON public.production_capacity FOR UPDATE TO authenticated
USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Members delete capacity" ON public.production_capacity FOR DELETE TO authenticated
USING (can_access_data(auth.uid(), user_id));

CREATE TRIGGER trg_capacity_updated BEFORE UPDATE ON public.production_capacity
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_capacity_company BEFORE INSERT ON public.production_capacity
FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

ALTER TABLE public.production_tasks ADD COLUMN IF NOT EXISTS estimated_hours numeric DEFAULT 0;

-- ---------- 5. NOTIFICAÇÕES ----------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  kind text NOT NULL, -- overdue, low_margin, assembly_pending, lead_followup, payment_received, system
  severity text NOT NULL DEFAULT 'info', -- info, warning, critical
  title text NOT NULL,
  body text,
  link text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User views own notifications" ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "Members insert notifications" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id = get_data_owner_id(auth.uid()) OR can_access_data(auth.uid(), user_id));
CREATE POLICY "User updates own notifications" ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid());
CREATE POLICY "User deletes own notifications" ON public.notifications FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read_at, created_at DESC);
CREATE TRIGGER trg_notifications_company BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();
