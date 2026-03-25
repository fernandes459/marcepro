import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  Users,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Factory,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const revenueData = [
  { month: 'Jan', receita: 18500, despesa: 12000 },
  { month: 'Fev', receita: 22000, despesa: 14500 },
  { month: 'Mar', receita: 19800, despesa: 11200 },
  { month: 'Abr', receita: 28000, despesa: 16800 },
  { month: 'Mai', receita: 31500, despesa: 18900 },
  { month: 'Jun', receita: 26000, despesa: 15600 },
];

const statusData = [
  { name: 'Aprovados', value: 12, color: 'hsl(152, 60%, 42%)' },
  { name: 'Pendentes', value: 8, color: 'hsl(38, 92%, 50%)' },
  { name: 'Rejeitados', value: 3, color: 'hsl(0, 72%, 51%)' },
];

const kpis = [
  {
    title: 'Faturamento Mensal',
    value: 'R$ 31.500',
    change: '+12.5%',
    positive: true,
    icon: DollarSign,
  },
  {
    title: 'Lucro Líquido',
    value: 'R$ 12.600',
    change: '+8.3%',
    positive: true,
    icon: TrendingUp,
  },
  {
    title: 'Clientes Ativos',
    value: '47',
    change: '+3',
    positive: true,
    icon: Users,
  },
  {
    title: 'Orçamentos Abertos',
    value: '8',
    change: '-2',
    positive: false,
    icon: FileText,
  },
];

const recentBudgets = [
  { client: 'Maria Silva', value: 'R$ 4.500', status: 'approved', date: '22/03' },
  { client: 'João Santos', value: 'R$ 7.800', status: 'pending', date: '21/03' },
  { client: 'Ana Costa', value: 'R$ 3.200', status: 'pending', date: '20/03' },
  { client: 'Pedro Lima', value: 'R$ 12.000', status: 'rejected', date: '19/03' },
  { client: 'Carla Oliveira', value: 'R$ 5.600', status: 'approved', date: '18/03' },
];

const statusMap: Record<string, { label: string; className: string }> = {
  approved: { label: 'Aprovado', className: 'bg-success/10 text-success' },
  pending: { label: 'Pendente', className: 'bg-warning/10 text-warning' },
  rejected: { label: 'Rejeitado', className: 'bg-destructive/10 text-destructive' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do seu negócio</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <motion.div key={kpi.title} variants={itemVariants}>
            <Card className="relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {kpi.title}
                    </p>
                    <p className="text-2xl font-bold font-display">{kpi.value}</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
                    <kpi.icon className="h-5 w-5 text-accent-foreground" />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs font-medium">
                  {kpi.positive ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <span className={kpi.positive ? 'text-success' : 'text-destructive'}>
                    {kpi.change}
                  </span>
                  <span className="text-muted-foreground">vs mês anterior</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display">Receita vs Despesa</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip
                    formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                    contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(220, 16%, 90%)' }}
                  />
                  <Bar dataKey="receita" fill="hsl(28, 85%, 56%)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="despesa" fill="hsl(220, 16%, 85%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display">Status dos Orçamentos</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <div className="relative">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold font-display">23</span>
                  <span className="text-xs text-muted-foreground">Total</span>
                </div>
              </div>
            </CardContent>
            <div className="px-6 pb-5 space-y-2">
              {statusData.map((d) => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span>{d.name}</span>
                  </div>
                  <span className="font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Recent budgets + production */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display">Orçamentos Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentBudgets.map((b, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{b.client}</p>
                      <p className="text-xs text-muted-foreground">{b.date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{b.value}</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusMap[b.status].className}`}>
                        {statusMap[b.status].label}
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
            <CardHeader>
              <CardTitle className="text-base font-display">Produção em Andamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { project: 'Cozinha Planejada - Maria', phase: 'Usinagem', progress: 65 },
                  { project: 'Closet - João Santos', phase: 'Borda', progress: 40 },
                  { project: 'Painel TV - Ana Costa', phase: 'Montagem', progress: 85 },
                  { project: 'Rack Suspenso - Pedro', phase: 'Corte', progress: 20 },
                ].map((p, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{p.project}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Factory className="h-3 w-3" />
                          <span>{p.phase}</span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-accent-foreground">{p.progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full gradient-primary transition-all duration-500"
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
