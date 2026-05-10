import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatBRL } from '@/lib/format';

export type InsightSeverity = 'info' | 'warning' | 'danger' | 'success';

export interface FinancialInsight {
  id: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  action?: string;
}

interface Tx {
  id: string;
  type: string;
  category: string;
  amount: number;
  date: string;
  due_date: string | null;
  status: string;
  is_fixed: boolean;
  client_id: string | null;
}

interface BankAcc { current_balance: number }

interface Params {
  transactions: Tx[];
  bankAccounts: BankAcc[];
  pendingWorkLogsTotal?: number;
  today: string; // YYYY-MM-DD
}

function monthAgo(date: string, months: number) {
  const d = new Date(date + 'T12:00:00');
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function daysFromNow(date: string, days: number) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function useCompanyMinMargin() {
  const [minMargin, setMinMargin] = useState<number>(20);
  useEffect(() => {
    supabase.from('company_settings').select('min_margin').maybeSingle().then(({ data }) => {
      if (data?.min_margin != null) setMinMargin(Number(data.min_margin));
    });
  }, []);
  return minMargin;
}

export function computeFinancialMetrics({ transactions, bankAccounts, pendingWorkLogsTotal = 0, today }: Params) {
  const realBalance = bankAccounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);

  const next30 = daysFromNow(today, 30);

  const projectedReceivables = transactions
    .filter(t => t.type === 'income' && (t.status === 'pending' || t.status === 'overdue'))
    .filter(t => t.due_date && t.due_date <= next30)
    .reduce((s, t) => s + Number(t.amount || 0), 0);

  // Despesas previstas: lançamentos pendentes/vencidos + horas de colaborador ainda não viraram despesa
  const projectedPayablesTx = transactions
    .filter(t => t.type === 'expense' && (t.status === 'pending' || t.status === 'overdue'))
    .filter(t => t.due_date && t.due_date <= next30)
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const projectedPayables = projectedPayablesTx + Number(pendingWorkLogsTotal || 0);

  const projectedBalance = realBalance + projectedReceivables - projectedPayables;

  // Burn rate: avg paid expenses last 3 months + custo médio mensal das horas pendentes
  const start3 = monthAgo(today, 3);
  const last3Expenses = transactions
    .filter(t => t.type === 'expense' && t.status === 'paid' && t.date >= start3 && t.date <= today)
    .reduce((s, t) => s + Number(t.amount || 0), 0);
  const burnRate = last3Expenses / 3 + Number(pendingWorkLogsTotal || 0) / 3;
  const runwayMonths = burnRate > 0 ? realBalance / burnRate : Infinity;

  return { realBalance, projectedReceivables, projectedPayables, projectedBalance, burnRate, runwayMonths };
}

export function useFinancialInsights({ transactions, bankAccounts, pendingWorkLogsTotal = 0, today }: Params): FinancialInsight[] {
  const minMargin = useCompanyMinMargin();

  return useMemo(() => {
    const insights: FinancialInsight[] = [];
    const metrics = computeFinancialMetrics({ transactions, bankAccounts, today });

    // Current month
    const monthStart = today.slice(0, 7) + '-01';
    const monthTx = transactions.filter(t => t.date >= monthStart && t.date <= today);
    const revenue = monthTx.filter(t => t.type === 'income' && t.status === 'paid').reduce((s, t) => s + Number(t.amount), 0);
    const expensesPaid = monthTx.filter(t => t.type === 'expense' && t.status === 'paid').reduce((s, t) => s + Number(t.amount), 0);
    const fixed = monthTx.filter(t => t.type === 'expense' && t.is_fixed).reduce((s, t) => s + Number(t.amount), 0);
    const profit = revenue - expensesPaid;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    // 1. Negative projected balance
    if (metrics.projectedBalance < 0) {
      insights.push({
        id: 'projected-negative',
        severity: 'danger',
        title: 'Caixa pode ficar negativo em 30 dias',
        message: `Saldo projetado: ${formatBRL(metrics.projectedBalance)}. Antecipe recebimentos ou renegocie despesas.`,
        action: 'Revisar contas a pagar',
      });
    }

    // 2. Low runway
    if (Number.isFinite(metrics.runwayMonths) && metrics.runwayMonths < 2 && metrics.burnRate > 0) {
      insights.push({
        id: 'runway-low',
        severity: 'danger',
        title: `Fôlego de caixa: ${metrics.runwayMonths.toFixed(1)} meses`,
        message: `Com a média de gastos atual (${formatBRL(metrics.burnRate)}/mês), seu caixa dura pouco. Foque em entrar mais obras.`,
      });
    }

    // 3. Fixed expenses too high
    if (revenue > 0 && fixed / revenue > 0.6) {
      insights.push({
        id: 'fixed-high',
        severity: 'warning',
        title: 'Custos fixos altos demais',
        message: `Despesas fixas representam ${((fixed / revenue) * 100).toFixed(0)}% das receitas. Ideal: abaixo de 50%.`,
      });
    }

    // 4. Margin below company minimum
    if (revenue > 0 && margin < minMargin) {
      insights.push({
        id: 'margin-low',
        severity: 'warning',
        title: `Margem do mês: ${margin.toFixed(1)}% (mínimo ${minMargin}%)`,
        message: 'Reveja preços dos próximos orçamentos ou corte despesas variáveis.',
      });
    } else if (revenue > 0 && margin >= minMargin && margin > 0) {
      insights.push({
        id: 'margin-ok',
        severity: 'success',
        title: `Margem saudável: ${margin.toFixed(1)}%`,
        message: 'Acima da meta mínima. Continue assim.',
      });
    }

    // 5. Overdue accounts
    const overdue = transactions.filter(t => (t.status === 'overdue' || (t.status === 'pending' && t.due_date && t.due_date < today)));
    if (overdue.length > 0) {
      const total = overdue.reduce((s, t) => s + Number(t.amount), 0);
      insights.push({
        id: 'overdue',
        severity: 'danger',
        title: `${overdue.length} conta(s) vencida(s)`,
        message: `Total em atraso: ${formatBRL(total)}.`,
        action: 'Ver pendências',
      });
    }

    // 6. Category increase month-over-month
    const prevMonthStart = monthAgo(monthStart, 1);
    const prevMonthEnd = monthAgo(today, 1);
    const byCatThis: Record<string, number> = {};
    const byCatPrev: Record<string, number> = {};
    monthTx.filter(t => t.type === 'expense').forEach(t => { byCatThis[t.category] = (byCatThis[t.category] || 0) + Number(t.amount); });
    transactions.filter(t => t.type === 'expense' && t.date >= prevMonthStart && t.date <= prevMonthEnd)
      .forEach(t => { byCatPrev[t.category] = (byCatPrev[t.category] || 0) + Number(t.amount); });
    Object.entries(byCatThis).forEach(([cat, val]) => {
      const prev = byCatPrev[cat] || 0;
      if (prev > 100 && val > prev * 1.3) {
        const pct = ((val - prev) / prev) * 100;
        insights.push({
          id: `cat-up-${cat}`,
          severity: 'warning',
          title: `Gasto com "${cat}" subiu ${pct.toFixed(0)}%`,
          message: `Mês passado: ${formatBRL(prev)} • Este mês: ${formatBRL(val)}.`,
        });
      }
    });

    // 7. Pending unlogged work hours
    if (pendingWorkLogsTotal > 0) {
      insights.push({
        id: 'work-pending',
        severity: 'info',
        title: 'Horas de colaboradores não lançadas',
        message: `${formatBRL(pendingWorkLogsTotal)} em horas trabalhadas ainda não viraram despesa.`,
        action: 'Ir para Colaboradores',
      });
    }

    // 8. Receivables overdue > 30 days
    const oldReceivables = transactions.filter(t =>
      t.type === 'income' &&
      (t.status === 'pending' || t.status === 'overdue') &&
      t.due_date && t.due_date < monthAgo(today, 1)
    );
    if (oldReceivables.length > 0) {
      const total = oldReceivables.reduce((s, t) => s + Number(t.amount), 0);
      insights.push({
        id: 'receivables-old',
        severity: 'warning',
        title: `${oldReceivables.length} recebimento(s) atrasado(s) há +30 dias`,
        message: `${formatBRL(total)} parado em recebíveis. Cobre clientes ou renegocie.`,
      });
    }

    // 9. Healthy cash
    if (insights.filter(i => i.severity === 'danger').length === 0 && metrics.realBalance > metrics.burnRate * 3) {
      insights.push({
        id: 'cash-ok',
        severity: 'success',
        title: 'Caixa saudável',
        message: `Você tem ${(metrics.runwayMonths || 0).toFixed(1)} meses de fôlego financeiro.`,
      });
    }

    return insights;
  }, [transactions, bankAccounts, pendingWorkLogsTotal, today, minMargin]);
}
