import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, Users, FileText, ArrowUpRight, ArrowDownRight,
  Factory, AlertTriangle, Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatBRL } from '@/lib/format';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } };

const statusMap: Record<string, { label: string; className: string }> = {
  approved: { label: 'Aprovado', className: 'bg-success/10 text-success' },
  pending: { label: 'Pendente', className: 'bg-warning/10 text-warning' },
  draft: { label: 'Rascunho', className: 'bg-muted text-muted-foreground' },
  rejected: { label: 'Rejeitado', className: 'bg-destructive/10 text-destructive' },
};

const COLORS = ['hsl(152, 60%, 42%)', 'hsl(38, 92%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(220, 16%, 75%)'];

export default function DashboardPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('financial_transactions').select('*').order('date', { ascending: false }),
      supabase.from('budgets').select('*, clients(name)').order('created_at', { ascending: false }).limit(10),
      supabase.from('clients').select('id, name'),
      supabase.from('production_tasks').select('*'),
    ]).then(([txRes, budRes, cliRes, taskRes]) => {
      if (txRes.data) setTransactions(txRes.data);
      if (budRes.data) setBudgets(budRes.data);
      if (cliRes.data) setClients(cliRes.data);
      if (taskRes.data) setTasks(taskRes.data);
      setLoading(false);
    });
  }, [user]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthTx = transactions.filter(t => t.date?.startsWith(currentMonth));
  const monthIncome = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const monthExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const monthProfit = monthIncome - monthExpense;
  const openBudgets = budgets.filter(b => b.status === 'draft' || b.status === 'pending').length;

  // Previous month comparison
  const prevMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
  const prevMonthIncome = transactions.filter(t => t.date?.startsWith(prevMonth) && t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const incomeChange = prevMonthIncome > 0 ? ((monthIncome - prevMonthIncome) / prevMonthIncome * 100).toFixed(1) : '0';

  const today = new Date().toISOString().slice(0, 10);
  const overdueItems = transactions.filter(t => t.status === 'pending' && t.due_date && t.due_date < today);

  // Chart data - last 6 months
  const chartData = useMemo(() => {
    const months: Record<string, { month: string; receita: number; despesa: number }> = {};
    transactions.forEach(t => {
      const m = t.date?.slice(0, 7);
      if (!m) return;
      if (!months[m]) months[m] = { month: m, receita: 0, despesa: 0 };
      if (t.type === 'income') months[m].receita += Number(t.amount);
      else months[m].despesa += Number(t.amount);
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).slice(-6).map(m => ({
      ...m, month: new Date(m.month + '-01').toLocaleDateString('pt-BR', { month: 'short' }),
    }));
  }, [transactions]);

  // Budget status pie
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    budgets.forEach(b => { counts[b.status] = (counts[b.status] || 0) + 1; });
    return [
      { name: 'Aprovados', value: counts.approved || 0 },
      { name: 'Pendentes', value: counts.pending || 0 },
      { name: 'Rejeitados', value: counts.rejected || 0 },
      { name: 'Rascunhos', value: counts.draft || 0 },
    ].filter(d => d.value > 0);
  }, [budgets]);

  const stageMap: Record<string, number> = { corte: 0, borda: 1, usinagem: 2, montagem: 3, entregue: 4 };
  const stageLabels: Record<string, string> = { corte: 'Corte', borda: 'Borda', usinagem: 'Usinagem', montagem: 'Montagem', entregue: 'Entregue' };

  const kpis = [
    { title: 'Faturamento Mensal', value: formatBRL(monthIncome), change: `${Number(incomeChange) >= 0 ? '+' : ''}${incomeChange}%`, positive: Number(incomeChange) >= 0, icon: DollarSign },
    { title: 'Lucro Líquido', value: formatBRL(monthProfit), change: monthIncome > 0 ? `${(monthProfit / monthIncome * 100).toFixed(1)}% margem` : '—', positive: monthProfit >= 0, icon: TrendingUp },
    { title: 'Clientes Ativos', value: String(clients.length), change: '', positive: true, icon: Users },
    { title: 'Orçamentos Abertos', value: String(openBudgets), change: '', positive: true, icon: FileText },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do seu negócio</p>
      </div>

      {/* Overdue Alert */}
      {overdueItems.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-semibold text-destructive">{overdueItems.length} conta(s) vencida(s)!</p>
                <p className="text-xs text-muted-foreground">Total: {formatBRL(overdueItems.reduce((s: number, t: any) => s + Number(t.amount), 0))}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <motion.div key={kpi.title} variants={itemVariants}>
            <Card className="relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.title}</p>
                    <p className="text-2xl font-bold font-display">{kpi.value}</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
                    <kpi.icon className="h-5 w-5 text-accent-foreground" />
                  </div>
                </div>
                {kpi.change && (
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium">
                    {kpi.positive ? <ArrowUpRight className="h-3.5 w-3.5 text-success" /> : <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />}
                    <span className={kpi.positive ? 'text-success' : 'text-destructive'}>{kpi.change}</span>
                    <span className="text-muted-foreground">vs mês anterior</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="text-base font-display">Receita vs Despesa</CardTitle></CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} />
                    <YAxis axisLine={false} tickLine={false} fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatBRL(value)} contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(220, 16%, 90%)' }} />
                    <Bar dataKey="receita" fill="hsl(28, 85%, 56%)" radius={[6, 6, 0, 0]} name="Receita" />
                    <Bar dataKey="despesa" fill="hsl(220, 16%, 85%)" radius={[6, 6, 0, 0]} name="Despesa" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">Registre lançamentos para ver o gráfico.</p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader><CardTitle className="text-base font-display">Status dos Orçamentos</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-center">
              {statusData.length > 0 ? (
                <div className="relative">
                  <ResponsiveContainer width={200} height={200}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                        {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold font-display">{budgets.length}</span>
                    <span className="text-xs text-muted-foreground">Total</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8">Nenhum orçamento.</p>
              )}
            </CardContent>
            {statusData.length > 0 && (
              <div className="px-6 pb-5 space-y-2">
                {statusData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span>{d.name}</span>
                    </div>
                    <span className="font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Recent budgets + production */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader><CardTitle className="text-base font-display">Orçamentos Recentes</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {budgets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum orçamento ainda.</p>
                ) : budgets.slice(0, 5).map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{b.project_name || b.clients?.name || b.code}</p>
                      <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{formatBRL(b.final_price)}</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusMap[b.status]?.className || ''}`}>
                        {statusMap[b.status]?.label || b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader><CardTitle className="text-base font-display">Produção em Andamento</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tasks.filter(t => t.stage !== 'entregue').length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa em andamento.</p>
                ) : tasks.filter(t => t.stage !== 'entregue').slice(0, 4).map((t: any) => {
                  const progress = ((stageMap[t.stage] || 0) / 4) * 100;
                  return (
                    <div key={t.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{t.project_name} - {t.client_name}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Factory className="h-3 w-3" />
                            <span>{stageLabels[t.stage] || t.stage}</span>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-accent-foreground">{progress.toFixed(0)}%</span>
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
