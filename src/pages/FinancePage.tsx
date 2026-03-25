import { motion } from 'framer-motion';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const cashFlowData = [
  { month: 'Jan', entrada: 18500, saida: 12000 },
  { month: 'Fev', entrada: 22000, saida: 14500 },
  { month: 'Mar', entrada: 19800, saida: 11200 },
  { month: 'Abr', entrada: 28000, saida: 16800 },
  { month: 'Mai', entrada: 31500, saida: 18900 },
  { month: 'Jun', entrada: 26000, saida: 15600 },
];

const transactions = [
  { id: 1, desc: 'Pagamento Cozinha - Maria Silva', type: 'income', amount: 4480, date: '22/03', status: 'confirmed' },
  { id: 2, desc: 'Compra MDF Eucatex', type: 'expense', amount: 2300, date: '21/03', status: 'paid' },
  { id: 3, desc: 'Parcela 2/3 - João Santos', type: 'income', amount: 2600, date: '20/03', status: 'pending' },
  { id: 4, desc: 'Ferragens Hafele', type: 'expense', amount: 890, date: '19/03', status: 'paid' },
  { id: 5, desc: 'Pagamento Painel TV - Ana Costa', type: 'income', amount: 2835, date: '18/03', status: 'confirmed' },
  { id: 6, desc: 'Mão de Obra Terceirizada', type: 'expense', amount: 1500, date: '17/03', status: 'pending' },
  { id: 7, desc: 'Parcela 1/4 - Carla Oliveira', type: 'income', amount: 1400, date: '16/03', status: 'overdue' },
];

const finKpis = [
  { title: 'Receita Total', value: 'R$ 145.800', change: '+15.2%', positive: true, icon: TrendingUp },
  { title: 'Despesas Totais', value: 'R$ 88.900', change: '+8.7%', positive: false, icon: TrendingDown },
  { title: 'Lucro Líquido', value: 'R$ 56.900', change: '+24.1%', positive: true, icon: DollarSign },
  { title: 'A Receber', value: 'R$ 12.400', change: '4 parcelas', positive: true, icon: Calendar },
];

const statusTxConfig: Record<string, { label: string; className: string }> = {
  confirmed: { label: 'Confirmado', className: 'bg-success/10 text-success' },
  paid: { label: 'Pago', className: 'bg-info/10 text-info' },
  pending: { label: 'Pendente', className: 'bg-warning/10 text-warning' },
  overdue: { label: 'Vencido', className: 'bg-destructive/10 text-destructive' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export default function FinancePage() {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Financeiro</h1>
        <p className="text-muted-foreground text-sm mt-1">Controle de receitas e despesas</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {finKpis.map((kpi) => (
          <motion.div key={kpi.title} variants={itemVariants}>
            <Card>
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
                <div className="mt-3 flex items-center gap-1 text-xs font-medium">
                  {kpi.positive ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <span className={kpi.positive ? 'text-success' : 'text-destructive'}>{kpi.change}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Cash flow chart */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Fluxo de Caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cashFlowData}>
                <defs>
                  <linearGradient id="colorEntrada" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSaida" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={12} />
                <YAxis axisLine={false} tickLine={false} fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                  contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(220, 16%, 90%)' }}
                />
                <Area type="monotone" dataKey="entrada" stroke="hsl(152, 60%, 42%)" fill="url(#colorEntrada)" strokeWidth={2} />
                <Area type="monotone" dataKey="saida" stroke="hsl(0, 72%, 51%)" fill="url(#colorSaida)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Transactions */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-display">Movimentações Recentes</CardTitle>
            <Button variant="outline" size="sm"><Filter className="h-3.5 w-3.5 mr-1" /> Filtrar</Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {tx.type === 'income' ? (
                            <ArrowUpRight className="h-4 w-4 text-success shrink-0" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-destructive shrink-0" />
                          )}
                          <span className="text-sm">{tx.desc}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{tx.date}</td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                        {tx.type === 'income' ? '+' : '-'} R$ {tx.amount.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusTxConfig[tx.status].className}`}>
                          {statusTxConfig[tx.status].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
