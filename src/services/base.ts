import { supabase } from '@/integrations/supabase/client';
import { logAudit, type AuditModule, type AuditAction } from '@/lib/audit';

/**
 * Camada base de Services do ERP.
 *
 * Padrão único para CRUD + auditoria automática.
 * Todos os módulos (BudgetsService, FinanceService, ...) devem estender
 * `createCrudService` para garantir:
 *   - tipagem consistente
 *   - escopo automático por usuário/empresa (via RLS já existente)
 *   - registro de auditoria em create/update/delete
 *   - tratamento padronizado de erros
 */

export class ServiceError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'ServiceError';
  }
}

export interface CrudOptions<T> {
  table: string;
  module: AuditModule;
  entityType: string;
  /** Callback opcional para gerar o `summary` legível do registro. */
  describe?: (row: T) => string;
}

export interface CrudService<T extends { id: string }> {
  list(filters?: Record<string, any>): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(input: Partial<T>): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  remove(id: string): Promise<void>;
}

export function createCrudService<T extends { id: string }>(
  opts: CrudOptions<T>,
): CrudService<T> {
  const { table, module, entityType, describe } = opts;

  return {
    async list(filters = {}) {
      let q = supabase.from(table as any).select('*');
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== null) q = q.eq(k, v);
      });
      const { data, error } = await q;
      if (error) throw new ServiceError(`Falha ao listar ${table}`, error);
      return (data ?? []) as unknown as T[];
    },

    async get(id) {
      const { data, error } = await supabase
        .from(table as any)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new ServiceError(`Falha ao buscar ${table}`, error);
      return (data as unknown as T) ?? null;
    },

    async create(input) {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new ServiceError('Usuário não autenticado');

      const payload: any = { ...input };
      if (!payload.user_id) payload.user_id = userId;

      const { data, error } = await supabase
        .from(table as any)
        .insert(payload)
        .select()
        .single();
      if (error) throw new ServiceError(`Falha ao criar ${entityType}`, error);

      const row = data as unknown as T;
      void logAudit({
        module,
        action: 'create' satisfies AuditAction,
        entityType,
        entityId: row.id,
        summary: describe?.(row),
        newData: row as any,
      });
      return row;
    },

    async update(id, patch) {
      const prev = await this.get(id);

      const { data, error } = await supabase
        .from(table as any)
        .update(patch as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw new ServiceError(`Falha ao atualizar ${entityType}`, error);

      const row = data as unknown as T;
      void logAudit({
        module,
        action: 'update',
        entityType,
        entityId: id,
        summary: describe?.(row),
        oldData: prev as any,
        newData: row as any,
      });
      return row;
    },

    async remove(id) {
      const prev = await this.get(id);

      const { error } = await supabase.from(table as any).delete().eq('id', id);
      if (error) throw new ServiceError(`Falha ao remover ${entityType}`, error);

      void logAudit({
        module,
        action: 'delete',
        entityType,
        entityId: id,
        summary: prev && describe ? describe(prev) : undefined,
        oldData: prev as any,
      });
    },
  };
}
