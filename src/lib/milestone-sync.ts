import { supabase } from '@/integrations/supabase/client';

interface SyncMilestoneInput {
  id: string;
  budget_id: string;
  title: string;
  amount: number;
  due_date: string | null;
  status: string;
  paid_date: string | null;
  linked_transaction_id?: string | null;
  user_id: string;
}

async function getBudgetMeta(budgetId: string) {
  const { data } = await supabase
    .from('budgets')
    .select('code, client_id, project_name')
    .eq('id', budgetId)
    .maybeSingle();
  return data as { code: string; client_id: string | null; project_name: string | null } | null;
}

/**
 * Cria/atualiza um lançamento financeiro previsto (income/pending) vinculado a um marco.
 * Garante que o marco apareça nos lançamentos do financeiro como receita futura.
 */
export async function syncMilestoneToTransaction(ms: SyncMilestoneInput) {
  const budget = await getBudgetMeta(ms.budget_id);
  const code = budget?.code || '';
  const description = `${code} - ${ms.title}`.trim();
  const today = new Date().toISOString().slice(0, 10);
  const dueDate = ms.due_date || today;

  const isPaid = ms.status === 'paid';
  const txPayload: Record<string, any> = {
    type: 'income',
    category: 'installment',
    description,
    amount: ms.amount,
    date: dueDate,
    due_date: ms.due_date,
    status: isPaid ? 'paid' : 'pending',
    paid_date: isPaid ? (ms.paid_date || today) : null,
    budget_id: ms.budget_id,
    client_id: budget?.client_id || null,
  };

  if (ms.linked_transaction_id) {
    const { error } = await supabase
      .from('financial_transactions')
      .update(txPayload as any)
      .eq('id', ms.linked_transaction_id);
    if (!error) return ms.linked_transaction_id;
  }

  const { data, error } = await supabase
    .from('financial_transactions')
    .insert({ ...txPayload, user_id: ms.user_id } as any)
    .select('id')
    .single();
  if (error || !data) return null;

  await supabase
    .from('payment_milestones')
    .update({ linked_transaction_id: data.id } as any)
    .eq('id', ms.id);
  return data.id;
}

export async function deleteLinkedTransaction(linkedId: string | null | undefined) {
  if (!linkedId) return;
  await supabase.from('financial_transactions').delete().eq('id', linkedId);
}
