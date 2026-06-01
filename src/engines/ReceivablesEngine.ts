/**
 * RECEIVABLES ENGINE — pagamento parcial sem duplicar lançamentos.
 *
 * REGRAS:
 *  1. Nunca cria novo lançamento. Apenas atualiza o título original via RPC.
 *  2. Atualiza valor_recebido, saldo_aberto e status (aberto → parcial → pago).
 *  3. Histórico de cada pagamento fica em `payment_history`.
 */
import { supabase } from '@/integrations/supabase/client';

export interface RegistrarPagamentoInput {
  transactionId: string;
  valor: number;
  data?: string; // YYYY-MM-DD
  formaPagamento?: string | null;
  bankAccountId?: string | null;
  notes?: string | null;
}

export interface PagamentoResult {
  history_id: string;
  status: 'paid' | 'parcial' | 'pending' | string;
  valor_recebido: number;
  saldo_aberto: number;
}

export async function registrarPagamento(input: RegistrarPagamentoInput): Promise<PagamentoResult> {
  const { data, error } = await supabase.rpc('registrar_pagamento_parcial', {
    _transaction_id: input.transactionId,
    _valor: input.valor,
    _data: input.data ?? new Date().toISOString().slice(0, 10),
    _forma_pagamento: input.formaPagamento ?? null,
    _bank_account_id: input.bankAccountId ?? null,
    _notes: input.notes ?? null,
  });
  if (error) throw error;
  return data as unknown as PagamentoResult;
}

export interface PaymentHistoryRow {
  id: string;
  transaction_id: string;
  valor: number;
  data: string;
  forma_pagamento: string | null;
  bank_account_id: string | null;
  notes: string | null;
  created_at: string;
}

export async function fetchPaymentHistory(transactionId: string): Promise<PaymentHistoryRow[]> {
  const { data, error } = await supabase
    .from('payment_history')
    .select('*')
    .eq('transaction_id', transactionId)
    .order('data', { ascending: false });
  if (error) throw error;
  return (data as any) || [];
}

/**
 * Saldo em aberto considerando pagamentos parciais.
 * Fallback para `amount` quando colunas novas ainda não foram propagadas.
 */
export function getSaldoAberto(tx: {
  amount: number | string;
  saldo_aberto?: number | string | null;
  status?: string;
}): number {
  if (tx.status === 'paid') return 0;
  const saldo = tx.saldo_aberto != null ? Number(tx.saldo_aberto) : null;
  if (saldo !== null && Number.isFinite(saldo)) return Math.max(0, saldo);
  return Number(tx.amount) || 0;
}
