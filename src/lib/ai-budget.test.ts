import { describe, expect, it } from 'vitest';
import { buildAiBudget, readBudgetMeta, savedBudgetPrice, unifyAiItems, restoreAiQuantities } from './ai-budget';
import { computeCosts } from './orcamento-costs';

const inputs = { comissao: 5, montador: 3, impostos: 2, cartao: 4, prazoDias: 20, material: 'MDF', specs: { Corrediças: 'Soft-close' } };
const costs = computeCosts({ material: 100, ferragens: 25, estruturaPct: 0, custoDiario: 0, dias: 20, overheadPct: 0, frete: 0, comissaoPct: 5, montadorPct: 3, impostosPct: 2, cartaoPct: 4, margemPct: 30 });
const result = { ambientes: [{ nome: 'Cozinha', area_m2: 1 }, { nome: 'Suíte', area_m2: 1 }, { nome: 'Sala', area_m2: 1 }], materiais: [{ descricao: 'MDF', quantidade: 0.5, valor_unitario: 200 }], ferragens: [{ item: 'Dobradiça soft-close', quantidade: 5, valor_unitario: 5 }] };
describe('AI budget persistence', () => {
  it('preserves the full selected price after serialization and reopening', () => {
    const draft = buildAiBudget(result, 8803.88, costs, inputs);
    expect(savedBudgetPrice({ notes: draft.notes, final_price: draft.price, source: 'Orçamentista IA' })).toBe(8803.88);
    expect(readBudgetMeta(draft.notes).aiSnapshot.result).toEqual(result);
    expect(readBudgetMeta(draft.notes).aiSnapshot.inputs).toEqual(inputs);
  });
  it('keeps hardware and fractional materials without adding their costs to the sale', () => {
    const draft = buildAiBudget(result, 8803.88, costs, inputs);
    expect(draft.items.reduce((sum, item) => sum + Math.round(item.unit_price * item.quantity * 100), 0)).toBe(880388);
    expect(draft.items[3].quantity).toBe(0.5);
    expect(draft.storageItems[3]).toMatchObject({ quantity: 1, material_cost: 100 });
    expect(restoreAiQuantities(draft.storageItems, readBudgetMeta(draft.notes))[3].quantity).toBe(0.5);
    expect(draft.items[4]).toMatchObject({ name: 'Dobradiça soft-close', unit_price: 0, room_label: 'Cozinha' });
    expect(draft.totalCost).toBe(1357.54);
  });
  it('preserves the price of older AI budgets and supports explicit recalculation', () => {
    expect(savedBudgetPrice({ source: 'Orçamentista IA', final_price: 8803.88 })).toBe(8803.88);
    expect(savedBudgetPrice({ source: 'Orçamentista IA', final_price: 8803.88, notes: '<!--BUDGET_META:{"priceMode":"calculated"}-->' })).toBe(0);
  });
  it('unifies legacy hardware with the project instead of selling it twice', () => {
    expect(unifyAiItems([{ room_label: 'Cozinha', unit_price: 8803.88 }, { room_label: 'Ferragens', unit_price: 250 }])).toEqual([
      { room_label: 'Cozinha', unit_price: 8803.88 }, { room_label: 'Cozinha', unit_price: 0 },
    ]);
  });
});