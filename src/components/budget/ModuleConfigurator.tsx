import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Ruler, Box, Layers } from 'lucide-react';
import { formatBRL } from '@/lib/format';
import ModuleTemplatePicker from './ModuleTemplatePicker';

export interface ModuleConfig {
  type: string;
  height: number;
  width: number;
  depth: number;
  thickness: number;
  shelves: number;
  doors: number;
}

export interface PieceItem {
  name: string;
  quantity: number;
  height: number;
  width: number;
  area: number; // m²
  edgeTape: number; // metros lineares
}

export interface ModuleResult {
  pieces: PieceItem[];
  totalAreaM2: number;
  totalAreaWithWaste: number;
  totalEdgeTapeM: number;
  materialCost: number;
  edgeTapeCost: number;
}

interface ModuleConfiguratorProps {
  modules: ModuleConfig[];
  onModulesChange: (modules: ModuleConfig[]) => void;
  mdfPricePerM2: number;
  edgeTapePricePerM: number;
  onMdfPriceChange: (v: number) => void;
  onEdgeTapePriceChange: (v: number) => void;
  onResultChange: (result: ModuleResult) => void;
}

const MODULE_TYPES = [
  { value: 'armario_superior', label: 'Armário Superior' },
  { value: 'armario_inferior', label: 'Armário Inferior' },
  { value: 'balcao', label: 'Balcão' },
  { value: 'estante', label: 'Estante' },
  { value: 'painel', label: 'Painel' },
  { value: 'bancada', label: 'Bancada' },
  { value: 'gaveteiro', label: 'Gaveteiro' },
  { value: 'outro', label: 'Outro' },
];

const THICKNESS_OPTIONS = [
  { value: '15', label: '15mm' },
  { value: '18', label: '18mm' },
];

const DEFAULT_MODULE: ModuleConfig = {
  type: 'armario_inferior',
  height: 800,
  width: 600,
  depth: 550,
  thickness: 18,
  shelves: 1,
  doors: 2,
};

function explodePieces(mod: ModuleConfig): PieceItem[] {
  const { height, width, depth, thickness, shelves, doors } = mod;
  const t = thickness;
  const pieces: PieceItem[] = [];

  // Laterais (2)
  const latH = height;
  const latW = depth;
  pieces.push({
    name: 'Lateral',
    quantity: 2,
    height: latH,
    width: latW,
    area: (latH * latW) / 1_000_000,
    edgeTape: (latH + latW) * 2 / 1000, // 4 lados visíveis
  });

  // Base e Tampo (2)
  const btH = width - 2 * t;
  const btW = depth;
  pieces.push({
    name: 'Base / Tampo',
    quantity: 2,
    height: btH,
    width: btW,
    area: (btH * btW) / 1_000_000,
    edgeTape: (btH * 2) / 1000, // borda frontal
  });

  // Fundo (1)
  const fundoH = height - 2 * t;
  const fundoW = width - 2 * t;
  pieces.push({
    name: 'Fundo (3mm)',
    quantity: 1,
    height: fundoH,
    width: fundoW,
    area: (fundoH * fundoW) / 1_000_000,
    edgeTape: 0,
  });

  // Prateleiras
  if (shelves > 0) {
    const pratH = width - 2 * t;
    const pratW = depth - 20; // recuo de 20mm
    pieces.push({
      name: 'Prateleira',
      quantity: shelves,
      height: pratH,
      width: pratW,
      area: (pratH * pratW) / 1_000_000,
      edgeTape: (pratH) / 1000, // borda frontal apenas
    });
  }

  // Portas
  if (doors > 0) {
    const portaH = height - 4; // folga de 2mm em cima e embaixo
    const portaW = (width / doors) - 4; // folga entre portas
    pieces.push({
      name: 'Porta',
      quantity: doors,
      height: portaH,
      width: portaW,
      area: (portaH * portaW) / 1_000_000,
      edgeTape: ((portaH + portaW) * 2) / 1000, // 4 lados
    });
  }

  return pieces;
}

function ModuleSVG({ mod }: { mod: ModuleConfig }) {
  const { height, width, depth, thickness, shelves, doors } = mod;

  // Scale to fit SVG viewbox
  const maxDim = Math.max(width, height);
  const scale = 200 / maxDim;
  const sW = width * scale;
  const sH = height * scale;
  const sT = Math.max(thickness * scale, 2);
  const padding = 30;
  const viewW = sW + padding * 2 + 60;
  const viewH = sH + padding * 2 + 40;
  const ox = padding + 40;
  const oy = padding + 10;

  // Shelf positions
  const shelfPositions: number[] = [];
  if (shelves > 0) {
    const innerH = sH - 2 * sT;
    const gap = innerH / (shelves + 1);
    for (let i = 1; i <= shelves; i++) {
      shelfPositions.push(oy + sT + gap * i);
    }
  }

  // Door widths
  const doorRects: { x: number; w: number }[] = [];
  if (doors > 0) {
    const doorW = sW / doors;
    for (let i = 0; i < doors; i++) {
      doorRects.push({ x: ox + doorW * i + 1, w: doorW - 2 });
    }
  }

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} className="w-full max-w-[320px] mx-auto" style={{ height: 'auto' }}>
      {/* Background */}
      <rect x="0" y="0" width={viewW} height={viewH} fill="hsl(var(--muted))" rx="8" />

      {/* Cabinet body */}
      <rect x={ox} y={oy} width={sW} height={sH} fill="hsl(var(--card))" stroke="hsl(var(--foreground))" strokeWidth="1.5" rx="2" />

      {/* Left side */}
      <rect x={ox} y={oy} width={sT} height={sH} fill="hsl(var(--accent))" stroke="hsl(var(--foreground))" strokeWidth="0.8" />

      {/* Right side */}
      <rect x={ox + sW - sT} y={oy} width={sT} height={sH} fill="hsl(var(--accent))" stroke="hsl(var(--foreground))" strokeWidth="0.8" />

      {/* Top */}
      <rect x={ox} y={oy} width={sW} height={sT} fill="hsl(var(--accent))" stroke="hsl(var(--foreground))" strokeWidth="0.8" />

      {/* Bottom */}
      <rect x={ox} y={oy + sH - sT} width={sW} height={sT} fill="hsl(var(--accent))" stroke="hsl(var(--foreground))" strokeWidth="0.8" />

      {/* Shelves */}
      {shelfPositions.map((sy, i) => (
        <rect key={`shelf-${i}`} x={ox + sT} y={sy - sT / 2} width={sW - 2 * sT} height={sT} fill="hsl(var(--primary) / 0.3)" stroke="hsl(var(--primary))" strokeWidth="0.8" strokeDasharray="4 2" />
      ))}

      {/* Door lines */}
      {doorRects.map((d, i) => (
        <g key={`door-${i}`}>
          <rect x={d.x} y={oy + 2} width={d.w} height={sH - 4} fill="none" stroke="hsl(var(--primary))" strokeWidth="0.8" strokeDasharray="6 3" rx="1" />
          {/* Door handle */}
          <circle cx={i === 0 ? d.x + d.w - 8 : d.x + 8} cy={oy + sH / 2} r="2.5" fill="hsl(var(--primary))" />
        </g>
      ))}

      {/* Dimension labels */}
      {/* Width */}
      <line x1={ox} y1={oy + sH + 15} x2={ox + sW} y2={oy + sH + 15} stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" markerStart="url(#arrowL)" markerEnd="url(#arrowR)" />
      <text x={ox + sW / 2} y={oy + sH + 28} textAnchor="middle" fontSize="10" fill="hsl(var(--foreground))" fontWeight="600">{width}mm</text>

      {/* Height */}
      <line x1={ox - 15} y1={oy} x2={ox - 15} y2={oy + sH} stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" />
      <text x={ox - 20} y={oy + sH / 2} textAnchor="middle" fontSize="10" fill="hsl(var(--foreground))" fontWeight="600" transform={`rotate(-90, ${ox - 20}, ${oy + sH / 2})`}>{height}mm</text>

      {/* Depth label */}
      <text x={ox + sW + 8} y={oy + 14} fontSize="9" fill="hsl(var(--muted-foreground))">P: {depth}mm</text>
      <text x={ox + sW + 8} y={oy + 26} fontSize="9" fill="hsl(var(--muted-foreground))">E: {thickness}mm</text>

      {/* Arrow markers */}
      <defs>
        <marker id="arrowL" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto"><path d="M6,0 L0,3 L6,6" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" /></marker>
        <marker id="arrowR" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" /></marker>
      </defs>
    </svg>
  );
}

export default function ModuleConfigurator({
  modules,
  onModulesChange,
  mdfPricePerM2,
  edgeTapePricePerM,
  onMdfPriceChange,
  onEdgeTapePriceChange,
  onResultChange,
}: ModuleConfiguratorProps) {
  const addModule = () => onModulesChange([...modules, { ...DEFAULT_MODULE }]);
  const removeModule = (idx: number) => onModulesChange(modules.filter((_, i) => i !== idx));
  const updateModule = (idx: number, field: keyof ModuleConfig, value: number | string) => {
    const updated = [...modules];
    (updated[idx] as any)[field] = value;
    onModulesChange(updated);
  };

  const result = useMemo(() => {
    const allPieces: PieceItem[] = [];
    modules.forEach(mod => {
      const pieces = explodePieces(mod);
      pieces.forEach(p => {
        const existing = allPieces.find(ep => ep.name === p.name && ep.height === p.height && ep.width === p.width);
        if (existing) {
          existing.quantity += p.quantity;
          existing.area += p.area;
          existing.edgeTape += p.edgeTape;
        } else {
          allPieces.push({ ...p });
        }
      });
    });

    const totalAreaM2 = allPieces.reduce((s, p) => s + p.area * p.quantity, 0);
    const totalAreaWithWaste = totalAreaM2 * 1.2; // 20% sobra técnica
    const totalEdgeTapeM = allPieces.reduce((s, p) => s + p.edgeTape * p.quantity, 0);
    const materialCost = totalAreaWithWaste * mdfPricePerM2;
    const edgeTapeCost = totalEdgeTapeM * edgeTapePricePerM;

    return { pieces: allPieces, totalAreaM2, totalAreaWithWaste, totalEdgeTapeM, materialCost, edgeTapeCost };
  }, [modules, mdfPricePerM2, edgeTapePricePerM]);

  useEffect(() => {
    onResultChange(result);
  }, [result]);

  return (
    <div className="space-y-4">
      {/* Price config */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Preço MDF (R$/m²)</label>
          <Input type="number" step="0.01" value={mdfPricePerM2 || ''} onChange={e => onMdfPriceChange(Number(e.target.value))} placeholder="Ex: 85.00" className="text-sm h-9" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Fita de Borda (R$/m)</label>
          <Input type="number" step="0.01" value={edgeTapePricePerM || ''} onChange={e => onEdgeTapePriceChange(Number(e.target.value))} placeholder="Ex: 2.50" className="text-sm h-9" />
        </div>
      </div>

      {/* Modules */}
      {modules.map((mod, idx) => {
        const pieces = explodePieces(mod);
        const modArea = pieces.reduce((s, p) => s + p.area * p.quantity, 0);

        return (
          <Card key={idx} className="border-primary/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Módulo {idx + 1}</span>
                </div>
                {modules.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeModule(idx)} className="h-7 w-7 p-0 text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Tipo de Módulo</label>
                  <Select value={mod.type} onValueChange={v => updateModule(idx, 'type', v)}>
                    <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODULE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Espessura MDF</label>
                  <Select value={String(mod.thickness)} onValueChange={v => updateModule(idx, 'thickness', Number(v))}>
                    <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {THICKNESS_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block flex items-center gap-1"><Ruler className="h-3 w-3" /> Altura (mm)</label>
                  <Input type="number" value={mod.height || ''} onChange={e => updateModule(idx, 'height', Number(e.target.value))} className="text-sm h-9" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Largura (mm)</label>
                  <Input type="number" value={mod.width || ''} onChange={e => updateModule(idx, 'width', Number(e.target.value))} className="text-sm h-9" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Profundidade (mm)</label>
                  <Input type="number" value={mod.depth || ''} onChange={e => updateModule(idx, 'depth', Number(e.target.value))} className="text-sm h-9" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block flex items-center gap-1"><Layers className="h-3 w-3" /> Prateleiras</label>
                  <Input type="number" min="0" max="10" value={mod.shelves} onChange={e => updateModule(idx, 'shelves', Number(e.target.value))} className="text-sm h-9" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Portas</label>
                  <Input type="number" min="0" max="6" value={mod.doors} onChange={e => updateModule(idx, 'doors', Number(e.target.value))} className="text-sm h-9" />
                </div>
              </div>

              {/* SVG Visualization */}
              <ModuleSVG mod={mod} />

              {/* Piece list */}
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Explosão de Peças</p>
                <div className="space-y-1">
                  {pieces.map((p, pi) => (
                    <div key={pi} className="flex items-center justify-between text-xs">
                      <span>{p.name} <span className="text-muted-foreground">({p.height.toFixed(0)} × {p.width.toFixed(0)}mm)</span></span>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="text-[10px] h-5">{p.quantity}x</Badge>
                        <span className="text-muted-foreground w-16 text-right">{(p.area * p.quantity).toFixed(3)} m²</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border mt-2 pt-2 text-xs flex justify-between font-medium">
                  <span>Área total do módulo</span>
                  <span>{modArea.toFixed(3)} m²</span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={addModule} className="w-full">
        <Plus className="h-3 w-3 mr-1" /> Adicionar Módulo
      </Button>

      {/* Totals */}
      {modules.length > 0 && (
        <Card className="bg-accent/30 border-accent">
          <CardContent className="p-4 space-y-1.5">
            <p className="text-xs font-semibold text-accent-foreground uppercase tracking-wider mb-2">Resumo de Engenharia</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Área total de MDF</span>
              <span className="font-medium">{result.totalAreaM2.toFixed(3)} m²</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Com sobra técnica (+20%)</span>
              <span className="font-medium">{result.totalAreaWithWaste.toFixed(3)} m²</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Fita de borda total</span>
              <span className="font-medium">{result.totalEdgeTapeM.toFixed(1)} m</span>
            </div>
            <div className="border-t border-border pt-2 mt-2 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Custo MDF ({formatBRL(mdfPricePerM2)}/m²)</span>
                <span className="font-semibold">{formatBRL(result.materialCost)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Custo Fita ({formatBRL(edgeTapePricePerM)}/m)</span>
                <span className="font-semibold">{formatBRL(result.edgeTapeCost)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-border pt-1">
                <span>Custo Total Material</span>
                <span>{formatBRL(result.materialCost + result.edgeTapeCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
