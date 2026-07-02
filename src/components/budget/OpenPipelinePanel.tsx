import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Clock, MapPin, Megaphone, Loader2, AlertTriangle, Target, Phone, Calendar, TrendingUp, ChevronRight, CheckCircle2, ListChecks, User, Trash2, PhoneCall, Search, FileText, Handshake, Trophy } from 'lucide-react';
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

// ===== Etapas do funil (inferidas automaticamente conforme o orçamento evolui) =====
export type PipelineStage = 'novo_contato' | 'qualificacao' | 'proposta' | 'negociacao' | 'fechamento';

export const STAGE_META: Record<PipelineStage, { label: string; icon: any; tone: string; ring: string; order: number }> = {
  novo_contato: { label: 'Novo Contato',    icon: PhoneCall, tone: 'text-info',        ring: 'border-info/30 bg-info/5',        order: 1 },
  qualificacao: { label: 'Qualificação',    icon: Search,    tone: 'text-primary',     ring: 'border-primary/30 bg-primary/5',  order: 2 },
  proposta:     { label: 'Proposta Enviada', icon: FileText,  tone: 'text-warning',     ring: 'border-warning/30 bg-warning/5',  order: 3 },
  negociacao:   { label: 'Negociação',      icon: Handshake, tone: 'text-gold',        ring: 'border-gold/30 bg-gold/5',        order: 4 },
  fechamento:   { label: 'Fechamento',      icon: Trophy,    tone: 'text-success',     ring: 'border-success/30 bg-success/5',  order: 5 },
};

/**
 * Deriva a etapa do funil a partir dos dados do orçamento — sem alterar schema.
 * Regras:
 *  - Aprovado/Produção  → Fechamento
 *  - Rascunho <= 2 dias → Novo Contato
 *  - Rascunho           → Qualificação
 *  - Pendente + idade > 12d OU notes com palavras de negociação → Negociação
 *  - Pendente           → Proposta Enviada
 */
export function inferStage(b: { status: string; created_at: string; updated_at?: string; notes?: string | null; final_price?: number | null }): PipelineStage {
  if (b.status === 'approved' || b.status === 'in_production') return 'fechamento';
  const age = Math.max(0, Math.floor((Date.now() - new Date(b.created_at).getTime()) / 86400000));
  const notes = (b.notes || '').toLowerCase();
  const negociando = /(negoci|desconto|contra[- ]?proposta|revis|ajuste de preço|nova proposta)/i.test(notes);
  if (b.status === 'draft') return age <= 2 ? 'novo_contato' : 'qualificacao';
  // pending
  if (negociando || age > 12) return 'negociacao';
  return 'proposta';
}

interface BudgetRow {
  id: string; code: string; project_name: string | null; status: string;
  final_price: number; total_cost: number; source: string | null;
  created_at: string; updated_at: string; approved_at: string | null;
  seller_id: string | null; notes?: string | null;
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

  // ===== Etapas do funil (Kanban) =====
  const [stageFilter, setStageFilter] = useState<PipelineStage | null>(null);
  const stageGroups = useMemo(() => {
    const groups: Record<PipelineStage, BudgetRow[]> = {
      novo_contato: [], qualificacao: [], proposta: [], negociacao: [], fechamento: [],
    };
    // Abertos são distribuídos entre novo_contato → negociacao
    openSorted.forEach(b => { groups[inferStage(b)].push(b); });
    // Fechados vão para "fechamento"
    closed.forEach(b => { groups.fechamento.push(b); });
    return groups;
  }, [openSorted, closed]);

  const visibleCards = useMemo(() => {
    if (!stageFilter) return openSorted;
    return (stageGroups[stageFilter] || []).filter(b => b.status === 'draft' || b.status === 'pending');
  }, [stageFilter, openSorted, stageGroups]);

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

        {/* Kanban de Etapas do Funil — atualiza automaticamente conforme o orçamento avança */}
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Etapas do Funil</span>
              <span className="text-[10px] text-muted-foreground">· atualização automática</span>
            </div>
            {stageFilter && (
              <button onClick={() => setStageFilter(null)} className="text-[10px] text-primary hover:underline">
                Limpar filtro
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {(Object.keys(STAGE_META) as PipelineStage[]).sort((a, b) => STAGE_META[a].order - STAGE_META[b].order).map(stage => {
              const meta = STAGE_META[stage];
              const list = stageGroups[stage] || [];
              const total = list.reduce((s, b) => s + Number(b.final_price || 0), 0);
              const active = stageFilter === stage;
              const Icon = meta.icon;
              return (
                <button key={stage}
                  onClick={() => setStageFilter(active ? null : stage)}
                  className={cn(
                    'text-left rounded-xl border p-2.5 transition-all hover:shadow-md',
                    meta.ring,
                    active ? 'ring-2 ring-primary/60 shadow-md' : 'hover:border-primary/40'
                  )}>
                  <div className="flex items-center justify-between mb-1">
                    <div className={cn('flex items-center gap-1.5', meta.tone)}>
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">{meta.label}</span>
                    </div>
                    <span className="text-[10px] font-bold tabular-nums">{list.length}</span>
                  </div>
                  <p className="text-xs font-bold tabular-nums leading-tight">{formatBRL(total)}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cards de orçamentos em aberto */}
        {visibleCards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            {stageFilter
              ? <>Nenhum orçamento na etapa <span className="font-semibold">{STAGE_META[stageFilter].label}</span>.</>
              : <>Nenhum orçamento em aberto. Bom trabalho! 🎯</>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {visibleCards.slice(0, 9).map(b => {
              const age = ageDays(b.created_at);
              const ageTone = age > 30 ? 'text-destructive' : age > 15 ? 'text-warning' : 'text-muted-foreground';
              const stage = inferStage(b);
              const stageMeta = STAGE_META[stage];
              const StageIcon = stageMeta.icon;
              return (
                <button key={b.id} onClick={() => onOpenBudget(b.id)}
                  className="text-left rounded-xl border border-border/60 bg-card/60 p-3 hover:border-primary/40 hover:shadow-md transition-all space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{b.code}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold', stageMeta.ring, stageMeta.tone)}>
                        <StageIcon className="h-2.5 w-2.5" />
                        {stageMeta.label}
                      </span>
                      <span className={cn('text-[10px] font-semibold tabular-nums', ageTone)}>{age}d</span>
                    </div>
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
        {visibleCards.length > 9 && (
          <p className="text-[11px] text-center text-muted-foreground">+ {visibleCards.length - 9} outros na lista abaixo</p>
        )}
        {openSorted.length > 9 && (
          <p className="text-[11px] text-center text-muted-foreground">+ {openSorted.length - 9} outros na lista abaixo</p>
        )}
      </div>

      {/* Follow-ups / Tarefas comerciais */}
      <div className="card-premium rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <ListChecks className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-display text-sm font-semibold">Follow-ups & Tarefas</h4>
            <p className="text-[11px] text-muted-foreground">
              Geradas automaticamente pelo Diagnóstico IA · {followUps.length} pendente(s)
            </p>
          </div>
          {followUps.some(f => f.origin === 'ai') && (
            <span className="text-[10px] rounded-full bg-primary/10 text-primary px-2 py-0.5 font-semibold">IA</span>
          )}
        </div>

        {followUps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
            Nenhuma tarefa pendente. Clique em <span className="font-semibold text-primary">Diagnóstico IA</span> para gerar follow-ups com responsável e prazo.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {followUps.map(f => {
              const overdue = f.due_date && new Date(f.due_date) < new Date(new Date().toDateString());
              const pTone = f.priority === 'high' || f.priority === 'urgent' ? 'bg-destructive/10 text-destructive border-destructive/30'
                : f.priority === 'low' ? 'bg-info/10 text-info border-info/30'
                : 'bg-warning/10 text-warning border-warning/30';
              const pLabel = f.priority === 'high' || f.priority === 'urgent' ? 'Alta' : f.priority === 'low' ? 'Baixa' : 'Média';
              const matched = f.budget_id ? budgets.find(b => b.id === f.budget_id) : null;
              return (
                <div key={f.id} className="rounded-xl border border-border/60 bg-card/60 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug flex-1">{f.title}</p>
                    <span className={cn('text-[10px] font-semibold rounded-full border px-2 py-0.5 shrink-0', pTone)}>{pLabel}</span>
                  </div>
                  {f.description && <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{f.description}</p>}
                  <div className="flex items-center justify-between flex-wrap gap-2 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><User className="h-3 w-3" />{f.assignee || 'Comercial'}</span>
                    {f.due_date && (
                      <span className={cn('inline-flex items-center gap-1 tabular-nums', overdue && 'text-destructive font-semibold')}>
                        <Calendar className="h-3 w-3" />
                        {new Date(f.due_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        {overdue && ' · atrasada'}
                      </span>
                    )}
                    {f.origin === 'ai' && <span className="inline-flex items-center gap-1 text-primary"><Sparkles className="h-3 w-3" />IA</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                    {matched ? (
                      <button onClick={() => onOpenBudget(matched.id)} className="text-[10px] font-mono text-primary hover:underline truncate">
                        {matched.code} — {matched.clients?.name || matched.project_name}
                      </button>
                    ) : <span className="text-[10px] text-muted-foreground">—</span>}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => removerFollowUp(f.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] gap-1" onClick={() => concluirFollowUp(f.id)}>
                        <CheckCircle2 className="h-3 w-3" /> Concluir
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
