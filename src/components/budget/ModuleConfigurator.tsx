import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Box, Layers, Settings2, Palette, Info } from 'lucide-react';
import { formatBRL } from '@/lib/format';
import ModuleTemplatePicker from './ModuleTemplatePicker';
import Module3DViewer from './Module3DViewer';
import { useEngineeringCatalog } from '@/hooks/useEngineeringCatalog';
import {
  explodePieces,
  calculateSheetUsage,
  calculateTapeUsage,
  calcAutoHardware,
  type SheetCalc,
  type TapeCalc,
  type HardwareCalc,
} from '@/lib/engineering-calc';

export interface ModuleConfig {
  type: string;
  name?: string;
  height: number;
  width: number;
  depth: number;
  thickness: number;
  shelves: number;
  doors: number;
  drawers?: number;
  // Materiais selecionados (catálogo)
  bodySheetId?: string;
  frontSheetId?: string;
  edgeTapeId?: string;
  // Ferragens
  handleId?: string;
  hingeId?: string;
  slideId?: string;
  shelfSupportId?: string;
}

export interface ModuleResult {
  totalAreaM2: number;
  totalAreaWithWaste: number;
  totalEdgeTapeM: number;
  materialCost: number;
  edgeTapeCost: number;
  hardwareCost: number;
  totalWeightKg: number;
  sheetCalcs: SheetCalc[];
  tapeCalcs: TapeCalc[];
  hardwareCalcs: HardwareCalc[];
}

interface Props {
  modules: ModuleConfig[];
  onModulesChange: (modules: ModuleConfig[]) => void;
  // legado — mantidos para compatibilidade
  mdfPricePerM2: number;
  edgeTapePricePerM: number;
  onMdfPriceChange: (v: number) => void;
  onEdgeTapePriceChange: (v: number) => void;
  onResultChange: (r: ModuleResult) => void;
}

const MODULE_TYPES = [
  { value: 'armario_superior', label: 'Armário Superior' },
  { value: 'armario_inferior', label: 'Armário Inferior' },
  { value: 'balcao', label: 'Balcão' },
  { value: 'estante', label: 'Estante' },
  { value: 'painel', label: 'Painel' },
  { value: 'bancada', label: 'Bancada' },
  { value: 'gaveteiro', label: 'Gaveteiro' },
  { value: 'closet', label: 'Closet' },
  { value: 'outro', label: 'Outro' },
];

const DEFAULT_MODULE: ModuleConfig = {
  type: 'armario_inferior',
  height: 800,
  width: 600,
  depth: 550,
  thickness: 18,
  shelves: 1,
  doors: 2,
  drawers: 0,
};

export default function ModuleConfigurator({
  modules, onModulesChange,
  mdfPricePerM2, edgeTapePricePerM,
  onMdfPriceChange, onEdgeTapePriceChange,
  onResultChange,
}: Props) {
  const { sheets, tapes, hardware, loading } = useEngineeringCatalog();
  const [activeIdx, setActiveIdx] = useState(0);

  const addModule = () => {
    onModulesChange([...modules, { ...DEFAULT_MODULE }]);
    setActiveIdx(modules.length);
  };
  const removeModule = (idx: number) => {
    onModulesChange(modules.filter((_, i) => i !== idx));
    setActiveIdx(Math.max(0, idx - 1));
  };
  const updateModule = (idx: number, field: keyof ModuleConfig, value: any) => {
    const updated = [...modules];
    (updated[idx] as any)[field] = value;
    onModulesChange(updated);
  };
  const applyTemplate = (tplModules: ModuleConfig[], mode: 'replace' | 'append') => {
    onModulesChange(mode === 'replace' ? tplModules : [...modules, ...tplModules]);
    setActiveIdx(0);
  };

  // ========= CÁLCULO GLOBAL POR MATERIAL =========
  const result = useMemo<ModuleResult>(() => {
    // Agrupa peças por chapa selecionada
    const piecesBySheet: Record<string, ReturnType<typeof explodePieces>> = {};
    const piecesByTape: Record<string, ReturnType<typeof explodePieces>> = {};

    // chapa fallback (se não houver catálogo)
    const fallbackSheetId = sheets[0]?.id ?? '__fallback__';
    const fallbackTapeId = tapes[0]?.id ?? '__fallback__';

    modules.forEach(m => {
      const pieces = explodePieces({
        height: m.height, width: m.width, depth: m.depth,
        thickness: m.thickness, shelves: m.shelves,
        doors: m.doors, drawers: m.drawers ?? 0,
      });
      const sId = m.bodySheetId || fallbackSheetId;
      const tId = m.edgeTapeId || fallbackTapeId;
      piecesBySheet[sId] = [...(piecesBySheet[sId] ?? []), ...pieces];
      piecesByTape[tId] = [...(piecesByTape[tId] ?? []), ...pieces];
    });

    const sheetCalcs: SheetCalc[] = [];
    let totalArea = 0, totalAreaWaste = 0, materialCost = 0, weightKg = 0;
    Object.entries(piecesBySheet).forEach(([sId, pcs]) => {
      const sheet = sheets.find(s => s.id === sId);
      if (!sheet) {
        // fallback usa preço/m² legado
        const fakeSheet = {
          id: '__fallback__', name: 'MDF (manual)', material_type: 'MDF',
          color: null, finish: null, thickness_mm: 18,
          sheet_width_mm: 2750, sheet_height_mm: 1850,
          price_per_sheet: 0, price_per_m2: mdfPricePerM2,
          density_kg_m3: 720, supplier: null, active: true,
        };
        const c = calculateSheetUsage(pcs, fakeSheet);
        sheetCalcs.push(c);
        totalArea += c.totalAreaM2;
        totalAreaWaste += c.areaWithWasteM2;
        materialCost += c.finalCost;
        weightKg += c.weightKg;
      } else {
        const c = calculateSheetUsage(pcs, sheet);
        sheetCalcs.push(c);
        totalArea += c.totalAreaM2;
        totalAreaWaste += c.areaWithWasteM2;
        materialCost += c.finalCost;
        weightKg += c.weightKg;
      }
    });

    const tapeCalcs: TapeCalc[] = [];
    let totalTapeM = 0, tapeCost = 0;
    Object.entries(piecesByTape).forEach(([tId, pcs]) => {
      const tape = tapes.find(t => t.id === tId);
      if (!tape) {
        const fakeTape = {
          id: '__fallback__', name: 'Fita (manual)', color: null, finish: null,
          width_mm: 22, thickness_mm: 0.4, roll_length_m: 50,
          price_per_roll: 0, price_per_m: edgeTapePricePerM,
          supplier: null, active: true,
        };
        const c = calculateTapeUsage(pcs, fakeTape);
        tapeCalcs.push(c);
        totalTapeM += c.totalMeters;
        tapeCost += c.finalCost;
      } else {
        const c = calculateTapeUsage(pcs, tape);
        tapeCalcs.push(c);
        totalTapeM += c.totalMeters;
        tapeCost += c.finalCost;
      }
    });

    // Ferragens — pega seleção do primeiro módulo (ou agrega por módulo)
    const m0 = modules[0];
    const hardwareCalcs = m0
      ? calcAutoHardware(
          modules.map(m => ({
            height: m.height, width: m.width, depth: m.depth,
            thickness: m.thickness, shelves: m.shelves,
            doors: m.doors, drawers: m.drawers ?? 0,
          })),
          {
            hingeId: m0.hingeId, handleId: m0.handleId,
            slideId: m0.slideId, shelfSupportId: m0.shelfSupportId,
          },
          hardware
        )
      : [];
    const hardwareCost = hardwareCalcs.reduce((s, h) => s + h.totalCost, 0);

    return {
      totalAreaM2: totalArea,
      totalAreaWithWaste: totalAreaWaste,
      totalEdgeTapeM: totalTapeM,
      materialCost,
      edgeTapeCost: tapeCost,
      hardwareCost,
      totalWeightKg: weightKg,
      sheetCalcs, tapeCalcs, hardwareCalcs,
    };
  }, [modules, sheets, tapes, hardware, mdfPricePerM2, edgeTapePricePerM]);

  useEffect(() => { onResultChange(result); }, [result]);

  const current = modules[activeIdx];
  const handlesByCat = (cat: string) => hardware.filter(h => h.category === cat);

  return (
    <div className="space-y-4">
      {/* Templates */}
      <ModuleTemplatePicker
        onApplyTemplate={applyTemplate}
        hasExistingModules={modules.length > 0}
      />

      {/* Lista de módulos (chips) */}
      {modules.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          {modules.map((m, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                i === activeIdx
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:border-primary/40'
              }`}
            >
              <Box className="inline h-3 w-3 mr-1" />
              {m.name || `Módulo ${i + 1}`}
            </button>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={addModule} className="h-7">
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        </div>
      )}

      {modules.length === 0 && (
        <Button type="button" variant="outline" onClick={addModule} className="w-full">
          <Plus className="h-3 w-3 mr-1" /> Criar primeiro módulo
        </Button>
      )}

      {/* Configurador do módulo ativo */}
      {current && (
        <Card className="border-primary/20 overflow-hidden">
          <CardContent className="p-0">
            {/* 3D Preview */}
            <Module3DViewer
              mod={{
                height: current.height, width: current.width, depth: current.depth,
                thickness: current.thickness, shelves: current.shelves,
                doors: current.doors, drawers: current.drawers ?? 0,
                bodyColor: sheets.find(s => s.id === current.bodySheetId)?.color || '#f5f1e8',
                frontColor: sheets.find(s => s.id === current.frontSheetId)?.color
                  || sheets.find(s => s.id === current.bodySheetId)?.color || '#ffffff',
                hasHandles: !!current.handleId,
              }}
            />

            <Tabs defaultValue="geral" className="p-4">
              <div className="flex items-center justify-between mb-3">
                <TabsList className="h-9">
                  <TabsTrigger value="geral" className="text-xs"><Info className="h-3 w-3 mr-1" /> Geral</TabsTrigger>
                  <TabsTrigger value="opcoes" className="text-xs"><Settings2 className="h-3 w-3 mr-1" /> Opções</TabsTrigger>
                  <TabsTrigger value="materiais" className="text-xs"><Palette className="h-3 w-3 mr-1" /> Materiais</TabsTrigger>
                </TabsList>
                {modules.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeModule(activeIdx)} className="h-7 w-7 p-0 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* === GERAL === */}
              <TabsContent value="geral" className="space-y-3 mt-0">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Nome do Módulo</label>
                  <Input
                    value={current.name ?? ''}
                    onChange={e => updateModule(activeIdx, 'name', e.target.value)}
                    placeholder="Ex: Cozinha — armário inferior"
                    className="h-10 text-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Tipo</label>
                  <Select value={current.type} onValueChange={v => updateModule(activeIdx, 'type', v)}>
                    <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODULE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['width','height','depth'] as const).map(field => (
                    <div key={field}>
                      <label className="text-[10px] text-muted-foreground mb-1 block">
                        {field === 'width' ? 'Largura' : field === 'height' ? 'Altura' : 'Profundidade'} (mm)
                      </label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={current[field] || ''}
                        onChange={e => updateModule(activeIdx, field, Number(e.target.value))}
                        onFocus={e => e.target.select()}
                        className="h-10 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* === OPÇÕES === */}
              <TabsContent value="opcoes" className="space-y-3 mt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Espessura MDF</label>
                    <Select value={String(current.thickness)} onValueChange={v => updateModule(activeIdx, 'thickness', Number(v))}>
                      <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 mm</SelectItem>
                        <SelectItem value="18">18 mm</SelectItem>
                        <SelectItem value="25">25 mm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block flex items-center gap-1">
                      <Layers className="h-3 w-3" /> Prateleiras
                    </label>
                    <Input
                      type="number" min={0} max={10}
                      value={current.shelves}
                      onChange={e => updateModule(activeIdx, 'shelves', Number(e.target.value))}
                      onFocus={e => e.target.select()}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Portas</label>
                    <Input
                      type="number" min={0} max={6}
                      value={current.doors}
                      onChange={e => updateModule(activeIdx, 'doors', Number(e.target.value))}
                      onFocus={e => e.target.select()}
                      className="h-10 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Gavetas</label>
                    <Input
                      type="number" min={0} max={8}
                      value={current.drawers ?? 0}
                      onChange={e => updateModule(activeIdx, 'drawers', Number(e.target.value))}
                      onFocus={e => e.target.select()}
                      className="h-10 text-sm"
                    />
                  </div>
                </div>

                {/* Ferragens */}
                <div className="bg-muted/40 rounded-lg p-3 space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ferragens</p>

                  <HardwareSelect label="Puxador" items={handlesByCat('puxador')} value={current.handleId}
                    onChange={v => updateModule(activeIdx, 'handleId', v)} />
                  <HardwareSelect label="Dobradiça" items={handlesByCat('dobradica')} value={current.hingeId}
                    onChange={v => updateModule(activeIdx, 'hingeId', v)} />
                  <HardwareSelect label="Corrediça" items={handlesByCat('corredica')} value={current.slideId}
                    onChange={v => updateModule(activeIdx, 'slideId', v)} />
                  <HardwareSelect label="Suporte de Prateleira" items={handlesByCat('prateleira_suporte')}
                    value={current.shelfSupportId}
                    onChange={v => updateModule(activeIdx, 'shelfSupportId', v)} />

                  {hardware.length === 0 && !loading && (
                    <p className="text-[10px] text-muted-foreground italic">
                      Cadastre ferragens em Configurações → Engenharia para vê-las aqui.
                    </p>
                  )}
                </div>
              </TabsContent>

              {/* === MATERIAIS === */}
              <TabsContent value="materiais" className="space-y-3 mt-0">
                <SheetSelect
                  label="Corpo (caixa)"
                  items={sheets}
                  value={current.bodySheetId}
                  onChange={v => updateModule(activeIdx, 'bodySheetId', v)}
                />
                <SheetSelect
                  label="Frente (portas/gavetas)"
                  items={sheets}
                  value={current.frontSheetId}
                  onChange={v => updateModule(activeIdx, 'frontSheetId', v)}
                />
                <TapeSelect
                  label="Fita de Borda"
                  items={tapes}
                  value={current.edgeTapeId}
                  onChange={v => updateModule(activeIdx, 'edgeTapeId', v)}
                />

                {/* Fallback manual */}
                {sheets.length === 0 && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
                    <p className="text-[10px] font-semibold text-amber-900 dark:text-amber-200">
                      Sem catálogo cadastrado — usando preços manuais:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-1 block">MDF (R$/m²)</label>
                        <Input type="number" step="0.01" value={mdfPricePerM2 || ''}
                          onChange={e => onMdfPriceChange(Number(e.target.value))}
                          onFocus={e => e.target.select()} className="h-9 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground mb-1 block">Fita (R$/m)</label>
                        <Input type="number" step="0.01" value={edgeTapePricePerM || ''}
                          onChange={e => onEdgeTapePriceChange(Number(e.target.value))}
                          onFocus={e => e.target.select()} className="h-9 text-sm" />
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* RESUMO DE ENGENHARIA */}
      {modules.length > 0 && (
        <Card className="bg-accent/30 border-accent">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-accent-foreground uppercase tracking-wider">
              Resumo de Engenharia
            </p>

            {/* Chapas */}
            {result.sheetCalcs.length > 0 && (
              <div className="space-y-1 border-b border-border/50 pb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Chapas</p>
                {result.sheetCalcs.map((c, i) => (
                  <div key={i} className="text-xs space-y-0.5">
                    <div className="flex justify-between">
                      <span className="font-medium truncate pr-2">{c.sheet.name}</span>
                      <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
                        {c.sheetsNeeded} chapa{c.sheetsNeeded > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{c.areaWithWasteM2.toFixed(2)} m² (+20% sobra)</span>
                      <span>{formatBRL(c.finalCost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Fita */}
            {result.tapeCalcs.length > 0 && (
              <div className="space-y-1 border-b border-border/50 pb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Fitas de Borda</p>
                {result.tapeCalcs.map((c, i) => (
                  <div key={i} className="text-xs space-y-0.5">
                    <div className="flex justify-between">
                      <span className="font-medium truncate pr-2">{c.tape.name}</span>
                      <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
                        {c.rollsNeeded > 0 ? `${c.rollsNeeded} rolo${c.rollsNeeded > 1 ? 's' : ''}` : `${c.metersWithWaste.toFixed(1)} m`}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{c.metersWithWaste.toFixed(1)} m lineares</span>
                      <span>{formatBRL(c.finalCost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Ferragens */}
            {result.hardwareCalcs.length > 0 && (
              <div className="space-y-1 border-b border-border/50 pb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Ferragens</p>
                {result.hardwareCalcs.map((h, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="truncate pr-2">{h.item.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px] h-5">{h.quantity} {h.item.unit}</Badge>
                      <span className="text-muted-foreground w-20 text-right">{formatBRL(h.totalCost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Totais */}
            <div className="pt-1 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Peso estimado</span>
                <span className="font-medium">{result.totalWeightKg.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo Chapas</span>
                <span className="font-semibold">{formatBRL(result.materialCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo Fita</span>
                <span className="font-semibold">{formatBRL(result.edgeTapeCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo Ferragens</span>
                <span className="font-semibold">{formatBRL(result.hardwareCost)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 text-base font-bold">
                <span>Total Engenharia</span>
                <span>{formatBRL(result.materialCost + result.edgeTapeCost + result.hardwareCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ========== Sub-componentes de seleção ==========

function SheetSelect({ label, items, value, onChange }: {
  label: string;
  items: { id: string; name: string; thickness_mm: number; color: string | null }[];
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground mb-1 block">{label}</label>
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger className="h-10 text-sm">
          <SelectValue placeholder={items.length === 0 ? 'Nenhuma chapa cadastrada' : 'Selecione…'} />
        </SelectTrigger>
        <SelectContent>
          {items.map(s => (
            <SelectItem key={s.id} value={s.id}>
              <span className="inline-flex items-center gap-2">
                {s.color && <span className="h-3 w-3 rounded border" style={{ background: s.color }} />}
                {s.name} · {s.thickness_mm}mm
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TapeSelect({ label, items, value, onChange }: {
  label: string;
  items: { id: string; name: string; width_mm: number; color: string | null }[];
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground mb-1 block">{label}</label>
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger className="h-10 text-sm">
          <SelectValue placeholder={items.length === 0 ? 'Nenhuma fita cadastrada' : 'Selecione…'} />
        </SelectTrigger>
        <SelectContent>
          {items.map(t => (
            <SelectItem key={t.id} value={t.id}>
              <span className="inline-flex items-center gap-2">
                {t.color && <span className="h-3 w-3 rounded border" style={{ background: t.color }} />}
                {t.name} · {t.width_mm}mm
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function HardwareSelect({ label, items, value, onChange }: {
  label: string;
  items: { id: string; name: string; unit_price: number }[];
  value?: string;
  onChange: (v: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-2">
      <label className="text-[11px] text-muted-foreground">{label}</label>
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          {items.map(it => (
            <SelectItem key={it.id} value={it.id}>
              {it.name} · {formatBRL(it.unit_price)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
