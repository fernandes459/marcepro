import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Layers, Tag, Wrench, Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatBRL } from '@/lib/format';
import { HARDWARE_CATEGORIES, type SheetMaterial, type EdgeTape, type HardwareItem, type HardwareCategory } from '@/lib/engineering-types';

export default function EngineeringCatalogSettings() {
  const { user } = useAuth();
  const [sheets, setSheets] = useState<SheetMaterial[]>([]);
  const [tapes, setTapes] = useState<EdgeTape[]>([]);
  const [hardware, setHardware] = useState<HardwareItem[]>([]);

  const [sheetDialog, setSheetDialog] = useState<Partial<SheetMaterial> | null>(null);
  const [tapeDialog, setTapeDialog] = useState<Partial<EdgeTape> | null>(null);
  const [hardwareDialog, setHardwareDialog] = useState<Partial<HardwareItem> | null>(null);

  const load = async () => {
    const [s, t, h] = await Promise.all([
      supabase.from('sheet_materials').select('*').order('name'),
      supabase.from('edge_tapes').select('*').order('name'),
      supabase.from('hardware_items').select('*').order('category').order('name'),
    ]);
    if (s.data) setSheets(s.data as any);
    if (t.data) setTapes(t.data as any);
    if (h.data) setHardware(h.data as any);
  };
  useEffect(() => { load(); }, []);

  // ====== SHEETS ======
  const saveSheet = async () => {
    if (!sheetDialog || !user) return;
    if (!sheetDialog.name) { toast.error('Nome é obrigatório'); return; }
    const payload: any = {
      ...sheetDialog,
      user_id: user.id,
      thickness_mm: Number(sheetDialog.thickness_mm) || 18,
      sheet_width_mm: Number(sheetDialog.sheet_width_mm) || 2750,
      sheet_height_mm: Number(sheetDialog.sheet_height_mm) || 1850,
      price_per_sheet: Number(sheetDialog.price_per_sheet) || 0,
      price_per_m2: Number(sheetDialog.price_per_m2) || 0,
      density_kg_m3: Number(sheetDialog.density_kg_m3) || 720,
    };
    const { error } = sheetDialog.id
      ? await supabase.from('sheet_materials').update(payload).eq('id', sheetDialog.id)
      : await supabase.from('sheet_materials').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Chapa salva');
    setSheetDialog(null);
    load();
  };
  const deleteSheet = async (id: string) => {
    if (!confirm('Excluir esta chapa?')) return;
    const { error } = await supabase.from('sheet_materials').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Excluída'); load(); }
  };

  // ====== TAPES ======
  const saveTape = async () => {
    if (!tapeDialog || !user) return;
    if (!tapeDialog.name) { toast.error('Nome é obrigatório'); return; }
    const payload: any = {
      ...tapeDialog,
      user_id: user.id,
      width_mm: Number(tapeDialog.width_mm) || 22,
      thickness_mm: Number(tapeDialog.thickness_mm) || 0.4,
      roll_length_m: Number(tapeDialog.roll_length_m) || 50,
      price_per_roll: Number(tapeDialog.price_per_roll) || 0,
      price_per_m: Number(tapeDialog.price_per_m) || 0,
    };
    const { error } = tapeDialog.id
      ? await supabase.from('edge_tapes').update(payload).eq('id', tapeDialog.id)
      : await supabase.from('edge_tapes').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Fita salva');
    setTapeDialog(null);
    load();
  };
  const deleteTape = async (id: string) => {
    if (!confirm('Excluir esta fita?')) return;
    const { error } = await supabase.from('edge_tapes').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Excluída'); load(); }
  };

  // ====== HARDWARE ======
  const saveHardware = async () => {
    if (!hardwareDialog || !user) return;
    if (!hardwareDialog.name) { toast.error('Nome é obrigatório'); return; }
    const payload: any = {
      ...hardwareDialog,
      user_id: user.id,
      unit_price: Number(hardwareDialog.unit_price) || 0,
      length_mm: hardwareDialog.length_mm ? Number(hardwareDialog.length_mm) : null,
    };
    const { error } = hardwareDialog.id
      ? await supabase.from('hardware_items').update(payload).eq('id', hardwareDialog.id)
      : await supabase.from('hardware_items').insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success('Ferragem salva');
    setHardwareDialog(null);
    load();
  };
  const deleteHardware = async (id: string) => {
    if (!confirm('Excluir esta ferragem?')) return;
    const { error } = await supabase.from('hardware_items').delete().eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Excluída'); load(); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-display flex items-center gap-2">
          <Wrench className="h-4 w-4" /> Catálogo de Engenharia
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sheets">
          <TabsList>
            <TabsTrigger value="sheets" className="text-xs"><Layers className="h-3 w-3 mr-1" /> Chapas</TabsTrigger>
            <TabsTrigger value="tapes" className="text-xs"><Tag className="h-3 w-3 mr-1" /> Fitas</TabsTrigger>
            <TabsTrigger value="hardware" className="text-xs"><Wrench className="h-3 w-3 mr-1" /> Ferragens</TabsTrigger>
          </TabsList>

          {/* SHEETS */}
          <TabsContent value="sheets" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setSheetDialog({
                name: '', material_type: 'MDF', thickness_mm: 18,
                sheet_width_mm: 2750, sheet_height_mm: 1850,
                density_kg_m3: 720, color: '#f5f1e8', active: true,
              })}>
                <Plus className="h-3 w-3 mr-1" /> Nova Chapa
              </Button>
            </div>
            {sheets.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma chapa cadastrada.</p>
            ) : sheets.map(s => (
              <div key={s.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {s.color && <div className="h-8 w-8 rounded border shrink-0" style={{ background: s.color }} />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.material_type} · {s.thickness_mm}mm · {s.sheet_width_mm}×{s.sheet_height_mm} ·
                      {' '}{s.price_per_sheet > 0 ? `${formatBRL(s.price_per_sheet)}/chapa` : `${formatBRL(s.price_per_m2)}/m²`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSheetDialog(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteSheet(s.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* TAPES */}
          <TabsContent value="tapes" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setTapeDialog({
                name: '', width_mm: 22, thickness_mm: 0.4,
                roll_length_m: 50, color: '#ffffff', active: true,
              })}>
                <Plus className="h-3 w-3 mr-1" /> Nova Fita
              </Button>
            </div>
            {tapes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma fita cadastrada.</p>
            ) : tapes.map(t => (
              <div key={t.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {t.color && <div className="h-8 w-8 rounded border shrink-0" style={{ background: t.color }} />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.width_mm}×{t.thickness_mm}mm · rolo {t.roll_length_m}m ·
                      {' '}{t.price_per_roll > 0 ? `${formatBRL(t.price_per_roll)}/rolo` : `${formatBRL(t.price_per_m)}/m`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setTapeDialog(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteTape(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>

          {/* HARDWARE */}
          <TabsContent value="hardware" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setHardwareDialog({
                name: '', category: 'puxador', unit: 'un', unit_price: 0, active: true,
              })}>
                <Plus className="h-3 w-3 mr-1" /> Nova Ferragem
              </Button>
            </div>
            {hardware.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma ferragem cadastrada.</p>
            ) : hardware.map(h => (
              <div key={h.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] h-5">
                      {HARDWARE_CATEGORIES.find(c => c.value === h.category)?.label}
                    </Badge>
                    <p className="text-sm font-medium truncate">{h.name}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatBRL(h.unit_price)} / {h.unit}
                    {h.brand && ` · ${h.brand}`}
                    {h.finish && ` · ${h.finish}`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setHardwareDialog(h)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteHardware(h.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* ===== DIALOG: SHEET ===== */}
      <Dialog open={!!sheetDialog} onOpenChange={(o) => !o && setSheetDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{sheetDialog?.id ? 'Editar' : 'Nova'} Chapa</DialogTitle></DialogHeader>
          {sheetDialog && (
            <div className="space-y-3">
              <div><Label className="text-xs">Nome</Label>
                <Input value={sheetDialog.name ?? ''} onChange={e => setSheetDialog({ ...sheetDialog, name: e.target.value })} placeholder="MDF 18mm Branco TX" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Tipo</Label>
                  <Select value={sheetDialog.material_type ?? 'MDF'} onValueChange={v => setSheetDialog({ ...sheetDialog, material_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MDF">MDF</SelectItem>
                      <SelectItem value="MDP">MDP</SelectItem>
                      <SelectItem value="Compensado">Compensado</SelectItem>
                    </SelectContent>
                  </Select></div>
                <div><Label className="text-xs">Espessura (mm)</Label>
                  <Input type="number" value={sheetDialog.thickness_mm ?? 18} onChange={e => setSheetDialog({ ...sheetDialog, thickness_mm: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Cor / Acabamento</Label>
                  <Input value={sheetDialog.finish ?? ''} onChange={e => setSheetDialog({ ...sheetDialog, finish: e.target.value })} placeholder="Branco TX" /></div>
                <div><Label className="text-xs">Cor (visualização 3D)</Label>
                  <Input type="color" value={sheetDialog.color ?? '#f5f1e8'} onChange={e => setSheetDialog({ ...sheetDialog, color: e.target.value })} className="h-10" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Largura chapa (mm)</Label>
                  <Input type="number" value={sheetDialog.sheet_width_mm ?? 2750} onChange={e => setSheetDialog({ ...sheetDialog, sheet_width_mm: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Altura chapa (mm)</Label>
                  <Input type="number" value={sheetDialog.sheet_height_mm ?? 1850} onChange={e => setSheetDialog({ ...sheetDialog, sheet_height_mm: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Preço por chapa (R$)</Label>
                  <Input type="number" step="0.01" value={sheetDialog.price_per_sheet ?? 0} onChange={e => setSheetDialog({ ...sheetDialog, price_per_sheet: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Preço por m² (R$)</Label>
                  <Input type="number" step="0.01" value={sheetDialog.price_per_m2 ?? 0} onChange={e => setSheetDialog({ ...sheetDialog, price_per_m2: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Densidade (kg/m³)</Label>
                  <Input type="number" value={sheetDialog.density_kg_m3 ?? 720} onChange={e => setSheetDialog({ ...sheetDialog, density_kg_m3: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Fornecedor</Label>
                  <Input value={sheetDialog.supplier ?? ''} onChange={e => setSheetDialog({ ...sheetDialog, supplier: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setSheetDialog(null)}>Cancelar</Button>
                <Button onClick={saveSheet}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG: TAPE ===== */}
      <Dialog open={!!tapeDialog} onOpenChange={(o) => !o && setTapeDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{tapeDialog?.id ? 'Editar' : 'Nova'} Fita de Borda</DialogTitle></DialogHeader>
          {tapeDialog && (
            <div className="space-y-3">
              <div><Label className="text-xs">Nome</Label>
                <Input value={tapeDialog.name ?? ''} onChange={e => setTapeDialog({ ...tapeDialog, name: e.target.value })} placeholder="Fita 0.4×22 Branco" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Largura (mm)</Label>
                  <Input type="number" step="0.1" value={tapeDialog.width_mm ?? 22} onChange={e => setTapeDialog({ ...tapeDialog, width_mm: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Espessura (mm)</Label>
                  <Input type="number" step="0.01" value={tapeDialog.thickness_mm ?? 0.4} onChange={e => setTapeDialog({ ...tapeDialog, thickness_mm: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Cor</Label>
                  <Input type="color" value={tapeDialog.color ?? '#ffffff'} onChange={e => setTapeDialog({ ...tapeDialog, color: e.target.value })} className="h-10" /></div>
                <div><Label className="text-xs">Acabamento</Label>
                  <Input value={tapeDialog.finish ?? ''} onChange={e => setTapeDialog({ ...tapeDialog, finish: e.target.value })} placeholder="Liso" /></div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Rolo (m)</Label>
                  <Input type="number" value={tapeDialog.roll_length_m ?? 50} onChange={e => setTapeDialog({ ...tapeDialog, roll_length_m: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Preço/rolo</Label>
                  <Input type="number" step="0.01" value={tapeDialog.price_per_roll ?? 0} onChange={e => setTapeDialog({ ...tapeDialog, price_per_roll: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Preço/m</Label>
                  <Input type="number" step="0.01" value={tapeDialog.price_per_m ?? 0} onChange={e => setTapeDialog({ ...tapeDialog, price_per_m: Number(e.target.value) })} /></div>
              </div>
              <div><Label className="text-xs">Fornecedor</Label>
                <Input value={tapeDialog.supplier ?? ''} onChange={e => setTapeDialog({ ...tapeDialog, supplier: e.target.value })} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setTapeDialog(null)}>Cancelar</Button>
                <Button onClick={saveTape}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== DIALOG: HARDWARE ===== */}
      <Dialog open={!!hardwareDialog} onOpenChange={(o) => !o && setHardwareDialog(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{hardwareDialog?.id ? 'Editar' : 'Nova'} Ferragem</DialogTitle></DialogHeader>
          {hardwareDialog && (
            <div className="space-y-3">
              <div><Label className="text-xs">Nome</Label>
                <Input value={hardwareDialog.name ?? ''} onChange={e => setHardwareDialog({ ...hardwareDialog, name: e.target.value })} placeholder="Puxador alça 128mm" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Categoria</Label>
                  <Select value={hardwareDialog.category ?? 'puxador'} onValueChange={v => setHardwareDialog({ ...hardwareDialog, category: v as HardwareCategory })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HARDWARE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select></div>
                <div><Label className="text-xs">Unidade</Label>
                  <Select value={hardwareDialog.unit ?? 'un'} onValueChange={v => setHardwareDialog({ ...hardwareDialog, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">Unidade</SelectItem>
                      <SelectItem value="par">Par</SelectItem>
                      <SelectItem value="kit">Kit</SelectItem>
                      <SelectItem value="m">Metro</SelectItem>
                    </SelectContent>
                  </Select></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Preço unitário (R$)</Label>
                  <Input type="number" step="0.01" value={hardwareDialog.unit_price ?? 0} onChange={e => setHardwareDialog({ ...hardwareDialog, unit_price: Number(e.target.value) })} /></div>
                <div><Label className="text-xs">Comprimento (mm)</Label>
                  <Input type="number" value={hardwareDialog.length_mm ?? ''} onChange={e => setHardwareDialog({ ...hardwareDialog, length_mm: e.target.value ? Number(e.target.value) : null })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Acabamento</Label>
                  <Input value={hardwareDialog.finish ?? ''} onChange={e => setHardwareDialog({ ...hardwareDialog, finish: e.target.value })} placeholder="Cromado" /></div>
                <div><Label className="text-xs">Marca</Label>
                  <Input value={hardwareDialog.brand ?? ''} onChange={e => setHardwareDialog({ ...hardwareDialog, brand: e.target.value })} /></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setHardwareDialog(null)}>Cancelar</Button>
                <Button onClick={saveHardware}>Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
