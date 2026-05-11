import Decimal from 'decimal.js';

/**
 * Regras canônicas de finanças do ERP.
 *
 * Definições — usadas tanto no Dashboard quanto no Financeiro
 * para evitar divergência de números entre páginas.
 *
 * - Faturamento (Entradas)  = receitas com status `paid` (dinheiro que entrou)
 * - Despesas    (Saídas)    = despesas com status `paid` (dinheiro que saiu)
 * - Lucro / Resultado       = Faturamento - Despesas
 * - A Receber               = receitas com status `pending` ou `overdue`
 * - A Pagar                 = despesas com status `pending` ou `overdue`
 * - Vencidos                = qualquer transação com status `overdue` OU
 *                             `pending` cuja `due_date` já passou
 *
 * Todas as somas usam decimal.js para precisão financeira.
 */

export interface FinanceTx {
  type: string;            // 'income' | 'expense'
  amount: number | string;
  status: string;          // 'paid' | 'pending' | 'overdue' | 'cancelled'
  date?: string | null;
  due_date?: string | null;
  paid_date?: string | null;
  bank_account_id?: string | null;
}

export interface FinanceAccount {
  id?: string;
  initial_balance?: number | string | null;
  current_balance?: number | string | null;
}

export interface FinanceTransfer {
  from_account_id?: string | null;
  to_account_id?: string | null;
  amount: number | string;
}

const PENDING_STATUSES = new Set(['pending', 'overdue']);

function sumPaid(txs: FinanceTx[], type: 'income' | 'expense'): number {
  return txs
    .filter((t) => t.type === type && t.status === 'paid')
    .reduce((acc, t) => acc.plus(new Decimal(t.amount || 0)), new Decimal(0))
    .toNumber();
}

function sumPending(txs: FinanceTx[], type: 'income' | 'expense'): number {
  return txs
    .filter((t) => t.type === type && PENDING_STATUSES.has(t.status))
    .reduce((acc, t) => acc.plus(new Decimal(t.amount || 0)), new Decimal(0))
    .toNumber();
}

export interface FinanceSummary {
  income: number;        // Faturamento (recebido)
  expense: number;       // Despesas (pago)
  profit: number;        // Lucro líquido
  margin: number;        // % de margem sobre faturamento
  receivable: number;    // A Receber (pendente + vencido)
  payable: number;       // A Pagar (pendente + vencido)
  overdueCount: number;  // Quantidade de vencidos
  overdueAmount: number; // Valor total vencido
}

export function summarizeFinance(txs: FinanceTx[], todayISO?: string): FinanceSummary {
  const today = todayISO ?? new Date().toISOString().slice(0, 10);

  const income = sumPaid(txs, 'income');
  const expense = sumPaid(txs, 'expense');
  const profit = new Decimal(income).minus(expense).toNumber();
  const margin = income > 0 ? new Decimal(profit).div(income).times(100).toNumber() : 0;
  const receivable = sumPending(txs, 'income');
  const payable = sumPending(txs, 'expense');

  const overdue = txs.filter(
    (t) => t.status === 'overdue' || (t.status === 'pending' && t.due_date && t.due_date < today),
  );
  const overdueAmount = overdue
    .reduce((acc, t) => acc.plus(new Decimal(t.amount || 0)), new Decimal(0))
    .toNumber();

  return {
    income,
    expense,
    profit,
    margin,
    receivable,
    payable,
    overdueCount: overdue.length,
    overdueAmount,
  };
}

export function calculateAvailableBalance(txs: FinanceTx[], accounts: FinanceAccount[] = []): number {
  const initialBalance = accounts.reduce(
    (acc, account) => acc.plus(new Decimal(account.initial_balance || 0)),
    new Decimal(0),
  );

  return txs
    .filter((t) => t.status === 'paid' && (t.type === 'income' || t.type === 'expense'))
    .reduce((acc, t) => {
      const amount = new Decimal(t.amount || 0);
      return t.type === 'income' ? acc.plus(amount) : acc.minus(amount);
    }, initialBalance)
    .toNumber();
}

export function calculateAccountBalances(
  txs: FinanceTx[],
  accounts: FinanceAccount[] = [],
  transfers: FinanceTransfer[] = [],
): Record<string, number> {
  const balances = new Map<string, Decimal>();

  accounts.forEach((account) => {
    if (!account.id) return;
    balances.set(account.id, new Decimal(account.initial_balance || 0));
  });

  txs.forEach((t) => {
    if (t.status !== 'paid' || !t.bank_account_id || !balances.has(t.bank_account_id)) return;
    const current = balances.get(t.bank_account_id)!;
    const amount = new Decimal(t.amount || 0);
    balances.set(t.bank_account_id, t.type === 'income' ? current.plus(amount) : current.minus(amount));
  });

  transfers.forEach((transfer) => {
    const amount = new Decimal(transfer.amount || 0);
    if (transfer.from_account_id && balances.has(transfer.from_account_id)) {
      balances.set(transfer.from_account_id, balances.get(transfer.from_account_id)!.minus(amount));
    }
    if (transfer.to_account_id && balances.has(transfer.to_account_id)) {
      balances.set(transfer.to_account_id, balances.get(transfer.to_account_id)!.plus(amount));
    }
  });

  return Object.fromEntries(Array.from(balances.entries()).map(([id, balance]) => [id, balance.toNumber()]));
}

/**
 * Filtra transações por intervalo de datas (campo `date`, ISO YYYY-MM-DD inclusive).
 */
export function filterByPeriod<T extends { date?: string | null }>(
  txs: T[],
  start: string,
  end: string,
): T[] {
  return txs.filter((t) => !!t.date && t.date >= start && t.date <= end);
}
