/**
 * METRICS ENGINE — funil comercial e indicadores de performance.
 * Consome a mesma definição de status do FinancialEngine.
 */

import { isClosed, isOpen, isRefused, isDraft, toCanonicalStatus, ProjectStatus } from '@/core/status';
import {
  BudgetLike,
  PeriodRange,
  getRevenueReferenceDate,
  withinPeriod,
} from './FinancialEngine';

const num = (v: unknown) => (v == null || v === '' ? 0 : Number(v) || 0);

export interface FunnelMetrics {
  total: number;
  rascunho: number;
  emAberto: number;
  fechados: number;
  recusados: number;
  emProducao: number;
  finalizado: number;

  valorEmAberto: number;
  valorFechado: number;
  valorRecusado: number;

  conversao: number;     // fechados / (fechados+recusados)
  ticketMedio: number;   // valorFechado / fechados
  tempoMedioFechamentoDias: number; // approved_at - created_at média
}

export function computeFunnel(
  budgets: BudgetLike[],
  period: PeriodRange,
  opts?: { effectiveStatusOf?: (b: BudgetLike) => string },
): FunnelMetrics {
  const eff = opts?.effectiveStatusOf ?? ((b) => b.status);

  const inPeriod = budgets.filter((b) =>
    withinPeriod(getRevenueReferenceDate(b), period),
  );

  let rascunho = 0;
  let emAberto = 0;
  let fechados = 0;
  let recusados = 0;
  let emProducao = 0;
  let finalizado = 0;

  let valorEmAberto = 0;
  let valorFechado = 0;
  let valorRecusado = 0;

  let tempoSomaMs = 0;
  let tempoQtd = 0;

  for (const b of inPeriod) {
    const canon = toCanonicalStatus(eff(b)) as ProjectStatus;
    const price = num(b.final_price);

    if (isDraft(canon)) rascunho++;
    else if (isOpen(canon)) { emAberto++; valorEmAberto += price; }
    else if (isClosed(canon)) {
      fechados++;
      valorFechado += price;
      if (canon === 'producao' || canon === 'instalacao') emProducao++;
      if (canon === 'finalizado') finalizado++;
      if (b.approved_at) {
        tempoSomaMs += new Date(b.approved_at).getTime() - new Date(b.created_at).getTime();
        tempoQtd++;
      }
    } else if (isRefused(canon)) { recusados++; valorRecusado += price; }
  }

  const decididos = fechados + recusados;
  return {
    total: inPeriod.length,
    rascunho,
    emAberto,
    fechados,
    recusados,
    emProducao,
    finalizado,
    valorEmAberto,
    valorFechado,
    valorRecusado,
    conversao: decididos > 0 ? (fechados / decididos) * 100 : 0,
    ticketMedio: fechados > 0 ? valorFechado / fechados : 0,
    tempoMedioFechamentoDias:
      tempoQtd > 0 ? tempoSomaMs / tempoQtd / 86_400_000 : 0,
  };
}
