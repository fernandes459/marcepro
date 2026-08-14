CREATE TABLE IF NOT EXISTS public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  key text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompts TO authenticated;
GRANT ALL ON public.ai_prompts TO service_role;
ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_prompts_own" ON public.ai_prompts FOR ALL TO authenticated
  USING (owner_id = public.get_data_owner_id(auth.uid()) OR owner_id = auth.uid())
  WITH CHECK (owner_id = public.get_data_owner_id(auth.uid()) OR owner_id = auth.uid());