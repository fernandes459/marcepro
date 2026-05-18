import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Notification {
  id: string;
  kind: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data ?? []) as Notification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchAll]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function markAllRead() {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);
    fetchAll();
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    fetchAll();
  }

  async function dismiss(id: string) {
    await supabase.from('notifications').delete().eq('id', id);
    fetchAll();
  }

  return { notifications, unreadCount, loading, markAllRead, markRead, dismiss, refresh: fetchAll };
}

/**
 * Generates smart notifications based on current data state.
 * Idempotent per (kind + entity_id) for the day.
 */
export async function generateSmartNotifications(userId: string) {
  // overdue receivables
  const today = new Date().toISOString().slice(0, 10);
  const { data: overdue } = await supabase
    .from('financial_transactions')
    .select('id, description, amount, due_date')
    .eq('user_id', userId)
    .eq('type', 'income')
    .eq('status', 'pending')
    .lt('due_date', today)
    .limit(20);

  const { data: existing } = await supabase
    .from('notifications')
    .select('entity_id, kind, created_at')
    .eq('user_id', userId)
    .gte('created_at', today);

  const existSet = new Set((existing ?? []).map((e) => `${e.kind}:${e.entity_id}`));

  const toInsert: Array<{
    user_id: string; kind: string; severity: string;
    title: string; body: string; link: string; entity_type: string; entity_id: string;
  }> = [];

  (overdue ?? []).forEach((tx) => {
    const key = `overdue:${tx.id}`;
    if (existSet.has(key)) return;
    toInsert.push({
      user_id: userId,
      kind: 'overdue',
      severity: 'critical',
      title: `Recebível em atraso`,
      body: `${tx.description} — R$ ${Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      link: '/financeiro',
      entity_type: 'transaction',
      entity_id: tx.id,
    });
  });

  // pending assembly checklists
  const { data: pending } = await supabase
    .from('production_tasks')
    .select('id, project_name, client_name')
    .eq('user_id', userId)
    .eq('stage', 'montagem')
    .is('assembly_completed_at', null)
    .limit(20);

  (pending ?? []).forEach((t) => {
    const key = `assembly_pending:${t.id}`;
    if (existSet.has(key)) return;
    toInsert.push({
      user_id: userId,
      kind: 'assembly_pending',
      severity: 'warning',
      title: 'Checklist de montagem pendente',
      body: `${t.project_name} • ${t.client_name}`,
      link: '/producao',
      entity_type: 'production_task',
      entity_id: t.id,
    });
  });

  // lead followups overdue
  const nowIso = new Date().toISOString();
  const { data: leads } = await supabase
    .from('leads')
    .select('id, name, next_contact_at, stage')
    .eq('user_id', userId)
    .not('next_contact_at', 'is', null)
    .lt('next_contact_at', nowIso)
    .not('stage', 'in', '("ganho","perdido")')
    .limit(20);

  (leads ?? []).forEach((l) => {
    const key = `lead_followup:${l.id}`;
    if (existSet.has(key)) return;
    toInsert.push({
      user_id: userId,
      kind: 'lead_followup',
      severity: 'warning',
      title: 'Follow-up de lead atrasado',
      body: `Retomar contato com ${l.name}`,
      link: '/crm',
      entity_type: 'lead',
      entity_id: l.id,
    });
  });

  if (toInsert.length > 0) {
    await supabase.from('notifications').insert(toInsert);
  }
  return toInsert.length;
}
