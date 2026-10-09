/**
 * REPORT ENGINE — monta o relatório financeiro mensal ou anual.
 * Usa as regras canônicas de `summarizeFinance` (só pagos contam como entrada/saída).
 */
import Decimal from 'decimal.js';
import { summarizeFinance, type FinanceSummary, type FinanceTx } from '@/lib/finance-calc';

export interface ReportTx extends FinanceTx {
  category?: string | null;
  client_id?: string | null;
}

export interface ReportInput {
  transactions: ReportTx[];
  kind: 'month' | 'year';
  year: number;
  month?: number; // 1-12, obrigatório quando kind = month
  categoryLabel?: (cat: string) => string;
  clientName?: (id: string) => string;
  todayISO?: string;
}

export interface ReportMonthRow { key: string; label: string; income: number; expense: number; result: number }
export interface ReportData {
  kind: 'month' | 'year';
  label: string;
  start: string;
  end: string;
  summary: FinanceSummary;
  months: ReportMonthRow[];
  expenseCategories: { name: string; value: number }[];
  incomeCategories: { name: string; value: number }[];
  topClients: { name: string; value: number }[];
  txCount: number;
}

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
const inRange = (d: string | null | undefined, s: string, e: string) => !!d && d.slice(0, 10) >= s && d.slice(0, 10) <= e;

function group(txs: ReportTx[], key: (t: ReportTx) => string) {
  const map = new Map<string, Decimal>();
  txs.forEach((t) => {
    const k = key(t);
    map.set(k, (map.get(k) ?? new Decimal(0)).plus(new Decimal(t.amount || 0)));
  });
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, value: v.toNumber() }))
    .sort((a, b) => b.value - a.value);
}

export function buildReport(input: ReportInput): ReportData {
  const { transactions, kind, year } = input;
  const month = input.month ?? 1;
  const catLabel = input.categoryLabel ?? ((c: string) => c || 'Outros');
  const cliName = input.clientName ?? ((id: string) => id);

  const start = kind === 'year' ? `${year}-01-01` : `${year}-${pad(month)}-01`;
  const end = kind === 'year' ? `${year}-12-31` : `${year}-${pad(month)}-${pad(lastDay(year, month))}`;
  const inPeriod = transactions.filter((t) => t.status !== 'cancelled' && inRange(t.date, start, end));
  const summary = summarizeFinance(inPeriod, input.todayISO);

  // Linhas mensais: ano → 12 meses; mês → últimos 6 meses até o mês escolhido.
  const monthKeys: { y: number; m: number }[] = [];
  if (kind === 'year') for (let m = 1; m <= 12; m++) monthKeys.push({ y: year, m });
  else for (let i = 5; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1);
    monthKeys.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }
  const months = monthKeys.map(({ y, m }) => {
    const s = `${y}-${pad(m)}-01`;
    const e = `${y}-${pad(m)}-${pad(lastDay(y, m))}`;
    const sm = summarizeFinance(transactions.filter((t) => t.status !== 'cancelled' && inRange(t.date, s, e)), input.todayISO);
    return { key: `${y}-${pad(m)}`, label: `${MONTHS[m - 1]}/${String(y).slice(2)}`, income: sm.income, expense: sm.expense, result: sm.profit };
  });

  const paid = inPeriod.filter((t) => t.status === 'paid');
  const expenseCategories = group(paid.filter((t) => t.type === 'expense'), (t) => catLabel(t.category || ''));
  const incomeCategories = group(paid.filter((t) => t.type === 'income'), (t) => catLabel(t.category || ''));
  const topClients = group(paid.filter((t) => t.type === 'income' && t.client_id), (t) => cliName(t.client_id!)).slice(0, 5);

  const label = kind === 'year'
    ? `Ano de ${year}`
    : new Date(year, month - 1, 15).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return { kind, label, start, end, summary, months, expenseCategories, incomeCategories, topClients, txCount: inPeriod.length };
}
