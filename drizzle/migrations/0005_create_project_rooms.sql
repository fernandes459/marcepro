CREATE TABLE public.project_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  company_id uuid,
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'projeto',
  value numeric NOT NULL DEFAULT 0,
  due_date date,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_rooms_status_check CHECK (status IN ('projeto','aprovado','fabricacao','instalacao','concluido'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_rooms TO authenticated;
GRANT ALL ON public.project_rooms TO service_role;
ALTER TABLE public.project_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage rooms via budget" ON public.project_rooms FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = project_rooms.budget_id AND public.can_access_data(auth.uid(), b.user_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = project_rooms.budget_id AND public.can_access_data(auth.uid(), b.user_id)));
CREATE INDEX project_rooms_budget_idx ON public.project_rooms(budget_id);
CREATE TRIGGER project_rooms_updated_at BEFORE UPDATE ON public.project_rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_rooms;