import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, TrendingDown, Users, FileText, ArrowUpRight, ArrowDownRight,
  Factory, AlertTriangle, Calendar, Wallet, Target, Activity, BarChart3,
  ChevronRight, Clock, CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend,
  ComposedChart,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatBRL } from '@/lib/format';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

const statusMap: Record<string, { label: string; className: string }> = {
  approved: { label: 'Aprovado', className: 'bg-success/10 text-success border-success/20' },
  pending: { label: 'Pendente', className: 'bg-warning/10 text-warning border-warning/20' },
  draft: { label: 'Rascunho', className: 'bg-muted text-muted-foreground border-border' },
  rejected: { label: 'Rejeitado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const COLORS = ['hsl(152, 60%, 42%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(220, 16%, 75%)', 'hsl(28, 85%, 56%)', 'hsl(210, 80%, 52%)'];
const EXPENSE_COLORS = ['hsl(28, 85%, 56%)', 'hsl(0, 72%, 51%)', 'hsl(38, 92%, 50%)', 'hsl(210, 80%, 52%)', 'hsl(152, 60%, 42%)', 'hsl(280, 60%, 50%)', 'hsl(220, 16%, 65%)'];

const categoryLabels: Record<string, string> = {
  material: 'Material', labor: 'Mão de Obra', rent: 'Aluguel', salary: 'Salários',
  fuel: 'Combustível', food: 'Alimentação', tools: 'Ferramentas', maintenance: 'Manutenção',
  taxes: 'Impostos', utilities: 'Água/Luz/Internet', transport: 'Frete', marketing: 'Marketing',
  other_expense: 'Outros', project: 'Projeto', installment: 'Parcela', service: 'Serviço', other_income: 'Outros',
};

const stageLabels: Record<string, string> = { corte: 'Corte', borda: 'Borda', usinagem: 'Usinagem', montagem: 'Montagem', entregue: 'Entregue' };
const stageMap: Record<string, number> = { corte: 0, borda: 1, usinagem: 2, montagem: 3, entregue: 4 };

export default function DashboardPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    const [txRes, budRes, cliRes, taskRes, bankRes] = await Promise.all([
      supabase.from('financial_transactions').select('*').order('date', { ascending: false }),
      supabase.from('budgets').select('*, clients(name)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name'),
      supabase.from('production_tasks').select('*'),
      supabase.from('bank_accounts').select('*'),
    ]);

    if (txRes.data) setTransactions(txRes.data);
    if (budRes.data) setBudgets(budRes.data);
    if (cliRes.data) setClients(cliRes.data);
    if (taskRes.data) setTasks(taskRes.data);
    if (bankRes.data) setBankAccounts(bankRes.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`dashboard-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_transactions' }, () => {
        void fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, () => {
        void fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        void fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_tasks' }, () => {
        void fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_accounts' }, () => {
        void fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboardData, user]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthTx = transactions.filter(t => t.date?.startsWith(currentMonth));
  const monthIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const monthExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const monthProfit = monthIncome - monthExpense;
  const totalBankBalance = bankAccounts.reduce((s, a) => s + Number(a.current_balance), 0);

  const prevMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
  const prevMonthIncome = transactions.filter(t => t.date?.startsWith(prevMonth) && t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const prevMonthExpense = transactions.filter(t => t.date?.startsWith(prevMonth) && t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const incomeChange = prevMonthIncome > 0 ? ((monthIncome - prevMonthIncome) / prevMonthIncome * 100) : 0;
  const expenseChange = prevMonthExpense > 0 ? ((monthExpense - prevMonthExpense) / prevMonthExpense * 100) : 0;

  const today = new Date().toISOString().slice(0, 10);
  const overdueItems = transactions.filter(t => t.status === 'pending' && t.due_date && t.due_date < today);
  const pendingReceivable = transactions.filter(t => t.type === 'income' && (t.status === 'pending' || t.status === 'overdue')).reduce((s, t) => s + Number(t.amount), 0);
  const pendingPayable = transactions.filter(t => t.type === 'expense' && (t.status === 'pending' || t.status === 'overdue')).reduce((s, t) => s + Number(t.amount), 0);

  const openBudgets = budgets.filter(b => b.status === 'draft' || b.status === 'pending').length;
  const approvedBudgets = budgets.filter(b => b.status === 'approved').length;
  const activeTasks = tasks.filter(t => t.stage !== 'entregue');

  // Timeline - last 6 months with accumulated
  const timelineData = useMemo(() => {
    const months: Record<string, { month: string; receita: number; despesa: number; lucro: number; acumulado: number }> = {};
    let accumulated = 0;
    transactions.forEach(t => {
      const m = t.date?.slice(0, 7);
      if (!m) return;
      if (!months[m]) months[m] = { month: m, receita: 0, despesa: 0, lucro: 0, acumulado: 0 };
      if (t.type === 'income') months[m].receita += Number(t.amount);
      else months[m].despesa += Number(t.amount);
    });
    const sorted = Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
    sorted.forEach(m => {
      m.lucro = m.receita - m.despesa;
      accumulated += m.lucro;
      m.acumulado = accumulated;
      m.month = new Date(m.month + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    });
    return sorted;
  }, [transactions]);

  // Expense by category pie
  const expenseByCat = useMemo(() => {
    const counts: Record<string, number> = {};
    monthTx.filter(t => t.type === 'expense').forEach(t => {
      const cat = categoryLabels[t.category] || t.category;
      counts[cat] = (counts[cat] || 0) + Number(t.amount);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [transactions, currentMonth]);

  // Budget status pie
  const budgetStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    budgets.forEach(b => { counts[b.status] = (counts[b.status] || 0) + 1; });
    return [
      { name: 'Aprovados', value: counts.approved || 0 },
      { name: 'Pendentes', value: counts.pending || 0 },
      { name: 'Rejeitados', value: counts.rejected || 0 },
      { name: 'Rascunhos', value: counts.draft || 0 },
    ].filter(d => d.value > 0);
  }, [budgets]);

  // Client profit ranking
  const topClients = useMemo(() => {
    const map: Record<string, { name: string; income: number; expense: number }> = {};
    transactions.forEach(t => {
      if (!t.client_id) return;
      const client = clients.find(c => c.id === t.client_id);
      if (!client) return;
      if (!map[t.client_id]) map[t.client_id] = { name: client.name, income: 0, expense: 0 };
      if (t.type === 'income') map[t.client_id].income += Number(t.amount);
      else map[t.client_id].expense += Number(t.amount);
    });
    return Object.values(map).map(c => ({ ...c, profit: c.income - c.expense, margin: c.income > 0 ? ((c.income - c.expense) / c.income * 100) : 0 }))
      .sort((a, b) => b.profit - a.profit).slice(0, 5);
  }, [transactions, clients]);

  // Upcoming due dates
  const upcoming = useMemo(() => {
    const in7days = new Date(); in7days.setDate(in7days.getDate() + 7);
    const fut = in7days.toISOString().slice(0, 10);
    return transactions
      .filter(t => t.status === 'pending' && t.due_date && t.due_date >= today && t.due_date <= fut)
      .sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 5);
  }, [transactions, today]);

  const margin = monthIncome > 0 ? (monthProfit / monthIncome * 100) : 0;

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
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold font-display">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral do seu negócio em tempo real</p>
      </div>

      {/* Overdue Alert */}
      {overdueItems.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-destructive">{overdueItems.length} conta(s) vencida(s)!</p>
                <p className="text-xs text-muted-foreground">Total: {formatBRL(overdueItems.reduce((s: number, t: any) => s + Number(t.amount), 0))}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-destructive" />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Main KPIs Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          {
            title: 'Faturamento', value: formatBRL(monthIncome),
            change: incomeChange, icon: TrendingUp,
            sub: 'vs mês anterior', color: 'text-success',
          },
          {
            title: 'Despesas', value: formatBRL(monthExpense),
            change: expenseChange, icon: TrendingDown,
            sub: 'vs mês anterior', color: 'text-destructive', invertPositive: true,
          },
          {
            title: 'Lucro Líquido', value: formatBRL(monthProfit),
            change: margin, icon: Target,
            sub: `${margin.toFixed(1)}% margem`, color: monthProfit >= 0 ? 'text-success' : 'text-destructive',
            noCompare: true,
          },
          {
            title: 'Saldo em Contas', value: formatBRL(totalBankBalance),
            change: 0, icon: Wallet,
            sub: `${bankAccounts.length} conta(s)`, color: totalBankBalance >= 0 ? 'text-foreground' : 'text-destructive',
            noCompare: true,
          },
        ].map((kpi) => (
          <motion.div key={kpi.title} variants={itemVariants}>
            <Card className="relative overflow-hidden group hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">{kpi.title}</p>
                    <p className={`text-lg sm:text-2xl font-bold font-display ${kpi.color}`}>{kpi.value}</p>
                  </div>
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-accent shrink-0">
                    <kpi.icon className="h-4 w-4 sm:h-5 sm:w-5 text-accent-foreground" />
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[10px] sm:text-xs">
                  {!kpi.noCompare && (
                    <>
                      {(kpi.invertPositive ? kpi.change <= 0 : kpi.change >= 0) ? (
                        <ArrowUpRight className="h-3 w-3 text-success" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-destructive" />
                      )}
                      <span className={(kpi.invertPositive ? kpi.change <= 0 : kpi.change >= 0) ? 'text-success font-medium' : 'text-destructive font-medium'}>
                        {kpi.change >= 0 ? '+' : ''}{kpi.change.toFixed(1)}%
                      </span>
                    </>
                  )}
                  <span className="text-muted-foreground">{kpi.sub}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          { label: 'A Receber', value: formatBRL(pendingReceivable), icon: ArrowUpRight, color: 'text-success' },
          { label: 'A Pagar', value: formatBRL(pendingPayable), icon: ArrowDownRight, color: 'text-destructive' },
          { label: 'Orçamentos Abertos', value: String(openBudgets), icon: FileText, color: 'text-warning' },
          { label: 'Produção Ativa', value: String(activeTasks.length), icon: Factory, color: 'text-info' },
        ].map(stat => (
          <motion.div key={stat.label} variants={itemVariants}>
            <Card className="border-dashed">
              <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                <stat.icon className={`h-4 w-4 ${stat.color} shrink-0`} />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                  <p className={`text-sm sm:text-base font-bold font-display ${stat.color}`}>{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline Chart */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base font-display flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" /> Timeline Financeira
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">Últimos 6 meses</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {timelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={timelineData} barGap={4}>
                    <defs>
                      <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0.2} />
                      </linearGradient>
                      <linearGradient id="gradDespesa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.2} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={11} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatBRL(value)} contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(220, 16%, 90%)', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar yAxisId="left" dataKey="receita" fill="url(#gradReceita)" radius={[6, 6, 0, 0]} name="Receita" />
                    <Bar yAxisId="left" dataKey="despesa" fill="url(#gradDespesa)" radius={[6, 6, 0, 0]} name="Despesa" />
                    <Line yAxisId="right" type="monotone" dataKey="acumulado" stroke="hsl(28, 85%, 56%)" strokeWidth={2.5} dot={{ r: 4, fill: 'hsl(28, 85%, 56%)' }} name="Acumulado" />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                  <p className="text-sm">Registre lançamentos para ver a timeline.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Expense Breakdown */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base font-display">Despesas por Categoria</CardTitle>
              <p className="text-[10px] text-muted-foreground">Mês atual</p>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              {expenseByCat.length > 0 ? (
                <>
                  <div className="relative">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie data={expenseByCat} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                          {expenseByCat.map((_, i) => <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatBRL(value)} contentStyle={{ borderRadius: '0.5rem', fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold font-display">{formatBRL(monthExpense)}</span>
                      <span className="text-[10px] text-muted-foreground">Total</span>
                    </div>
                  </div>
                  <div className="w-full mt-3 space-y-1.5 max-h-[140px] overflow-y-auto">
                    {expenseByCat.map((d, i) => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }} />
                          <span className="truncate">{d.name}</span>
                        </div>
                        <span className="font-medium shrink-0 ml-2">{formatBRL(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-12">Nenhuma despesa neste mês.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Middle Row: Client Ranking + Budget Status + Upcoming */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Clients */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base font-display flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Top Clientes (Lucro)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topClients.length > 0 ? (
                <div className="space-y-3">
                  {topClients.map((c, i) => (
                    <div key={c.name} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
                          <span className="text-sm font-medium truncate">{c.name}</span>
                        </div>
                        <span className={`text-xs font-bold ${c.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {formatBRL(c.profit)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={Math.max(0, Math.min(100, c.margin))} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground w-10 text-right">{c.margin.toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Vincule lançamentos a clientes.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Budget Status */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base font-display flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Orçamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {budgetStatusData.length > 0 ? (
                <>
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <ResponsiveContainer width={160} height={160}>
                        <PieChart>
                          <Pie data={budgetStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} paddingAngle={4} dataKey="value">
                            {budgetStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-bold font-display">{budgets.length}</span>
                        <span className="text-[10px] text-muted-foreground">Total</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 mt-2">
                    {budgetStatusData.map((d, i) => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span>{d.name}</span>
                        </div>
                        <span className="font-medium">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum orçamento.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base font-display flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" /> Próximos Vencimentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length > 0 ? (
                <div className="space-y-2.5">
                  {upcoming.map(tx => {
                    const clientName = tx.client_id ? clients.find((c: any) => c.id === tx.client_id)?.name : null;
                    return (
                      <div key={tx.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{tx.description}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {clientName && `${clientName} • `}
                            {new Date(tx.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <span className={`text-xs font-bold shrink-0 ml-2 ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                          {formatBRL(Number(tx.amount))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mb-2 opacity-30" />
                  <p className="text-sm">Nenhum vencimento próximo</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row: Recent Budgets + Production */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base font-display">Orçamentos Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {budgets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum orçamento ainda.</p>
                ) : budgets.slice(0, 5).map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{b.project_name || b.clients?.name || b.code}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(b.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-sm font-semibold">{formatBRL(b.final_price)}</span>
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${statusMap[b.status]?.className || ''}`}>
                        {statusMap[b.status]?.label || b.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm sm:text-base font-display flex items-center gap-2">
                <Factory className="h-4 w-4 text-primary" /> Produção em Andamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa em andamento.</p>
                ) : activeTasks.slice(0, 4).map((t: any) => {
                  const progress = ((stageMap[t.stage] || 0) / 4) * 100;
                  return (
                    <div key={t.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.project_name} — {t.client_name}</p>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Factory className="h-3 w-3" />
                            <span>{stageLabels[t.stage] || t.stage}</span>
                            {t.due_date && (
                              <>
                                <span>•</span>
                                <Calendar className="h-3 w-3" />
                                <span>{new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0 ml-2">{progress.toFixed(0)}%</Badge>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full gradient-primary transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
