-- ============================================================
-- ONDA 3: Audit logs (camada de auditoria enterprise)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  module text NOT NULL,                 -- 'budgets' | 'finance' | 'clients' | 'production' | 'auth' | ...
  action text NOT NULL,                 -- 'create' | 'update' | 'delete' | 'approve' | 'login' | ...
  entity_type text,                     -- 'budget' | 'transaction' | 'client' ...
  entity_id uuid,
  summary text,                         -- descrição curta legível
  old_data jsonb,
  new_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created
  ON public.audit_logs (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module_action
  ON public.audit_logs (module, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (entity_type, entity_id);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (can_access_data(auth.uid(), user_id));

CREATE POLICY "Members insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id = get_data_owner_id(auth.uid()));

-- Sem UPDATE / DELETE: audit é imutável (apenas admin via service role)

-- Auto preencher company_id
CREATE TRIGGER trg_audit_logs_company_id
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();

-- Helper RPC
CREATE OR REPLACE FUNCTION public.log_audit(
  _module text,
  _action text,
  _entity_type text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _summary text DEFAULT NULL,
  _old_data jsonb DEFAULT NULL,
  _new_data jsonb DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    user_id, module, action, entity_type, entity_id,
    summary, old_data, new_data, metadata
  ) VALUES (
    auth.uid(), _module, _action, _entity_type, _entity_id,
    _summary, _old_data, _new_data, COALESCE(_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
