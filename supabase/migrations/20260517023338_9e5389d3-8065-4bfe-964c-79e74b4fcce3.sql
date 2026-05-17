CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  scope text NOT NULL DEFAULT 'monthly',
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  health_label text,
  insights jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  alerts jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_company  ON public.ai_insights(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user     ON public.ai_insights(user_id, created_at DESC);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view ai_insights"
ON public.ai_insights FOR SELECT TO authenticated
USING (public.can_access_data(auth.uid(), user_id));

CREATE POLICY "Members insert ai_insights"
ON public.ai_insights FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id = public.get_data_owner_id(auth.uid()));

CREATE POLICY "Members update ai_insights"
ON public.ai_insights FOR UPDATE TO authenticated
USING (public.can_access_data(auth.uid(), user_id));

CREATE POLICY "Members delete ai_insights"
ON public.ai_insights FOR DELETE TO authenticated
USING (public.can_access_data(auth.uid(), user_id));

CREATE TRIGGER ai_insights_updated_at
BEFORE UPDATE ON public.ai_insights
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_auto_company_id_ai_insights
BEFORE INSERT ON public.ai_insights
FOR EACH ROW EXECUTE FUNCTION public.auto_set_company_id();