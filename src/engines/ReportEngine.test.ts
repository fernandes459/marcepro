import { describe, it, expect } from 'vitest';
import { buildReport } from './ReportEngine';

const txs = [
  { type: 'income', amount: 1000, status: 'paid', date: '2026-03-05', category: 'obra' },
  { type: 'expense', amount: 300, status: 'paid', date: '2026-03-10', category: 'mdf' },
  { type: 'income', amount: 500, status: 'pending', date: '2026-03-20' },
  { type: 'income', amount: 2000, status: 'paid', date: '2026-04-02' },
  { type: 'expense', amount: 50, status: 'cancelled', date: '2026-03-11' },
];

describe('ReportEngine', () => {
  it('relatório mensal conta só pagos do mês como entrada/saída', () => {
    const r = buildReport({ transactions: txs, kind: 'month', year: 2026, month: 3, todayISO: '2026-03-01' });
    expect(r.summary.income).toBe(1000);
    expect(r.summary.expense).toBe(300);
    expect(r.summary.profit).toBe(700);
    expect(r.summary.receivable).toBe(500);
    expect(r.months).toHaveLength(6);
  });
  it('relatório anual soma o ano inteiro em 12 meses', () => {
    const r = buildReport({ transactions: txs, kind: 'year', year: 2026, todayISO: '2026-01-01' });
    expect(r.summary.income).toBe(3000);
    expect(r.months).toHaveLength(12);
    expect(r.months[3].income).toBe(2000);
  });
});
