/**
 * CASH FLOW ENGINE — projeção de caixa (previsto) a partir do saldo atual
 * e dos títulos em aberto (a receber / a pagar).
 *
 * Regras:
 *  - Saldo inicial = saldo real atual das contas.
 *  - Títulos em aberto (pending | parcial | overdue) entram no mês do vencimento
 *    (due_date, senão date). Vencidos (data < hoje) entram no mês atual.
 *  - Valor considerado = saldo_aberto quando existir, senão amount.
 *  - Cancelados e pagos são ignorados (já estão no saldo).
 */
import Decimal from 'decimal.js';

export interface CashFlowTx {
  type: string;
  amount: number | string;
  status: string;
  date: string;
  due_date?: string | null;
  saldo_aberto?: number | string | null;
}

export interface CashFlowMonth {
  key: string; // YYYY-MM
  label: string;
  entradas: number;
  saidas: number;
  resultado: number;
  saldoInicial: number;
  saldoFinal: number;
}

const OPEN = new Set(['pending', 'parcial', 'overdue']);

export function openAmount(t: CashFlowTx): number {
  if (t.saldo_aberto != null && t.saldo_aberto !== '') {
    const n = Number(t.saldo_aberto);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return Number(t.amount) || 0;
}

export function projectCashFlow(
  txs: CashFlowTx[],
  startingBalance: number,
  months = 6,
  todayISO = new Date().toISOString().slice(0, 10),
): CashFlowMonth[] {
  const base = new Date(`${todayISO.slice(0, 7)}-01T12:00:00`);
  const keys: string[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(base);
    d.setMonth(base.getMonth() + i);
    keys.push(d.toISOString().slice(0, 7));
  }
  const firstKey = keys[0];
  const lastKey = keys[keys.length - 1];
  const inc = new Map<string, Decimal>();
  const exp = new Map<string, Decimal>();
  keys.forEach((k) => { inc.set(k, new Decimal(0)); exp.set(k, new Decimal(0)); });

  for (const t of txs) {
    if (!OPEN.has(t.status)) continue;
    const ref = t.due_date || t.date;
    if (!ref) continue;
    let k = ref.slice(0, 7);
    if (k < firstKey) k = firstKey; // vencidos caem no mês atual
    if (k > lastKey) continue;
    const v = new Decimal(openAmount(t));
    if (t.type === 'income') inc.set(k, inc.get(k)!.plus(v));
    else if (t.type === 'expense') exp.set(k, exp.get(k)!.plus(v));
  }

  let saldo = new Decimal(startingBalance || 0);
  return keys.map((k) => {
    const e = inc.get(k)!;
    const s = exp.get(k)!;
    const ini = saldo;
    saldo = saldo.plus(e).minus(s);
    return {
      key: k,
      label: new Date(`${k}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      entradas: e.toNumber(),
      saidas: s.toNumber(),
      resultado: e.minus(s).toNumber(),
      saldoInicial: ini.toNumber(),
      saldoFinal: saldo.toNumber(),
    };
  });
}
