import { describe, it, expect } from 'vitest';
import { projectCashFlow } from './CashFlowEngine';

const today = '2026-10-06';

describe('projectCashFlow', () => {
  it('overdue open items fall into the current month', () => {
    const r = projectCashFlow([{ type: 'income', amount: 1000, status: 'overdue', date: '2026-08-01' }], 0, 3, today);
    expect(r[0].entradas).toBe(1000);
  });

  it('partial items use saldo_aberto, paid/cancelled are ignored', () => {
    const r = projectCashFlow([
      { type: 'income', amount: 8803.88, saldo_aberto: 4503.88, status: 'parcial', date: '2026-11-10' },
      { type: 'income', amount: 500, status: 'paid', date: '2026-11-10' },
      { type: 'expense', amount: 300, status: 'cancelled', date: '2026-11-10' },
    ], 0, 3, today);
    expect(r[1].entradas).toBe(4503.88);
    expect(r[1].saidas).toBe(0);
  });

  it('running balance starts from current bank balance', () => {
    const r = projectCashFlow([
      { type: 'expense', amount: 2000, status: 'pending', date: '2026-10-20' },
      { type: 'income', amount: 500, status: 'pending', date: '2026-11-05', due_date: '2026-11-05' },
    ], 10000, 2, today);
    expect(r[0].saldoFinal).toBe(8000);
    expect(r[1].saldoFinal).toBe(8500);
  });
});
