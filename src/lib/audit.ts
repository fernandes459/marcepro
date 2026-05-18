import { supabase } from '@/integrations/supabase/client';

/**
 * Módulos auditáveis do ERP.
 */
export type AuditModule =
  | 'budgets'
  | 'finance'
  | 'clients'
  | 'production'
  | 'assistance'
  | 'employees'
  | 'company'
  | 'auth'
  | 'settings'
  | 'ai';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'cancel'
  | 'reverse'
  | 'login'
  | 'logout'
  | 'export'
  | 'import'
  | 'ai_run';

export interface AuditPayload {
  module: AuditModule;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  summary?: string;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  metadata?: Record<string, any>;
}

/**
 * Registra evento de auditoria. Falhas são silenciosas
 * (auditoria nunca pode quebrar a UX).
 */
export async function logAudit(payload: AuditPayload): Promise<void> {
  try {
    await supabase.rpc('log_audit' as any, {
      _module: payload.module,
      _action: payload.action,
      _entity_type: payload.entityType ?? null,
      _entity_id: payload.entityId ?? null,
      _summary: payload.summary ?? null,
      _old_data: payload.oldData ?? null,
      _new_data: payload.newData ?? null,
      _metadata: payload.metadata ?? {},
    });
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[audit] falhou:', err);
  }
}

export interface AuditLogRow {
  id: string;
  user_id: string;
  company_id: string | null;
  module: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string | null;
  old_data: any;
  new_data: any;
  metadata: any;
  created_at: string;
}

export async function listAuditLogs(opts: {
  module?: AuditModule;
  entityId?: string;
  limit?: number;
} = {}): Promise<AuditLogRow[]> {
  let q = supabase
    .from('audit_logs' as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.module) q = q.eq('module', opts.module);
  if (opts.entityId) q = q.eq('entity_id', opts.entityId);

  const { data, error } = await q;
  if (error) {
    console.error('[audit] list error:', error);
    return [];
  }
  return (data ?? []) as unknown as AuditLogRow[];
}
