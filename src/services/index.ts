import { createCrudService } from './base';

/**
 * Services do ERP MarcePro — fachada única para o domínio.
 *
 * Cada module page pode migrar gradualmente para usar estes services
 * em vez de chamar `supabase.from(...)` diretamente, ganhando auditoria
 * e tratamento de erro padronizado sem alterar a UX.
 */

export interface BudgetRow {
  id: string;
  code: string;
  project_name: string | null;
  client_id: string | null;
  status: string;
  final_price: number;
  total_cost: number;
}

export interface ClientRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

export interface TransactionRow {
  id: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  status: string;
  date: string;
}

export const BudgetsService = createCrudService<BudgetRow>({
  table: 'budgets',
  module: 'budgets',
  entityType: 'budget',
  describe: (b) => `${b.code} — ${b.project_name ?? 'sem nome'}`,
});

export const ClientsService = createCrudService<ClientRow>({
  table: 'clients',
  module: 'clients',
  entityType: 'client',
  describe: (c) => c.name,
});

export const TransactionsService = createCrudService<TransactionRow>({
  table: 'financial_transactions',
  module: 'finance',
  entityType: 'transaction',
  describe: (t) => `${t.type === 'income' ? '+' : '-'} ${t.description}`,
});

export { logAudit, listAuditLogs } from '@/lib/audit';
export { ServiceError } from './base';
