/**
 * FINANCIAL ENGINE — única fonte de verdade para números financeiros.
 *
 * REGRAS INVIOLÁVEIS:
 *  1. UI não calcula. Só consome.
 *  2. Faturamento usa `approved_at` (mês da aprovação), não `created_at`.
 *  3. Orçamento é FECHADO se status canônico ∈ {aprovado, producao, instalacao, finalizado}.
 *  4. Recebido = transações income com status "paid" (paid_date).
 *  5. A receber = income pending/parcial (saldo_aberto quando existir, senão amount).
 *  6. A pagar = expense pending/parcial.
 */

import { isClosed, isOpen, isRefused, isDraft, toCanonicalStatus } from '@/core/status';

export interface BudgetLike {
  id: string;
  status: string;
  final_price: number | string | null;
  total_cost?: number | string | null;
  created_at: string;
  updated_at?: string | null;
  approved_at?: string | null;
}

export interface TransactionLike {
  id: string;
  type: 'income' | 'expense' | string;
  amount: number | string;
  status: string; // pending | paid | parcial | overdue
  date: string;
  paid_date?: string | null;
  due_date?: string | null;
  valor_original?: number | string | null;
  valor_recebido?: number | string | null;
  saldo_aberto?: number | string | null;
}

export interface PeriodRange {
  start: Date | null;
  end?: Date | null;
}

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function getRevenueReferenceDate(b: BudgetLike): Date {
  // Para orçamentos fechados o "faturamento" é a data da aprovação.
  // Fallback robusto: updated_at, depois created_at.
  if (isClosed(b.status)) {
    const ref = b.approved_at || b.updated_at || b.created_at;
    return new Date(ref);
  }
  return new Date(b.created_at);
}

export function withinPeriod(date: Date, period: PeriodRange): boolean {
  if (!period.start) return true;
  if (date < period.start) return false;
  if (period.end && date > period.end) return false;
  return true;
}

export function periodFromKey(key: 'month' | '3m' | '6m' | 'year' | 'all'): PeriodRange {
  if (key === 'all') return { start: null };
  const d = new Date();
  if (key === 'month') d.setDate(1);
  else if (key === '3m') d.setMonth(d.getMonth() - 3);
  else if (key === '6m') d.setMonth(d.getMonth() - 6);
  else if (key === 'year') { d.setMonth(0); d.setDate(1); }
  d.setHours(0, 0, 0, 0);
  return { start: d };
}

export interface FinancialSnapshot {
  // Orçamento agregados
  faturamentoFechado: number;       // soma de fechados no período (preço final)
  faturamentoAprovado: number;      // apenas aprovados
  faturamentoEmProducao: number;    // producao + instalacao
  faturamentoFinalizado: number;
  faturamentoEmAberto: number;      // enviados + negociação
  faturamentoPerdido: number;       // recusados

  // Recebíveis
  recebido: number;                 // entradas pagas
  aReceber: number;                 // saldo em aberto
  aPagar: number;                   // despesas pendentes
  saldoLiquido: number;             // recebido - despesas pagas

  // Lucro
  custoFechado: number;
  lucroBrutoFechado: number;
  margemMedia: number;              // %
}

function txOpenAmount(t: TransactionLike): number {
  // Pagamento parcial: usa saldo_aberto quando existir.
  const saldo = t.saldo_aberto != null ? num(t.saldo_aberto) : null;
  if (saldo !== null) return Math.max(0, saldo);
  return num(t.amount);
}

export function computeSnapshot(
  budgets: BudgetLike[],
  transactions: TransactionLike[],
  period: PeriodRange,
  opts?: { effectiveStatusOf?: (b: BudgetLike) => string },
): FinancialSnapshot {
  const eff = opts?.effectiveStatusOf ?? ((b) => b.status);

  // Filtra orçamentos por período usando data de referência (aprovação p/ fechados).
  const inPeriod = budgets.filter((b) =>
    withinPeriod(getRevenueReferenceDate(b), period),
  );

  let faturamentoAprovado = 0;
  let faturamentoEmProducao = 0;
  let faturamentoFinalizado = 0;
  let faturamentoEmAberto = 0;
  let faturamentoPerdido = 0;
  let custoFechado = 0;

  for (const b of inPeriod) {
    const canon = toCanonicalStatus(eff(b));
    const price = num(b.final_price);
    const cost = num(b.total_cost);
    if (canon === 'aprovado') faturamentoAprovado += price;
    else if (canon === 'producao' || canon === 'instalacao') faturamentoEmProducao += price;
    else if (canon === 'finalizado') faturamentoFinalizado += price;
    else if (isOpen(canon)) faturamentoEmAberto += price;
    else if (isRefused(canon)) faturamentoPerdido += price;
    if (isClosed(canon)) custoFechado += cost;
  }

  const faturamentoFechado =
    faturamentoAprovado + faturamentoEmProducao + faturamentoFinalizado;

  // Transações: caixa real.
  let recebido = 0;
  let aReceber = 0;
  let aPagar = 0;
  let despesasPagas = 0;

  for (const t of transactions) {
    const ref = new Date(
      t.status === 'paid' && t.paid_date ? t.paid_date : t.date,
    );
    if (!withinPeriod(ref, period)) continue;

    if (t.type === 'income') {
      if (t.status === 'paid') recebido += num(t.amount);
      else if (t.status === 'parcial') {
        recebido += num(t.valor_recebido);
        aReceber += txOpenAmount(t);
      } else aReceber += txOpenAmount(t);
    } else if (t.type === 'expense') {
      if (t.status === 'paid') despesasPagas += num(t.amount);
      else aPagar += txOpenAmount(t);
    }
  }

  const lucroBrutoFechado = faturamentoFechado - custoFechado;
  const margemMedia =
    faturamentoFechado > 0 ? (lucroBrutoFechado / faturamentoFechado) * 100 : 0;

  return {
    faturamentoFechado,
    faturamentoAprovado,
    faturamentoEmProducao,
    faturamentoFinalizado,
    faturamentoEmAberto,
    faturamentoPerdido,
    recebido,
    aReceber,
    aPagar,
    saldoLiquido: recebido - despesasPagas,
    custoFechado,
    lucroBrutoFechado,
    margemMedia,
  };
}

// Helpers de classificação (re-export utilitário)
export { isClosed, isOpen, isRefused, isDraft, toCanonicalStatus };
