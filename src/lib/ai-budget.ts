import Decimal from 'decimal.js';
import type { CostBreakdown } from './orcamento-costs';

export const BUDGET_META_RE = /\n?<!--BUDGET_META:(.*?)-->\n?/s;
export function readBudgetMeta(notes: string | null | undefined): Record<string, any> {
  const match = (notes || '').match(BUDGET_META_RE);
  try { return match ? JSON.parse(match[1]) : {}; } catch { return {}; }
}

/** Legacy AI budgets must retain their persisted sale price, not a different markup. */
export function savedBudgetPrice(budget: { notes?: string | null; source?: string | null; final_price: number }): number {
  const meta = readBudgetMeta(budget.notes);
  if (meta.fixedPrice !== undefined) return Number(meta.fixedPrice) || 0;
  if (meta.priceMode === 'calculated') return 0;
  return budget.source === 'Orçamentista IA' ? Number(budget.final_price) || 0 : 0;
}

const d = (value: unknown) => new Decimal(Number(value) || 0);
export function unifyAiItems<T extends { room_label?: string | null; unit_price: number }>(items: T[]): T[] {
  const realRooms = items.map(i => i.room_label).filter((label): label is string => Boolean(label) && !['Geral', 'Ferragens'].includes(String(label)));
  const firstRoom = realRooms[0] || 'Projeto';
  return items.map(item => !item.room_label || ['Geral', 'Ferragens'].includes(item.room_label)
    ? { ...item, room_label: firstRoom, unit_price: 0 } : item);
}
export function buildAiBudget(result: any, salePrice: number, costs: CostBreakdown, inputs: Record<string, any>) {
  const price = d(salePrice).toDecimalPlaces(2);
  const variablePct = d(inputs.comissao).plus(inputs.montador).plus(inputs.impostos).plus(inputs.cartao);
  const variableCost = price.times(variablePct).div(100);
  const totalCost = d(costs.custoDireto).plus(variableCost).toDecimalPlaces(2);
  const rooms: any[] = result.ambientes?.length ? result.ambientes : [{ nome: 'Projeto', descricao: inputs.notes || inputs.material }];
  const names = rooms.map(r => String(r.nome || 'Projeto'));
  const area = rooms.reduce((sum: Decimal, room: any) => sum.plus(d(room.area_m2)), d(0));
  let allocated = d(0);
  const items = rooms.map((room: any, index: number) => {
    const share = index === rooms.length - 1 ? price.minus(allocated)
      : (area.gt(0) ? price.times(d(room.area_m2)).div(area) : price.div(rooms.length)).toDecimalPlaces(2);
    allocated = allocated.plus(share);
    return { name: room.descricao || room.nome || 'Projeto', quantity: 1, material_cost: 0, labor_cost: 0,
      unit_price: share.toNumber(), room_label: names[index], unit: 'un' };
  });
  for (const supply of [...(result.materiais || []), ...(result.ferragens || [])]) {
    const label = supply.ambiente || supply.room_label;
    items.push({ name: supply.descricao || supply.item || 'Item', quantity: Number(supply.quantidade) > 0 ? Number(supply.quantidade) : 1,
      material_cost: Number(supply.valor_unitario) || 0, labor_cost: 0, unit_price: 0,
      room_label: names.includes(label) ? label : names[0], unit: supply.unidade || 'un' });
  }
  const materialCost = items.reduce((sum, item) => sum.plus(d(item.material_cost).times(item.quantity)), d(0));
  const meta = {
    fixedPrice: price.toNumber(), priceMode: 'fixed', unifiedProposal: true,
    environments: names, itemUnits: items.map(i => i.unit), includeOverhead: false,
    extraOther: totalCost.minus(materialCost).toNumber(), extraFreight: 0, extraTaxes: 0,
    productionDays: Number(inputs.prazoDias) || 0, commissionPctOverride: Number(inputs.comissao) || 0,
    cardFeePercent: Number(inputs.cartao) || 0,
    aiSnapshot: { version: 1, result, inputs, costs: { ...costs, venda: price.toNumber(), variaveis: variableCost.toNumber(), custoTotal: totalCost.toNumber(), lucroLiquido: price.minus(totalCost).toNumber() } },
  };
  return { price: price.toNumber(), totalCost: totalCost.toNumber(), items, meta,
    notes: `${result.recomendacao_comercial?.justificativa || ''}\n<!--BUDGET_META:${JSON.stringify(meta)}-->`,
    margin: totalCost.gt(0) ? price.minus(totalCost).div(totalCost).times(100).toDecimalPlaces(2).toNumber() : 0 };
}