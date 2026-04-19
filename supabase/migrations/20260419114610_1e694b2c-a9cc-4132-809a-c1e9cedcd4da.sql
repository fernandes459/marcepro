-- 1. Production tasks: add assembly checklist fields
ALTER TABLE public.production_tasks
  ADD COLUMN IF NOT EXISTS assembly_checklist jsonb DEFAULT '{"estrutura": false, "portas": false, "gavetas": false, "acabamento": false, "limpeza": false}'::jsonb,
  ADD COLUMN IF NOT EXISTS assembly_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS assembly_completed_by text,
  ADD COLUMN IF NOT EXISTS has_pending_issues boolean NOT NULL DEFAULT false;

-- 2. Technical Assistance table
CREATE TABLE IF NOT EXISTS public.technical_assistance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL,
  production_task_id uuid REFERENCES public.production_tasks(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  project_name text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  assignee text,
  resolution_notes text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.technical_assistance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assistance"
  ON public.technical_assistance FOR SELECT
  TO authenticated
  USING (can_access_data(auth.uid(), user_id));

CREATE POLICY "Users can insert own assistance"
  ON public.technical_assistance FOR INSERT
  TO authenticated
  WITH CHECK ((user_id = auth.uid()) OR (user_id = get_data_owner_id(auth.uid())));

CREATE POLICY "Users can update own assistance"
  ON public.technical_assistance FOR UPDATE
  TO authenticated
  USING (can_access_data(auth.uid(), user_id));

CREATE POLICY "Users can delete own assistance"
  ON public.technical_assistance FOR DELETE
  TO authenticated
  USING (can_access_data(auth.uid(), user_id));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_technical_assistance_updated_at ON public.technical_assistance;
CREATE TRIGGER trg_technical_assistance_updated_at
  BEFORE UPDATE ON public.technical_assistance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.technical_assistance;