-- ============ SHEET MATERIALS (Chapas MDF/MDP) ============
CREATE TABLE public.sheet_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  material_type TEXT NOT NULL DEFAULT 'MDF', -- MDF, MDP, Compensado
  color TEXT,
  finish TEXT, -- 'BP', 'Texturizado', 'Brilho', 'Fosco'
  thickness_mm NUMERIC NOT NULL DEFAULT 18,
  sheet_width_mm INTEGER NOT NULL DEFAULT 2750,
  sheet_height_mm INTEGER NOT NULL DEFAULT 1850,
  price_per_sheet NUMERIC NOT NULL DEFAULT 0,
  price_per_m2 NUMERIC NOT NULL DEFAULT 0,
  density_kg_m3 NUMERIC NOT NULL DEFAULT 720, -- MDF ~720, MDP ~650
  supplier TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sheet_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sheets" ON public.sheet_materials
  FOR SELECT TO authenticated USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Users insert own sheets" ON public.sheet_materials
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id = get_data_owner_id(auth.uid()));
CREATE POLICY "Users update own sheets" ON public.sheet_materials
  FOR UPDATE TO authenticated USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Users delete own sheets" ON public.sheet_materials
  FOR DELETE TO authenticated USING (can_access_data(auth.uid(), user_id));

CREATE TRIGGER sheet_materials_updated_at
  BEFORE UPDATE ON public.sheet_materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ EDGE TAPES (Fitas de Borda) ============
CREATE TABLE public.edge_tapes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  finish TEXT,
  width_mm NUMERIC NOT NULL DEFAULT 22,
  thickness_mm NUMERIC NOT NULL DEFAULT 0.4,
  roll_length_m NUMERIC NOT NULL DEFAULT 50,
  price_per_roll NUMERIC NOT NULL DEFAULT 0,
  price_per_m NUMERIC NOT NULL DEFAULT 0,
  supplier TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.edge_tapes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tapes" ON public.edge_tapes
  FOR SELECT TO authenticated USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Users insert own tapes" ON public.edge_tapes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id = get_data_owner_id(auth.uid()));
CREATE POLICY "Users update own tapes" ON public.edge_tapes
  FOR UPDATE TO authenticated USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Users delete own tapes" ON public.edge_tapes
  FOR DELETE TO authenticated USING (can_access_data(auth.uid(), user_id));

CREATE TRIGGER edge_tapes_updated_at
  BEFORE UPDATE ON public.edge_tapes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ HARDWARE ITEMS (Ferragens) ============
CREATE TABLE public.hardware_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'outro', -- 'puxador','dobradica','corredica','parafuso','sapata','prateleira_suporte','outro'
  unit TEXT NOT NULL DEFAULT 'un',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  -- Specs opcionais
  length_mm NUMERIC,
  finish TEXT, -- 'cromado','escovado','preto fosco', etc
  brand TEXT,
  supplier TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hardware_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own hardware" ON public.hardware_items
  FOR SELECT TO authenticated USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Users insert own hardware" ON public.hardware_items
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id = get_data_owner_id(auth.uid()));
CREATE POLICY "Users update own hardware" ON public.hardware_items
  FOR UPDATE TO authenticated USING (can_access_data(auth.uid(), user_id));
CREATE POLICY "Users delete own hardware" ON public.hardware_items
  FOR DELETE TO authenticated USING (can_access_data(auth.uid(), user_id));

CREATE TRIGGER hardware_items_updated_at
  BEFORE UPDATE ON public.hardware_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
CREATE INDEX idx_sheet_materials_user ON public.sheet_materials(user_id) WHERE active = true;
CREATE INDEX idx_edge_tapes_user ON public.edge_tapes(user_id) WHERE active = true;
CREATE INDEX idx_hardware_items_user ON public.hardware_items(user_id, category) WHERE active = true;