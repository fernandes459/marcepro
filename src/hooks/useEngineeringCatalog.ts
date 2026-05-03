import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SheetMaterial, EdgeTape, HardwareItem } from '@/lib/engineering-types';

export function useEngineeringCatalog() {
  const [sheets, setSheets] = useState<SheetMaterial[]>([]);
  const [tapes, setTapes] = useState<EdgeTape[]>([]);
  const [hardware, setHardware] = useState<HardwareItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const [sRes, tRes, hRes] = await Promise.all([
      supabase.from('sheet_materials').select('*').eq('active', true).order('name'),
      supabase.from('edge_tapes').select('*').eq('active', true).order('name'),
      supabase.from('hardware_items').select('*').eq('active', true).order('category').order('name'),
    ]);
    if (sRes.data) setSheets(sRes.data as any);
    if (tRes.data) setTapes(tRes.data as any);
    if (hRes.data) setHardware(hRes.data as any);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  return { sheets, tapes, hardware, loading, reload };
}
