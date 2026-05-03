import Decimal from 'decimal.js';
import type { SheetMaterial, EdgeTape, HardwareItem } from './engineering-types';

export interface PieceItem {
  name: string;
  quantity: number;
  height: number; // mm
  width: number;  // mm
  area: number;   // m² (per piece)
  edgeTape: number; // m linear (per piece)
}

export interface ModuleEngineeringInput {
  height: number;   // mm
  width: number;    // mm
  depth: number;    // mm
  thickness: number;// mm
  shelves: number;
  doors: number;
  drawers: number;
}

export function explodePieces(mod: ModuleEngineeringInput): PieceItem[] {
  const { height, width, depth, thickness, shelves, doors, drawers } = mod;
  const t = thickness;
  const pieces: PieceItem[] = [];

  // Laterais (2)
  pieces.push({
    name: 'Lateral',
    quantity: 2,
    height,
    width: depth,
    area: (height * depth) / 1_000_000,
    edgeTape: ((height + depth) * 2) / 1000,
  });

  // Base e Tampo (2)
  const btW = width - 2 * t;
  pieces.push({
    name: 'Base / Tampo',
    quantity: 2,
    height: btW,
    width: depth,
    area: (btW * depth) / 1_000_000,
    edgeTape: btW / 1000,
  });

  // Fundo
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
    const pratW = depth - 20;
    pieces.push({
      name: 'Prateleira',
      quantity: shelves,
      height: pratH,
      width: pratW,
      area: (pratH * pratW) / 1_000_000,
      edgeTape: pratH / 1000,
    });
  }

  // Portas
  if (doors > 0 && drawers === 0) {
    const portaH = height - 4;
    const portaW = width / doors - 4;
    pieces.push({
      name: 'Porta',
      quantity: doors,
      height: portaH,
      width: portaW,
      area: (portaH * portaW) / 1_000_000,
      edgeTape: ((portaH + portaW) * 2) / 1000,
    });
  }

  // Frentes de gaveta
  if (drawers > 0) {
    const frenteH = (height - 2 * t) / drawers - 4;
    const frenteW = width - 4;
    pieces.push({
      name: 'Frente Gaveta',
      quantity: drawers,
      height: frenteH,
      width: frenteW,
      area: (frenteH * frenteW) / 1_000_000,
      edgeTape: ((frenteH + frenteW) * 2) / 1000,
    });
    // Caixa de gaveta (laterais + frente int + fundo) - simplificado
    const caixaH = depth - 30;
    const caixaW = (height - 2 * t) / drawers - 30;
    pieces.push({
      name: 'Caixa Gaveta (lateral)',
      quantity: drawers * 2,
      height: caixaH,
      width: caixaW,
      area: (caixaH * caixaW) / 1_000_000,
      edgeTape: caixaW / 1000,
    });
  }

  return pieces;
}

export interface SheetCalc {
  sheet: SheetMaterial;
  totalAreaM2: number;
  areaWithWasteM2: number;
  sheetsNeeded: number;
  costBySheet: number;
  costByM2: number;
  finalCost: number; // max(costBySheet, costByM2) - usually sheets
  weightKg: number;
}

export interface TapeCalc {
  tape: EdgeTape;
  totalMeters: number;
  metersWithWaste: number;
  rollsNeeded: number;
  costByRoll: number;
  costByMeter: number;
  finalCost: number;
}

export interface HardwareCalc {
  item: HardwareItem;
  quantity: number;
  totalCost: number;
}

/**
 * Calcula necessidade de chapas, fitas e ferragens com decimal.js para evitar erros de ponto flutuante.
 * Sobra técnica padrão: 20% MDF, 10% fita.
 */
export function calculateSheetUsage(
  pieces: PieceItem[],
  sheet: SheetMaterial,
  wastePct = 20
): SheetCalc {
  const totalArea = pieces.reduce(
    (acc, p) => acc.plus(new Decimal(p.area).times(p.quantity)),
    new Decimal(0)
  );
  const areaWithWaste = totalArea.times(1 + wastePct / 100);
  const sheetAreaM2 = new Decimal(sheet.sheet_width_mm)
    .times(sheet.sheet_height_mm)
    .div(1_000_000);

  const sheetsNeeded = sheetAreaM2.gt(0)
    ? areaWithWaste.div(sheetAreaM2).ceil().toNumber()
    : 0;

  const costBySheet = new Decimal(sheetsNeeded).times(sheet.price_per_sheet);
  const costByM2 = areaWithWaste.times(sheet.price_per_m2);
  // Use sheets cost when defined, else m² cost
  const finalCost = sheet.price_per_sheet > 0 ? costBySheet : costByM2;
  // Weight: thickness(m) * area(m²) * density(kg/m³)
  const weightKg = areaWithWaste
    .times(sheet.thickness_mm / 1000)
    .times(sheet.density_kg_m3);

  return {
    sheet,
    totalAreaM2: totalArea.toNumber(),
    areaWithWasteM2: areaWithWaste.toNumber(),
    sheetsNeeded,
    costBySheet: costBySheet.toNumber(),
    costByM2: costByM2.toNumber(),
    finalCost: finalCost.toNumber(),
    weightKg: weightKg.toNumber(),
  };
}

export function calculateTapeUsage(
  pieces: PieceItem[],
  tape: EdgeTape,
  wastePct = 10
): TapeCalc {
  const totalMeters = pieces.reduce(
    (acc, p) => acc.plus(new Decimal(p.edgeTape).times(p.quantity)),
    new Decimal(0)
  );
  const metersWithWaste = totalMeters.times(1 + wastePct / 100);
  const rollsNeeded = tape.roll_length_m > 0
    ? metersWithWaste.div(tape.roll_length_m).ceil().toNumber()
    : 0;
  const costByRoll = new Decimal(rollsNeeded).times(tape.price_per_roll);
  const costByMeter = metersWithWaste.times(tape.price_per_m);
  const finalCost = tape.price_per_roll > 0 ? costByRoll : costByMeter;

  return {
    tape,
    totalMeters: totalMeters.toNumber(),
    metersWithWaste: metersWithWaste.toNumber(),
    rollsNeeded,
    costByRoll: costByRoll.toNumber(),
    costByMeter: costByMeter.toNumber(),
    finalCost: finalCost.toNumber(),
  };
}

/**
 * Calcula ferragens automaticamente baseado em portas/gavetas/prateleiras.
 * - 2 dobradiças por porta (ou 3 se altura > 1200mm)
 * - 1 puxador por porta/gaveta
 * - 1 par de corrediças por gaveta
 * - 4 suportes por prateleira
 */
export function calcAutoHardware(
  modules: ModuleEngineeringInput[],
  catalog: { hingeId?: string; handleId?: string; slideId?: string; shelfSupportId?: string },
  hardwareItems: HardwareItem[]
): HardwareCalc[] {
  const result: HardwareCalc[] = [];
  let totalDoors = 0;
  let totalDrawers = 0;
  let totalShelves = 0;
  let totalHinges = 0;

  modules.forEach(m => {
    totalDoors += m.doors;
    totalDrawers += m.drawers;
    totalShelves += m.shelves;
    totalHinges += m.doors * (m.height > 1200 ? 3 : 2);
  });

  const find = (id?: string) => hardwareItems.find(h => h.id === id);

  const hinge = find(catalog.hingeId);
  if (hinge && totalHinges > 0) {
    result.push({ item: hinge, quantity: totalHinges, totalCost: hinge.unit_price * totalHinges });
  }

  const handle = find(catalog.handleId);
  const totalHandles = totalDoors + totalDrawers;
  if (handle && totalHandles > 0) {
    result.push({ item: handle, quantity: totalHandles, totalCost: handle.unit_price * totalHandles });
  }

  const slide = find(catalog.slideId);
  if (slide && totalDrawers > 0) {
    // Cada gaveta usa 1 par (vendido como par ou unidade — assumimos par)
    result.push({ item: slide, quantity: totalDrawers, totalCost: slide.unit_price * totalDrawers });
  }

  const support = find(catalog.shelfSupportId);
  if (support && totalShelves > 0) {
    const qty = totalShelves * 4;
    result.push({ item: support, quantity: qty, totalCost: support.unit_price * qty });
  }

  return result;
}
