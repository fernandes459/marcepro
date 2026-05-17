-- =====================================================
-- ONDA 1: Multiempresa (companies) + RBAC expandido
-- Estratégia ADITIVA — não altera RLS/código existente
-- =====================================================

-- 1) Estende enum app_role com roles em PT-BR (aditivo)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendedor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'producao';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financeiro';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'instalador';

-- 2) Tabela companies (1 por owner_id existente)
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Minha Empresa',
  legal_name text,
  cnpj text,
  email text,
  phone text,
  logo_url text,
  address text,
  city text,
  state text,
  cep text,
  plan text NOT NULL DEFAULT 'free',
  active boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_owner ON public.companies(owner_id);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view company"
ON public.companies FOR SELECT TO authenticated
USING (public.can_access_data(auth.uid(), owner_id));

CREATE POLICY "Owner inserts company"
ON public.companies FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner updates company"
ON public.companies FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Owner deletes company"
ON public.companies FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE TRIGGER companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Adiciona company_id (nullable) nas tabelas tenant
ALTER TABLE public.bank_accounts            ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.bank_transfers           ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.budgets                  ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.clients                  ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.collaborator_work_logs   ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.company_settings         ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.edge_tapes               ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.employees                ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.financial_categories     ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.financial_transactions   ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.hardware_items           ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.material_catalog         ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.operational_costs        ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.payment_milestones       ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.production_tasks         ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.sheet_materials          ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.technical_assistance     ADD COLUMN IF NOT EXISTS company_id uuid;
ALTER TABLE public.user_roles               ADD COLUMN IF NOT EXISTS company_id uuid;

-- 4) Backfill: cria 1 company para cada owner_id distinto
INSERT INTO public.companies (owner_id, name, cnpj, email, phone, logo_url, address, city, state, cep)
SELECT DISTINCT
  COALESCE(public.get_data_owner_id(cs.user_id), cs.user_id) AS owner_id,
  COALESCE(NULLIF(cs.company_name, ''), 'Minha Empresa') AS name,
  cs.cnpj, cs.email, cs.phone, cs.logo_url, cs.address, cs.city, cs.state, cs.cep
FROM public.company_settings cs
WHERE NOT EXISTS (
  SELECT 1 FROM public.companies c
  WHERE c.owner_id = COALESCE(public.get_data_owner_id(cs.user_id), cs.user_id)
);

-- Cria company para owners sem company_settings (qualquer user_id em qualquer tabela)
INSERT INTO public.companies (owner_id, name)
SELECT DISTINCT owner_id, 'Minha Empresa'
FROM (
  SELECT DISTINCT public.get_data_owner_id(user_id) AS owner_id FROM public.budgets
  UNION SELECT DISTINCT public.get_data_owner_id(user_id) FROM public.clients
  UNION SELECT DISTINCT public.get_data_owner_id(user_id) FROM public.financial_transactions
  UNION SELECT DISTINCT public.get_data_owner_id(user_id) FROM public.bank_accounts
  UNION SELECT DISTINCT public.get_data_owner_id(user_id) FROM public.employees
  UNION SELECT user_id FROM public.user_roles WHERE owner_id IS NULL
) src
WHERE owner_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.owner_id = src.owner_id);

-- 5) Helper: resolve company_id de um usuário
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id FROM public.companies c
  WHERE c.owner_id = public.get_data_owner_id(_user_id)
  LIMIT 1
$$;

-- Helper: checa se user tem role específico (compat com has_role)
CREATE OR REPLACE FUNCTION public.has_company_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 6) Backfill de company_id em todas as tabelas tenant
UPDATE public.bank_accounts          SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.bank_transfers         SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.budgets                SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.clients                SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.collaborator_work_logs SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.company_settings       SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.edge_tapes             SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.employees              SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.financial_categories   SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.financial_transactions SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.hardware_items         SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.material_catalog       SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.operational_costs      SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.payment_milestones     SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.production_tasks       SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.sheet_materials        SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.technical_assistance   SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;
UPDATE public.user_roles             SET company_id = public.get_user_company_id(user_id) WHERE company_id IS NULL;

-- 7) Índices em company_id (acelera futuras queries multi-tenant)
CREATE INDEX IF NOT EXISTS idx_bank_accounts_company          ON public.bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_company         ON public.bank_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_budgets_company                ON public.budgets(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_company                ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_company              ON public.collaborator_work_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_company_settings_company       ON public.company_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_edge_tapes_company             ON public.edge_tapes(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_company              ON public.employees(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_categories_company   ON public.financial_categories(company_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_company ON public.financial_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_hardware_items_company         ON public.hardware_items(company_id);
CREATE INDEX IF NOT EXISTS idx_material_catalog_company       ON public.material_catalog(company_id);
CREATE INDEX IF NOT EXISTS idx_operational_costs_company      ON public.operational_costs(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_company     ON public.payment_milestones(company_id);
CREATE INDEX IF NOT EXISTS idx_production_tasks_company       ON public.production_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_sheet_materials_company        ON public.sheet_materials(company_id);
CREATE INDEX IF NOT EXISTS idx_technical_assistance_company   ON public.technical_assistance(company_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_company             ON public.user_roles(company_id);

-- 8) Trigger: ao criar usuário novo, garante uma company e seta admin (estende auto_assign_admin)
CREATE OR REPLACE FUNCTION public.ensure_user_company()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Se usuário não tem company, cria uma
  IF NOT EXISTS (SELECT 1 FROM public.companies WHERE owner_id = NEW.id) THEN
    INSERT INTO public.companies (owner_id, name)
    VALUES (NEW.id, 'Minha Empresa')
    RETURNING id INTO v_company_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_company ON auth.users;
CREATE TRIGGER on_auth_user_created_company
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.ensure_user_company();

-- 9) Trigger: auto-set company_id em INSERTs (se vier NULL) — garante consistência futura
CREATE OR REPLACE FUNCTION public.auto_set_company_id()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.company_id := public.get_user_company_id(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Aplica trigger em todas as tabelas tenant
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'bank_accounts','bank_transfers','budgets','clients','collaborator_work_logs',
    'company_settings','edge_tapes','employees','financial_categories',
    'financial_transactions','hardware_items','material_catalog','operational_costs',
    'payment_milestones','production_tasks','sheet_materials','technical_assistance','user_roles'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_company_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_auto_company_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id()',
      t
    );
  END LOOP;
END $$;