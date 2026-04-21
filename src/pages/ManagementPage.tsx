import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar as CalendarIcon, Target, Award, ChevronLeft, ChevronRight,
  Factory, Truck, LifeBuoy, TrendingUp, DollarSign, Trophy,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatBRL } from '@/lib/format';
import { cn } from '@/lib/utils';

type EventType = 'montagem' | 'entrega' | 'assistencia' | 'medicao';
interface CalEvent {
  id: string;
  date: string;          // YYYY-MM-DD
  time?: string | null;  // HH:mm
  title: string;
  subtitle: string;
  type: EventType;
  assignee?: string | null;
  address?: string | null;
  phone?: string | null;
  description?: string | null;
}

const typeMeta: Record<EventType, { label: string; className: string; dot: string; icon: typeof Factory }> = {
  montagem:    { label: 'Montagem',    className: 'bg-info/10 text-info border-info/30',                       dot: 'bg-info',        icon: Factory },
  entrega:     { label: 'Entrega',     className: 'bg-success/10 text-success border-success/30',              dot: 'bg-success',     icon: Truck },
  assistencia: { label: 'Assistência', className: 'bg-destructive/10 text-destructive border-destructive/30',  dot: 'bg-destructive', icon: LifeBuoy },
  medicao:     { label: 'Medição',     className: 'bg-primary/10 text-primary border-primary/30',              dot: 'bg-primary',     icon: Target },
};

export default function ManagementPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'calendar' | 'goals' | 'commissions'>('calendar');

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" /> Gestão
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Calendário operacional, metas mensais e comissões por vendedor.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="calendar"><CalendarIcon className="h-4 w-4 mr-2" />Calendário</TabsTrigger>
          <TabsTrigger value="goals"><Target className="h-4 w-4 mr-2" />Metas</TabsTrigger>
          <TabsTrigger value="commissions"><Award className="h-4 w-4 mr-2" />Comissões</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-6"><CalendarView userId={user?.id} /></TabsContent>
        <TabsContent value="goals" className="mt-6"><GoalsView userId={user?.id} /></TabsContent>
        <TabsContent value="commissions" className="mt-6"><CommissionsView userId={user?.id} /></TabsContent>
      </Tabs>
    </motion.div>
  );
}

/* ============================ CALENDAR ============================ */

function CalendarView({ userId }: { userId?: string }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => { if (userId) load(); }, [userId, cursor]);

  async function load() {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).toISOString().slice(0, 10);

    const [tasks, assists] = await Promise.all([
      supabase.from('production_tasks')
        .select('id, project_name, client_name, due_date, stage')
        .not('due_date', 'is', null)
        .gte('due_date', start).lte('due_date', end),
      supabase.from('technical_assistance')
        .select('id, project_name, client_name, opened_at, priority')
        .gte('opened_at', start + 'T00:00:00').lte('opened_at', end + 'T23:59:59'),
    ]);

    const evs: CalEvent[] = [];
    (tasks.data || []).forEach((t: any) => {
      const type: EventType = t.stage === 'entregue' ? 'entrega' : 'montagem';
      evs.push({ id: `t-${t.id}`, date: t.due_date, title: t.project_name, subtitle: t.client_name, type });
    });
    (assists.data || []).forEach((a: any) => {
      evs.push({
        id: `a-${a.id}`, date: a.opened_at.slice(0, 10),
        title: a.project_name, subtitle: a.client_name, type: 'assistencia',
      });
    });
    setEvents(evs);
  }

  const monthLabel = cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const firstDow = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const eventsByDate = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    events.forEach(e => {
      const arr = m.get(e.date) || [];
      arr.push(e); m.set(e.date, arr);
    });
    return m;
  }, [events]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const selectedEvents = selectedDate ? (eventsByDate.get(selectedDate) || []) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="font-display capitalize">{monthLabel}</CardTitle>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}>Hoje</Button>
            <Button size="icon" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (day === null) return <div key={idx} />;
              const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = eventsByDate.get(dateStr) || [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(dateStr)}
                  className={cn(
                    'aspect-square rounded-lg border p-1 text-left text-xs transition-all hover:border-primary',
                    isSelected ? 'border-primary bg-primary/5 shadow-primary' : 'border-border',
                    isToday && !isSelected && 'border-primary/40 bg-primary/5',
                  )}
                >
                  <div className={cn('font-semibold mb-1', isToday && 'text-primary')}>{day}</div>
                  <div className="flex flex-wrap gap-0.5">
                    {dayEvents.slice(0, 3).map(e => (
                      <span key={e.id} className={cn('h-1.5 w-1.5 rounded-full', typeMeta[e.type].dot)} />
                    ))}
                    {dayEvents.length > 3 && <span className="text-[9px] text-muted-foreground">+{dayEvents.length - 3}</span>}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-border text-xs">
            {(Object.keys(typeMeta) as EventType[]).map(t => (
              <div key={t} className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', typeMeta[t].dot)} />
                <span className="text-muted-foreground">{typeMeta[t].label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">
            {selectedDate
              ? new Date(selectedDate + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
              : 'Selecione um dia'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!selectedDate ? (
            <p className="text-sm text-muted-foreground">Clique em um dia para ver os eventos.</p>
          ) : selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento neste dia.</p>
          ) : selectedEvents.map(e => {
            const meta = typeMeta[e.type];
            const Icon = meta.icon;
            return (
              <div key={e.id} className="flex items-start gap-2 p-3 rounded-lg border border-border">
                <div className={cn('rounded p-1.5 shrink-0', meta.className)}><Icon className="h-3.5 w-3.5" /></div>
                <div className="flex-1 min-w-0">
                  <Badge variant="outline" className={cn('text-[10px] mb-1', meta.className)}>{meta.label}</Badge>
                  <p className="text-sm font-medium truncate">{e.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{e.subtitle}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================ GOALS ============================ */

function GoalsView({ userId }: { userId?: string }) {
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [series, setSeries] = useState<{ month: string; revenue: number }[]>([]);

  useEffect(() => { if (userId) load(); }, [userId]);

  async function load() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const [settings, currentBudgets, sixMonths] = await Promise.all([
      supabase.from('company_settings').select('monthly_goal').limit(1).maybeSingle(),
      supabase.from('budgets').select('final_price, status, created_at')
        .eq('status', 'approved').gte('created_at', start).lte('created_at', end + 'T23:59:59'),
      supabase.from('budgets').select('final_price, created_at')
        .eq('status', 'approved')
        .gte('created_at', new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()),
    ]);

    setMonthlyGoal(Number(settings.data?.monthly_goal || 0));
    const total = (currentBudgets.data || []).reduce((s, b: any) => s + Number(b.final_price), 0);
    setRevenue(total);
    setApprovedCount((currentBudgets.data || []).length);

    const buckets = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
    }
    (sixMonths.data || []).forEach((b: any) => {
      const d = new Date(b.created_at);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      if (buckets.has(k)) buckets.set(k, (buckets.get(k) || 0) + Number(b.final_price));
    });
    const out: { month: string; revenue: number }[] = [];
    buckets.forEach((v, k) => {
      const [y, m] = k.split('-').map(Number);
      out.push({ month: new Date(y, m, 1).toLocaleDateString('pt-BR', { month: 'short' }), revenue: v });
    });
    setSeries(out);
  }

  const pct = monthlyGoal > 0 ? Math.min(100, (revenue / monthlyGoal) * 100) : 0;
  const remaining = Math.max(0, monthlyGoal - revenue);
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const expectedPct = (dayOfMonth / daysInMonth) * 100;
  const onTrack = pct >= expectedPct;

  const maxSeries = Math.max(...series.map(s => s.revenue), monthlyGoal, 1);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Meta do Mês
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {monthlyGoal === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Defina uma meta mensal em <strong>Configurações</strong> para acompanhar o progresso.
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Realizado</p>
                  <p className="text-3xl font-bold font-display">{formatBRL(revenue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">de {formatBRL(monthlyGoal)}</p>
                </div>
                <div className="text-right">
                  <Badge className={cn('mb-1', onTrack ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
                    {onTrack ? 'No ritmo' : 'Abaixo do ritmo'}
                  </Badge>
                  <p className="text-2xl font-bold font-display">{pct.toFixed(0)}%</p>
                </div>
              </div>
              <div className="relative">
                <Progress value={pct} className="h-3" />
                <div
                  className="absolute top-0 h-3 w-0.5 bg-foreground/40"
                  style={{ left: `${expectedPct}%` }}
                  title={`Esperado: ${expectedPct.toFixed(0)}%`}
                />
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                <Mini label="Faltam" value={formatBRL(remaining)} />
                <Mini label="Aprovados" value={String(approvedCount)} />
                <Mini label="Esperado hoje" value={`${expectedPct.toFixed(0)}%`} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Últimos 6 meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {series.map((s, i) => {
              const w = (s.revenue / maxSeries) * 100;
              const meetsGoal = monthlyGoal > 0 && s.revenue >= monthlyGoal;
              return (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize text-muted-foreground">{s.month}</span>
                    <span className="font-semibold">{formatBRL(s.revenue)}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', meetsGoal ? 'bg-success' : 'bg-primary')}
                      style={{ width: `${w}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold font-display">{value}</p>
    </div>
  );
}

/* ============================ COMMISSIONS ============================ */

interface CommissionRow {
  assignee: string;
  count: number;
  totalRevenue: number;
  commission: number;
}

function CommissionsView({ userId }: { userId?: string }) {
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [commissionPct, setCommissionPct] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (userId) load(); }, [userId, period]);

  async function load() {
    setLoading(true);
    const now = new Date();
    let start: Date;
    if (period === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === 'quarter') start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    else start = new Date(now.getFullYear(), 0, 1);

    const [settings, budgets] = await Promise.all([
      supabase.from('company_settings').select('default_commission').limit(1).maybeSingle(),
      supabase.from('budgets')
        .select('final_price, status, created_at, production_tasks(assignee)')
        .eq('status', 'approved')
        .gte('created_at', start.toISOString()),
    ]);

    const pct = Number(settings.data?.default_commission || 0);
    setCommissionPct(pct);

    const map = new Map<string, CommissionRow>();
    (budgets.data || []).forEach((b: any) => {
      const assignee = (b.production_tasks?.[0]?.assignee) || 'Sem responsável';
      const cur = map.get(assignee) || { assignee, count: 0, totalRevenue: 0, commission: 0 };
      cur.count++;
      cur.totalRevenue += Number(b.final_price);
      cur.commission = cur.totalRevenue * (pct / 100);
      map.set(assignee, cur);
    });
    const list = Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
    setRows(list);
    setLoading(false);
  }

  const totals = rows.reduce(
    (acc, r) => ({ count: acc.count + r.count, revenue: acc.revenue + r.totalRevenue, commission: acc.commission + r.commission }),
    { count: 0, revenue: 0, commission: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold font-display">Comissões</h2>
          <Badge variant="outline" className="text-xs">{commissionPct}% padrão</Badge>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mês atual</SelectItem>
            <SelectItem value="quarter">Últimos 3 meses</SelectItem>
            <SelectItem value="year">Ano atual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Vendedores ativos" value={String(rows.length)} icon={Trophy} />
        <KpiCard label="Receita aprovada" value={formatBRL(totals.revenue)} icon={DollarSign} />
        <KpiCard label="Total comissões" value={formatBRL(totals.commission)} icon={Award} highlight />
      </div>

      {commissionPct === 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm">
            ⚠ Defina a <strong>comissão padrão</strong> em <strong>Configurações</strong> para calcular os valores.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Carregando…</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Nenhum orçamento aprovado no período.
            </div>
          ) : (
            <div className="divide-y divide-border">
              <div className="grid grid-cols-12 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                <div className="col-span-5">Vendedor / Responsável</div>
                <div className="col-span-2 text-center">Vendas</div>
                <div className="col-span-3 text-right">Receita</div>
                <div className="col-span-2 text-right">Comissão</div>
              </div>
              {rows.map((r, i) => (
                <div key={r.assignee} className="grid grid-cols-12 px-4 py-3 text-sm items-center hover:bg-muted/20 transition-colors">
                  <div className="col-span-5 flex items-center gap-2">
                    {i === 0 && rows.length > 1 && <Trophy className="h-4 w-4 text-warning shrink-0" />}
                    <span className="font-medium truncate">{r.assignee}</span>
                  </div>
                  <div className="col-span-2 text-center">
                    <Badge variant="outline" className="text-xs">{r.count}</Badge>
                  </div>
                  <div className="col-span-3 text-right font-semibold">{formatBRL(r.totalRevenue)}</div>
                  <div className="col-span-2 text-right font-bold text-primary">{formatBRL(r.commission)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, highlight }: {
  label: string; value: string; icon: typeof Trophy; highlight?: boolean;
}) {
  return (
    <Card className={cn(highlight && 'border-primary/40 bg-primary/5')}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('rounded-lg p-2', highlight ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold font-display leading-none">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
