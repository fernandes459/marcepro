import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Clock, MapPin, Megaphone, Loader2, AlertTriangle, Target, Phone, Calendar, TrendingUp, ChevronRight, CheckCircle2, ListChecks, User, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatBRL } from '@/lib/format';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export const BUDGET_SOURCES = [
  { value: 'indicacao', label: 'Indicação' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google / Site' },
  { value: 'anuncio', label: 'Anúncio pago' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'arquiteto', label: 'Arquiteto / Parceiro' },
  { value: 'showroom', label: 'Showroom / Loja' },
  { value: 'cliente_antigo', label: 'Cliente antigo (recompra)' },
  { value: 'outro', label: 'Outro' },
];

export function sourceLabel(s?: string | null) {
  if (!s) return 'Não informada';
  return BUDGET_SOURCES.find(x => x.value === s)?.label ?? s;
}

interface BudgetRow {
  id: string; code: string; project_name: string | null; status: string;
  final_price: number; total_cost: number; source: string | null;
  created_at: string; updated_at: string; approved_at: string | null;
  seller_id: string | null;
  clients?: { id: string; name: string; phone: string | null; city: string | null; state: string | null } | null;
}

interface Props {
  budgets: BudgetRow[];
  employees: Array<{ id: string; name: string }>;
  activeProductionIds: Set<string>;
  onOpenBudget: (id: string) => void;
}

export default function OpenPipelinePanel({ budgets, employees, activeProductionIds, onOpenBudget }: Props) {
  const sellerName = (id: string | null) => employees.find(e => e.id === id)?.name || null;

  // Em aberto = draft + pending (e não está em produção)
  const open = useMemo(() => budgets.filter(b => {
    const eff = activeProductionIds.has(b.id) && (b.status === 'approved' || b.status === 'in_production') ? 'in_production' : b.status;
    return eff === 'draft' || eff === 'pending';
  }), [budgets, activeProductionIds]);

  const closed = useMemo(() => budgets.filter(b => b.status === 'approved' || b.status === 'in_production'), [budgets]);
  const refused = useMemo(() => budgets.filter(b => b.status === 'rejected'), [budgets]);

  const now = Date.now();
  const ageDays = (iso: string) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86400000));

  const totals = useMemo(() => {
    const openValue = open.reduce((s, b) => s + Number(b.final_price || 0), 0);
    const avgTicket = open.length ? openValue / open.length : 0;
    const avgAge = open.length ? open.reduce((s, b) => s + ageDays(b.created_at), 0) / open.length : 0;
    const closedValue = closed.reduce((s, b) => s + Number(b.final_price || 0), 0);
    const denom = closed.length + refused.length;
    const conv = denom ? (closed.length / denom) * 100 : 0;
    return {
      open_count: open.length, open_value: openValue, avg_ticket: avgTicket, avg_age_days: avgAge,
      closed_count: closed.length, closed_value: closedValue, conversion_overall: conv,
    };
  }, [open, closed, refused, now]);

  // Cruzamento por origem (canal)
  const bySource = useMemo(() => {
    const map = new Map<string, { count: number; total: number; closed: number; refused: number }>();
    const bump = (s: string | null, b: BudgetRow, bucket: 'open' | 'closed' | 'refused') => {
      const key = s ?? 'sem_origem';
      const row = map.get(key) || { count: 0, total: 0, closed: 0, refused: 0 };
      if (bucket === 'open') { row.count += 1; row.total += Number(b.final_price || 0); }
      else if (bucket === 'closed') row.closed += 1;
      else row.refused += 1;
      map.set(key, row);
    };
    open.forEach(b => bump(b.source, b, 'open'));
    closed.forEach(b => bump(b.source, b, 'closed'));
    refused.forEach(b => bump(b.source, b, 'refused'));
    return Array.from(map.entries()).map(([source, v]) => {
      const denom = v.closed + v.refused;
      return {
        source: sourceLabel(source === 'sem_origem' ? null : source),
        source_raw: source,
        count: v.count, total: v.total,
        conversion: denom ? (v.closed / denom) * 100 : 0,
      };
    }).sort((a, b) => b.total - a.total);
  }, [open, closed, refused]);

  // Cruzamento por região (cidade)
  const byRegion = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    closed.concat(open).forEach(b => {
      const c = b.clients;
      const region = c?.city ? `${c.city}/${c.state || '—'}` : 'Sem região';
      const row = map.get(region) || { count: 0, total: 0 };
      row.count += 1;
      row.total += Number(b.final_price || 0);
      map.set(region, row);
    });
    return Array.from(map.entries())
      .map(([region, v]) => ({ region, count: v.count, total: v.total, avg_ticket: v.count ? v.total / v.count : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [closed, open]);

  const refusedReasons = useMemo(() => {
    const map = new Map<string, number>();
    refused.forEach(b => {
      const m = (b as any).lost_reason ?? null;
      const note = (b as any).notes as string | null;
      const reason = m || (note?.match(/\[Motivo recusa\]:\s*([^\n]+)/)?.[1].trim()) || 'sem feedback';
      map.set(reason, (map.get(reason) || 0) + 1);
    });
    return Array.from(map.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [refused]);

  // Ordenação de cards abertos (mais antigos primeiro)
  const openSorted = useMemo(() => open.slice().sort((a, b) => ageDays(b.created_at) - ageDays(a.created_at)), [open, now]);

  // ===== IA =====
  const [aiLoading, setAiLoading] = useState(false);
  const [ai, setAi] = useState<any | null>(null);

  // ===== Follow-ups (tarefas automáticas) =====
  type FollowUp = {
    id: string; title: string; description: string | null; assignee: string | null;
    priority: 'low' | 'normal' | 'high' | 'urgent'; due_date: string | null;
    status: 'pending' | 'done' | 'cancelled'; origin: 'manual' | 'ai';
    budget_id: string | null; client_id: string | null; ai_batch_id: string | null;
    created_at: string;
  };
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [creatingTasks, setCreatingTasks] = useState(false);

  const loadFollowUps = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('crm_follow_ups')
      .select('*')
      .in('status', ['pending'])
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(50);
    if (!error && data) setFollowUps(data as FollowUp[]);
  }, []);

  useEffect(() => { loadFollowUps(); }, [loadFollowUps]);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('crm-followups-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_follow_ups' }, () => loadFollowUps())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadFollowUps]);

  function mapPriority(p?: string): 'low' | 'normal' | 'high' | 'urgent' {
    const v = (p || '').toLowerCase();
    if (v === 'alta' || v === 'high' || v === 'urgente' || v === 'urgent') return 'high';
    if (v === 'baixa' || v === 'low') return 'low';
    return 'normal';
  }
  function dueFromPriority(p: 'low' | 'normal' | 'high' | 'urgent'): string {
    const days = p === 'high' ? 1 : p === 'normal' ? 3 : 7;
    const d = new Date(); d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  async function createFollowUpsFromAi(aiData: any) {
    const acoes: any[] = Array.isArray(aiData?.acoes_urgentes) ? aiData.acoes_urgentes : [];
    if (acoes.length === 0) return;
    setCreatingTasks(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Não autenticado');

      // crypto.randomUUID — agrupador deste diagnóstico
      const batchId = (crypto as any).randomUUID ? crypto.randomUUID() : `${Date.now()}`;

      // Match cliente → budget aberto (por nome do cliente)
      const norm = (s?: string | null) => (s || '').toLowerCase().trim();
      const matchBudget = (clientName?: string | null) => {
        if (!clientName) return null;
        const n = norm(clientName);
        return open.find(b => norm(b.clients?.name).includes(n) || n.includes(norm(b.clients?.name))) || null;
      };

      const rows = acoes.map(a => {
        const priority = mapPriority(a.prioridade);
        const matched = matchBudget(a.cliente);
        const assignee = matched ? (sellerName(matched.seller_id) || 'Comercial') : 'Comercial';
        return {
          user_id: userId,
          budget_id: matched?.id ?? null,
          client_id: matched?.clients?.id ?? null,
          title: String(a.titulo || 'Follow-up').slice(0, 200),
          description: a.acao ? String(a.acao).slice(0, 1000) : null,
          assignee,
          priority,
          due_date: dueFromPriority(priority),
          status: 'pending',
          origin: 'ai',
          ai_batch_id: batchId,
        };
      });

      const { error } = await (supabase as any).from('crm_follow_ups').insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} tarefa(s) criada(s) automaticamente`);
      loadFollowUps();
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao criar tarefas');
    } finally { setCreatingTasks(false); }
  }

  async function concluirFollowUp(id: string) {
    const { error } = await (supabase as any)
      .from('crm_follow_ups')
      .update({ status: 'done', done_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Tarefa concluída');
    setFollowUps(prev => prev.filter(f => f.id !== id));
  }
  async function removerFollowUp(id: string) {
    const { error } = await (supabase as any).from('crm_follow_ups').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setFollowUps(prev => prev.filter(f => f.id !== id));
  }

  async function runAI() {
    setAiLoading(true); setAi(null);
    try {
      const payload = {
        period_label: 'mês atual',
        open_budgets: open.map(b => ({
          code: b.code,
          project_name: b.project_name,
          client_name: b.clients?.name ?? null,
          client_city: b.clients?.city ?? null,
          client_state: b.clients?.state ?? null,
          final_price: Number(b.final_price || 0),
          status: b.status,
          source: sourceLabel(b.source),
          days_open: ageDays(b.created_at),
          seller: sellerName(b.seller_id),
        })),
        by_source: bySource.map(s => ({ source: s.source, count: s.count, total: s.total, conversion: s.conversion })),
        by_region: byRegion,
        totals,
        refused_reasons: refusedReasons,
      };
      const { data, error } = await supabase.functions.invoke('ai-budget-pipeline-advisor', { body: payload });
      if (error) throw error;
      if ((data as any)?.error) { toast.error((data as any).error); return; }
      setAi(data);
      // Auto-cria follow-ups com responsável, prazo e prioridade
      await createFollowUpsFromAi(data);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao gerar diagnóstico');
    } finally { setAiLoading(false); }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Hero: Pipeline em Aberto */}
      <div className="card-premium rounded-2xl p-4 sm:p-5 space-y-4 border-warning/20">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="font-display text-base font-semibold">Pipeline em Aberto</h3>
              <p className="text-[11px] text-muted-foreground">
                {totals.open_count} orçamento(s) aguardando resposta · idade média {totals.avg_age_days.toFixed(1)}d
              </p>
            </div>
          </div>
          <Button onClick={runAI} disabled={aiLoading || creatingTasks || open.length === 0} size="sm" className="gradient-primary border-0 shadow-primary h-9 gap-1.5">
            {aiLoading || creatingTasks ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {creatingTasks ? 'Criando tarefas…' : 'Diagnóstico IA'}
          </Button>
        </div>

        {/* KPIs cruzados */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Kpi icon={Clock} tone="warning" label="Em aberto" value={String(totals.open_count)} sub={formatBRL(totals.open_value)} />
          <Kpi icon={Target} tone="info" label="Ticket médio" value={formatBRL(totals.avg_ticket)} sub="dos abertos" />
          <Kpi icon={TrendingUp} tone="success" label="Conversão geral" value={`${totals.conversion_overall.toFixed(0)}%`} sub={`${totals.closed_count} fechados`} />
          <Kpi icon={AlertTriangle} tone="destructive" label="Idade média" value={`${totals.avg_age_days.toFixed(0)}d`} sub="quanto maior, pior" />
        </div>

        {/* IA Result */}
        {ai && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold font-display">Diagnóstico IA</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  ai.score >= 75 ? 'bg-success/10 text-success' :
                  ai.score >= 50 ? 'bg-warning/10 text-warning' :
                  'bg-destructive/10 text-destructive')}>
                  {ai.health_label} · {ai.score}/100
                </span>
              </div>
            </div>
            {ai.summary && <p className="text-sm font-medium">{ai.summary}</p>}
            {ai.diagnostico && <p className="text-xs text-muted-foreground leading-relaxed">{ai.diagnostico}</p>}

            {ai.acoes_urgentes?.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Ações urgentes</p>
                <ul className="space-y-1.5">
                  {ai.acoes_urgentes.map((a: any, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span className={cn('mt-0.5 inline-flex h-1.5 w-1.5 rounded-full shrink-0',
                        a.prioridade === 'alta' ? 'bg-destructive' : a.prioridade === 'media' ? 'bg-warning' : 'bg-info')} />
                      <div>
                        <span className="font-semibold">{a.titulo}</span>
                        {a.cliente && <span className="text-muted-foreground"> — {a.cliente}</span>}
                        <span className="block text-muted-foreground">{a.acao}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3">
              {ai.top_canais?.length > 0 && (
                <div className="rounded-lg bg-card/50 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><Megaphone className="h-3 w-3" /> Canais</p>
                  <ul className="space-y-1 text-xs">
                    {ai.top_canais.map((c: any, i: number) => (
                      <li key={i}><span className="font-semibold">{c.canal}:</span> <span className="text-muted-foreground">{c.insight}</span></li>
                    ))}
                  </ul>
                </div>
              )}
              {ai.top_regioes?.length > 0 && (
                <div className="rounded-lg bg-card/50 p-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> Regiões</p>
                  <ul className="space-y-1 text-xs">
                    {ai.top_regioes.map((r: any, i: number) => (
                      <li key={i}><span className="font-semibold">{r.regiao}:</span> <span className="text-muted-foreground">{r.insight}</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {ai.alertas?.length > 0 && (
              <div className="space-y-1">
                {ai.alertas.map((al: any, i: number) => (
                  <div key={i} className="flex gap-2 rounded-lg bg-destructive/5 border border-destructive/20 p-2 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                    <div><span className="font-semibold">{al.titulo}:</span> <span className="text-muted-foreground">{al.detalhe}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cards de orçamentos em aberto */}
        {openSorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            Nenhum orçamento em aberto. Bom trabalho! 🎯
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {openSorted.slice(0, 9).map(b => {
              const age = ageDays(b.created_at);
              const ageTone = age > 30 ? 'text-destructive' : age > 15 ? 'text-warning' : 'text-muted-foreground';
              return (
                <button key={b.id} onClick={() => onOpenBudget(b.id)}
                  className="text-left rounded-xl border border-border/60 bg-card/60 p-3 hover:border-primary/40 hover:shadow-md transition-all space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{b.code}</span>
                    <span className={cn('text-[10px] font-semibold tabular-nums', ageTone)}>{age}d</span>
                  </div>
                  <p className="text-sm font-semibold truncate">{b.clients?.name || b.project_name || '—'}</p>
                  <p className="text-base font-display font-bold text-primary tabular-nums">{formatBRL(b.final_price)}</p>
                  <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1 truncate">
                      <Megaphone className="h-2.5 w-2.5 shrink-0" />
                      {sourceLabel(b.source)}
                    </span>
                    {b.clients?.city && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                        {b.clients.city}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-border/40">
                    <span className="text-[10px] text-muted-foreground">{sellerName(b.seller_id) || 'sem vendedor'}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
        {openSorted.length > 9 && (
          <p className="text-[11px] text-center text-muted-foreground">+ {openSorted.length - 9} outros na lista abaixo</p>
        )}
      </div>

      {/* Cruzamento detalhado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Origem */}
        <div className="card-premium rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-gold" />
            <h4 className="font-display text-sm font-semibold">Origem dos Leads</h4>
            <span className="text-[10px] text-muted-foreground ml-auto">conversão = fechados / (fechados + recusados)</span>
          </div>
          {bySource.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sem dados ainda. Informe a origem ao criar orçamentos.</p>
          ) : (
            <div className="space-y-2">
              {bySource.map(s => (
                <div key={s.source_raw} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{s.source}</p>
                    <p className="text-[10px] text-muted-foreground">{s.count} em aberto · {formatBRL(s.total)}</p>
                  </div>
                  <div className={cn('text-xs font-bold tabular-nums shrink-0',
                    s.conversion >= 50 ? 'text-success' : s.conversion >= 25 ? 'text-warning' : 'text-destructive')}>
                    {s.conversion.toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Região */}
        <div className="card-premium rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gold" />
            <h4 className="font-display text-sm font-semibold">Região & Ticket Médio</h4>
          </div>
          {byRegion.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Sem dados de cidade nos clientes.</p>
          ) : (
            <div className="space-y-2">
              {byRegion.map(r => (
                <div key={r.region} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{r.region}</p>
                    <p className="text-[10px] text-muted-foreground">{r.count} projeto(s) · {formatBRL(r.total)}</p>
                  </div>
                  <div className="text-xs font-bold tabular-nums text-primary shrink-0">{formatBRL(r.avg_ticket)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Kpi({ icon: Icon, tone, label, value, sub }: { icon: typeof Clock; tone: 'warning' | 'info' | 'success' | 'destructive'; label: string; value: string; sub: string }) {
  const toneClasses = {
    warning: 'border-warning/20 bg-warning/5 text-warning',
    info: 'border-info/20 bg-info/5 text-info',
    success: 'border-success/20 bg-success/5 text-success',
    destructive: 'border-destructive/20 bg-destructive/5 text-destructive',
  } as const;
  return (
    <div className={cn('rounded-xl border p-3', toneClasses[tone])}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="font-display text-xl font-semibold leading-tight">{value}</p>
      <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">{sub}</p>
    </div>
  );
}
