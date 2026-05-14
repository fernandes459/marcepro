import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  TrendingUp, Target, Factory, AlertTriangle, Calendar as CalendarIcon,
  Wrench, Truck, Hammer, Clock, ArrowRight, CheckCircle2, Flame, Activity, BarChart3,
  MapPin, Percent, Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatBRL } from '@/lib/format';
import { summarizeFinance } from '@/lib/finance-calc';
import { isFixedExpense } from '@/lib/financial';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

const stageLabels: Record<string, string> = {
  corte: 'Corte', borda: 'Borda', usinagem: 'Usinagem',
  montagem: 'Montagem', assistencia: 'Assistência', entregue: 'Entregue',
};

const eventIcons: Record<string, typeof Hammer> = {
  montagem: Hammer,
  entrega: Truck,
  assistencia: Wrench,
  producao: Factory,
};

const eventColors: Record<string, string> = {
  montagem: 'text-info bg-info/10 border-info/20',
  entrega: 'text-success bg-success/10 border-success/20',
  assistencia: 'text-destructive bg-destructive/10 border-destructive/20',
  producao: 'text-primary bg-primary/10 border-primary/20',
};

interface Tx { id: string; type: string; amount: number; date: string; due_date: string | null; status: string; category: string; is_fixed: boolean; }
interface Budget { id: string; status: string; final_price: number; created_at?: string; client_id?: string | null; clients?: { name: string } | null; }
interface Task { id: string; stage: string; project_name: string; client_name: string; due_date: string | null; }
interface ClientRow { id: string; name: string; city: string | null; state: string | null; total_spent: number | null; budgets_count: number | null; }

type FilterMode = 'month' | 'custom';

function getMonthOptions() {
  return Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1).padStart(2, '0'),
    label: new Date(2026, index, 1).toLocaleDateString('pt-BR', { month: 'long' }),
  }));
}

function getYearOptions(currentYear: number) {
  return Array.from({ length: 5 }, (_, index) => String(currentYear - 2 + index));
}

function isDateWithinRange(value: string | null | undefined, start: string, end: string) {
  if (!value) return false;
  return value >= start && value <= end;
}

function getMonthRange(year: string, month: string) {
  const start = `${year}-${month}-01`;
  const end = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);
  return { start, end };
}

function inferEventType(stage: string): keyof typeof eventColors {
  if (stage === 'assistencia') return 'assistencia';
  if (stage === 'montagem') return 'montagem';
  if (stage === 'entregue') return 'entrega';
  return 'producao';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clientsList, setClientsList] = useState<ClientRow[]>([]);
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [loading, setLoading] = useState(true);
  const today = useMemo(() => new Date(), []);
  const todayISO = today.toISOString().slice(0, 10);
  const [filterMode, setFilterMode] = useState<FilterMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(todayISO.slice(5, 7));
  const [selectedYear, setSelectedYear] = useState(todayISO.slice(0, 4));
  const [customStart, setCustomStart] = useState(`${todayISO.slice(0, 7)}-01`);
  const [customEnd, setCustomEnd] = useState(todayISO);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [txRes, budRes, taskRes, settingsRes, clientsRes] = await Promise.all([
      supabase.from('financial_transactions').select('id, type, amount, date, due_date, status, category, is_fixed'),
      supabase.from('budgets').select('id, status, final_price, created_at, client_id, clients(name)').order('created_at', { ascending: false }),
      supabase.from('production_tasks').select('id, stage, project_name, client_name, due_date'),
      supabase.from('company_settings').select('monthly_goal').maybeSingle(),
      supabase.from('clients').select('id, name, city, state, total_spent, budgets_count'),
    ]);
    if (txRes.data) setTransactions(txRes.data as Tx[]);
    if (budRes.data) setBudgets(budRes.data as unknown as Budget[]);
    if (taskRes.data) setTasks(taskRes.data as Task[]);
    if (settingsRes.data) setMonthlyGoal(Number(settingsRes.data.monthly_goal) || 0);
    if (clientsRes.data) setClientsList(clientsRes.data as ClientRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`dashboard-exec-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_transactions' }, () => void fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, () => void fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_tasks' }, () => void fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_settings' }, () => void fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => void fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, user]);

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const yearOptions = useMemo(() => getYearOptions(today.getFullYear()), [today]);
  const period = useMemo(() => {
    if (filterMode === 'custom') {
      const start = customStart || `${selectedYear}-${selectedMonth}-01`;
      const end = customEnd || todayISO;
      return {
        start: start <= end ? start : end,
        end: end >= start ? end : start,
      };
    }

    return getMonthRange(selectedYear, selectedMonth);
  }, [customEnd, customStart, filterMode, selectedMonth, selectedYear, todayISO]);

  const filteredTransactions = useMemo(
    () => transactions.filter((tx) => isDateWithinRange(tx.date, period.start, period.end)),
    [period.end, period.start, transactions]
  );
  const filteredTasks = useMemo(
    () => tasks.filter((task) => isDateWithinRange(task.due_date, period.start, period.end)),
    [period.end, period.start, tasks]
  );
  const periodLabel = useMemo(() => {
    if (filterMode === 'custom') {
      return `${new Date(`${period.start}T12:00:00`).toLocaleDateString('pt-BR')} → ${new Date(`${period.end}T12:00:00`).toLocaleDateString('pt-BR')}`;
    }

    return new Date(`${selectedYear}-${selectedMonth}-01T12:00:00`).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
  }, [filterMode, period.end, period.start, selectedMonth, selectedYear]);

  // ===== KPIs do período (regras canônicas em finance-calc) =====
  const summary = useMemo(() => summarizeFinance(filteredTransactions, todayISO), [filteredTransactions, todayISO]);
  const monthIncome = summary.income;
  const monthExpense = summary.expense;
  const monthProfit = summary.profit;
  const margin = summary.margin;
  const goalProgress = monthlyGoal > 0 ? Math.min(100, (monthIncome / monthlyGoal) * 100) : 0;
  const goalRemaining = Math.max(0, monthlyGoal - monthIncome);

  // ===== Projetos =====
  const activeProjects = useMemo(() => filteredTasks.filter(t => t.stage !== 'entregue'), [filteredTasks]);
  const overdueProjects = useMemo(
    () => activeProjects.filter(t => t.due_date && t.due_date < todayISO),
    [activeProjects, todayISO]
  );
  const assistanceProjects = useMemo(() => filteredTasks.filter(t => t.stage === 'assistencia'), [filteredTasks]);

  // ===== Agenda da semana =====
  const weekEvents = useMemo(() => {
    const start = new Date(today);
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    const startISO = start.toISOString().slice(0, 10);
    const endISO = end.toISOString().slice(0, 10);
    return filteredTasks
      .filter(t => t.due_date && t.due_date >= startISO && t.due_date <= endISO)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
      .slice(0, 8)
      .map(t => ({ ...t, eventType: inferEventType(t.stage) }));
  }, [filteredTasks, today]);

  const weekSummary = useMemo(() => {
    const counts = { montagem: 0, entrega: 0, assistencia: 0, producao: 0 };
    weekEvents.forEach(e => { counts[e.eventType] = (counts[e.eventType] ?? 0) + 1; });
    return counts;
  }, [weekEvents]);

  // ===== Power BI: série diária com acúmulo =====
  const biChartData = useMemo(() => {
    const byDay: Record<string, { date: string; entrada: number; saida: number }> = {};
    filteredTransactions.forEach((tx) => {
      const key = tx.date;
      if (!byDay[key]) byDay[key] = { date: key, entrada: 0, saida: 0 };
      const isPaid = tx.status === 'paid';
      if (!isPaid) return;
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income') byDay[key].entrada += amount;
      else byDay[key].saida += amount;
    });
    const sorted = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
    let acc = 0;
    return sorted.map((row) => {
      acc += row.entrada - row.saida;
      return {
        ...row,
        label: new Date(row.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        acumulado: acc,
      };
    });
  }, [filteredTransactions]);

  // ===== Alertas críticos =====
  const overdueReceivables = useMemo(
    () => filteredTransactions.filter(t => t.type === 'income' && t.status === 'pending' && t.due_date && t.due_date < todayISO),
    [filteredTransactions, todayISO]
  );

  // ===== Taxa de Conversão (orçamentos do período) =====
  const periodBudgets = useMemo(
    () => budgets.filter(b => b.created_at && b.created_at.slice(0, 10) >= period.start && b.created_at.slice(0, 10) <= period.end),
    [budgets, period.start, period.end]
  );
  const conversion = useMemo(() => {
    const total = periodBudgets.length;
    const won = periodBudgets.filter(b => ['approved', 'aprovado', 'won', 'closed', 'fechado'].includes((b.status || '').toLowerCase())).length;
    const lost = periodBudgets.filter(b => ['lost', 'rejected', 'perdido', 'recusado'].includes((b.status || '').toLowerCase())).length;
    const rate = total > 0 ? (won / total) * 100 : 0;
    return { total, won, lost, rate };
  }, [periodBudgets]);

  // ===== Diagnóstico de Regiões =====
  const regionStats = useMemo(() => {
    const map = new Map<string, { region: string; clients: number; revenue: number; budgets: number }>();
    clientsList.forEach(c => {
      const city = (c.city || '').trim();
      const uf = (c.state || '').trim().toUpperCase();
      if (!city && !uf) return;
      const key = city ? `${city}${uf ? ' - ' + uf : ''}` : uf;
      const cur = map.get(key) || { region: key, clients: 0, revenue: 0, budgets: 0 };
      cur.clients += 1;
      cur.revenue += Number(c.total_spent || 0);
      cur.budgets += Number(c.budgets_count || 0);
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue || b.clients - a.clients).slice(0, 6);
  }, [clientsList]);
  const totalClientsWithRegion = regionStats.reduce((s, r) => s + r.clients, 0);

  const hasCriticalAlerts = assistanceProjects.length > 0 || overdueProjects.length > 0 || overdueReceivables.length > 0;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold font-display tracking-tight">Bom dia, mestre 👋</h1>
          <p className="text-muted-foreground text-sm">
            {today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <p className="text-xs text-muted-foreground">Período analisado: {periodLabel}</p>
        </div>

        <Card className="w-full lg:w-auto">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-4">
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="dashboard-filter-mode">Filtro</Label>
              <Select value={filterMode} onValueChange={(value: FilterMode) => setFilterMode(value)}>
                <SelectTrigger id="dashboard-filter-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mês/Ano</SelectItem>
                  <SelectItem value="custom">Período</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filterMode === 'month' ? (
              <>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="dashboard-month">Mês</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger id="dashboard-month">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((month) => (
                        <SelectItem key={month.value} value={month.value}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="dashboard-year">Ano</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger id="dashboard-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="dashboard-start">Início</Label>
                  <Input id="dashboard-start" type="date" value={customStart} max={customEnd || undefined} onChange={(event) => setCustomStart(event.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-1">
                  <Label htmlFor="dashboard-end">Fim</Label>
                  <Input id="dashboard-end" type="date" value={customEnd} min={customStart || undefined} onChange={(event) => setCustomEnd(event.target.value)} />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============ ALERTAS CRÍTICOS (TOPO) ============ */}
      {hasCriticalAlerts && (
        <motion.div variants={itemVariants} className="grid gap-3 sm:grid-cols-3">
          {assistanceProjects.length > 0 && (
            <Link to="/producao">
              <Card className="border-destructive/40 bg-destructive/5 hover:shadow-soft transition-all">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/15">
                    <Wrench className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Ação Necessária</p>
                    <p className="text-sm font-bold">{assistanceProjects.length} assistência(s) pendente(s)</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-destructive shrink-0" />
                </CardContent>
              </Card>
            </Link>
          )}
          {overdueProjects.length > 0 && (
            <Link to="/producao">
              <Card className="border-warning/40 bg-warning/5 hover:shadow-soft transition-all">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/15">
                    <Flame className="h-5 w-5 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-warning uppercase tracking-wide">Atenção</p>
                    <p className="text-sm font-bold">{overdueProjects.length} projeto(s) atrasado(s)</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-warning shrink-0" />
                </CardContent>
              </Card>
            </Link>
          )}
          {overdueReceivables.length > 0 && (
            <Link to="/financeiro">
              <Card className="border-destructive/40 bg-destructive/5 hover:shadow-soft transition-all">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/15">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-destructive uppercase tracking-wide">A Receber</p>
                    <p className="text-sm font-bold">{overdueReceivables.length} conta(s) vencida(s)</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-destructive shrink-0" />
                </CardContent>
              </Card>
            </Link>
          )}
        </motion.div>
      )}

      {/* ============ 4 KPIs EXECUTIVOS ============ */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Faturamento */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden hover:shadow-soft transition-all">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Faturamento</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/10">
                  <TrendingUp className="h-4 w-4 text-success" />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold font-display text-foreground tabular-nums">
                {formatBRL(monthIncome)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">Recebido no período</p>
              {monthlyGoal > 0 && (
                <div className="mt-3 space-y-1">
                  <Progress value={goalProgress} className="h-1.5" />
                  <p className="text-[10px] text-muted-foreground">
                    {goalProgress.toFixed(0)}% da meta · faltam <span className="font-semibold text-foreground">{formatBRL(goalRemaining)}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Lucro */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden hover:shadow-soft transition-all">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lucro Líquido</p>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent">
                  <Target className="h-4 w-4 text-accent-foreground" />
                </div>
              </div>
              <p className={`text-2xl sm:text-3xl font-bold font-display tabular-nums ${monthProfit >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                {formatBRL(monthProfit)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Margem <span className={`font-semibold ${margin >= 20 ? 'text-success' : margin >= 10 ? 'text-warning' : 'text-destructive'}`}>{margin.toFixed(1)}%</span>
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Projetos ativos */}
        <motion.div variants={itemVariants}>
          <Link to="/producao">
            <Card className="overflow-hidden hover:shadow-soft hover:border-primary/30 transition-all cursor-pointer h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projetos Ativos</p>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-info/10">
                    <Factory className="h-4 w-4 text-info" />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-bold font-display text-foreground tabular-nums">
                  {activeProjects.length}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Em produção agora</p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        {/* Atrasados */}
        <motion.div variants={itemVariants}>
          <Link to="/producao">
            <Card className={`overflow-hidden hover:shadow-soft transition-all cursor-pointer h-full ${overdueProjects.length > 0 ? 'border-destructive/30' : ''}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Atrasados</p>
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${overdueProjects.length > 0 ? 'bg-destructive/10' : 'bg-muted'}`}>
                    <AlertTriangle className={`h-4 w-4 ${overdueProjects.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                  </div>
                </div>
                <p className={`text-2xl sm:text-3xl font-bold font-display tabular-nums ${overdueProjects.length > 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {overdueProjects.length}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {overdueProjects.length === 0 ? 'Tudo em dia ✓' : 'Requer atenção'}
                </p>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </div>

      {/* ============ TAXA DE CONVERSÃO + REGIÕES ============ */}
      <motion.div variants={itemVariants} className="grid gap-4 lg:grid-cols-3">
        {/* Conversão */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Percent className="h-4 w-4 text-primary" />
              Taxa de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-4xl font-bold font-display tabular-nums text-foreground">
                {conversion.rate.toFixed(1)}<span className="text-xl text-muted-foreground">%</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {conversion.won} fechados de {conversion.total} orçamentos no período
              </p>
            </div>
            <Progress value={conversion.rate} className="h-2" />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-muted/40 p-2">
                <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                <p className="font-display font-semibold">{conversion.total}</p>
              </div>
              <div className="rounded-lg bg-success/10 p-2">
                <p className="text-[10px] text-success uppercase">Ganhos</p>
                <p className="font-display font-semibold text-success">{conversion.won}</p>
              </div>
              <div className="rounded-lg bg-destructive/10 p-2">
                <p className="text-[10px] text-destructive uppercase">Perdidos</p>
                <p className="font-display font-semibold text-destructive">{conversion.lost}</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {conversion.rate >= 50
                ? '🎯 Excelente taxa de conversão.'
                : conversion.rate >= 30
                ? '👍 Boa conversão — busque atingir 50%+.'
                : conversion.total === 0
                ? 'Sem orçamentos no período.'
                : '⚠️ Conversão baixa — revise preços e follow-ups.'}
            </p>
          </CardContent>
        </Card>

        {/* Diagnóstico de Regiões */}
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Diagnóstico de Regiões
              </CardTitle>
              <Link to="/clientes" className="text-[11px] text-primary hover:underline flex items-center gap-1">
                Ver clientes <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {regionStats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Users className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Cadastre cidade/UF nos clientes para ver o diagnóstico</p>
              </div>
            ) : (
              <div className="space-y-2">
                {regionStats.map((r, i) => {
                  const pct = totalClientsWithRegion > 0 ? (r.clients / totalClientsWithRegion) * 100 : 0;
                  return (
                    <div key={r.region} className="rounded-xl border border-border/50 p-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-muted-foreground tabular-nums w-5">#{i + 1}</span>
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-sm font-semibold truncate">{r.region}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] shrink-0">
                          <span className="text-muted-foreground">{r.clients} cliente(s)</span>
                          <span className="font-semibold text-gold tabular-nums">{formatBRL(r.revenue)}</span>
                        </div>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
                <p className="text-[11px] text-muted-foreground pt-2">
                  💡 {regionStats[0].region} é sua região mais forte — concentre marketing e indicações por lá.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ============ POWER BI: FLUXO FINANCEIRO ============ */}
      <motion.div variants={itemVariants}>
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Fluxo Financeiro do Período
              </CardTitle>
              <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-success" /> Entradas</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-destructive" /> Saídas</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Saldo acumulado</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {biChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Sem movimentações pagas no período</p>
              </div>
            ) : (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={biChartData} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="acumColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: 4 }}
                      formatter={(value: number, name: string) => [formatBRL(value), name === 'entrada' ? 'Entradas' : name === 'saida' ? 'Saídas' : 'Acumulado']}
                    />
                    <Area type="monotone" dataKey="acumulado" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#acumColor)" />
                    <Bar dataKey="entrada" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="saida" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ============ AGENDA DA SEMANA ============ */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                Agenda da Semana
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                {weekSummary.montagem > 0 && (
                  <Badge variant="outline" className="text-[10px] gap-1 bg-info/5 text-info border-info/20">
                    <Hammer className="h-3 w-3" /> {weekSummary.montagem} montagem(ns)
                  </Badge>
                )}
                {weekSummary.entrega > 0 && (
                  <Badge variant="outline" className="text-[10px] gap-1 bg-success/5 text-success border-success/20">
                    <Truck className="h-3 w-3" /> {weekSummary.entrega} entrega(s)
                  </Badge>
                )}
                {weekSummary.assistencia > 0 && (
                  <Badge variant="outline" className="text-[10px] gap-1 bg-destructive/5 text-destructive border-destructive/20">
                    <Wrench className="h-3 w-3" /> {weekSummary.assistencia} assistência(s)
                  </Badge>
                )}
                {weekSummary.producao > 0 && (
                  <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5 text-primary border-primary/20">
                    <Factory className="h-3 w-3" /> {weekSummary.producao} produção
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {weekEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Nenhum compromisso nos próximos 7 dias</p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {weekEvents.map(ev => {
                  const Icon = eventIcons[ev.eventType] ?? Factory;
                  const dueDate = new Date(ev.due_date! + 'T12:00:00');
                  const isOverdue = ev.due_date! < todayISO;
                  return (
                    <Link key={ev.id} to="/producao">
                      <div className={`flex items-center gap-3 rounded-xl border p-3 transition-all hover:shadow-soft hover:scale-[1.01] ${eventColors[ev.eventType]}`}>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background/60">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate text-foreground">{ev.client_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {ev.project_name} · {stageLabels[ev.stage] ?? ev.stage}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-bold ${isOverdue ? 'text-destructive' : 'text-foreground'}`}>
                            {dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {dueDate.toLocaleDateString('pt-BR', { weekday: 'short' })}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ============ AÇÕES RÁPIDAS ============ */}
      <motion.div variants={itemVariants} className="grid gap-3 sm:grid-cols-3">
        <Link to="/orcamentos">
          <Card className="hover:shadow-soft hover:border-primary/30 transition-all cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
                <Activity className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Novo Orçamento</p>
                <p className="text-[11px] text-muted-foreground">Comece a vender agora</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/producao">
          <Card className="hover:shadow-soft hover:border-primary/30 transition-all cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
                <Factory className="h-5 w-5 text-info" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Ver Produção</p>
                <p className="text-[11px] text-muted-foreground">{activeProjects.length} em andamento</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
        <Link to="/financeiro">
          <Card className="hover:shadow-soft hover:border-primary/30 transition-all cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                <Clock className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Financeiro</p>
                <p className="text-[11px] text-muted-foreground">Lançamentos e contas</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </motion.div>
    </motion.div>
  );
}
