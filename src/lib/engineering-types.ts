// Tipos compartilhados do motor de engenharia

export interface SheetMaterial {
  id: string;
  name: string;
  material_type: string;
  color: string | null;
  finish: string | null;
  thickness_mm: number;
  sheet_width_mm: number;
  sheet_height_mm: number;
  price_per_sheet: number;
  price_per_m2: number;
  density_kg_m3: number;
  supplier: string | null;
  active: boolean;
}

export interface EdgeTape {
  id: string;
  name: string;
  color: string | null;
  finish: string | null;
  width_mm: number;
  thickness_mm: number;
  roll_length_m: number;
  price_per_roll: number;
  price_per_m: number;
  supplier: string | null;
  active: boolean;
}

export type HardwareCategory =
  | 'puxador'
  | 'dobradica'
  | 'corredica'
  | 'parafuso'
  | 'sapata'
  | 'prateleira_suporte'
  | 'outro';

export interface HardwareItem {
  id: string;
  name: string;
  category: HardwareCategory;
  unit: string;
  unit_price: number;
  length_mm: number | null;
  finish: string | null;
  brand: string | null;
  supplier: string | null;
  active: boolean;
}

export const HARDWARE_CATEGORIES: { value: HardwareCategory; label: string }[] = [
  { value: 'puxador', label: 'Puxador' },
  { value: 'dobradica', label: 'Dobradiça' },
  { value: 'corredica', label: 'Corrediça' },
  { value: 'parafuso', label: 'Parafuso' },
  { value: 'sapata', label: 'Sapata / Pé' },
  { value: 'prateleira_suporte', label: 'Suporte de Prateleira' },
  { value: 'outro', label: 'Outro' },
];
