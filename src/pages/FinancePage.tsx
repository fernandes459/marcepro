import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Plus, Filter, Pencil, Trash2, Search, Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  type: string;
  category: string;
  subcategory: string | null;
  description: string;
  amount: number;
  date: string;
  due_date: string | null;
  paid_date: string | null;
  status: string;
  is_fixed: boolean;
  payment_method: string | null;
  recurrence: string;
  notes: string | null;
}

const expenseCategories = [
  { value: 'material', label: 'Material / Insumos' },
  { value: 'labor', label: 'Mão de Obra' },
  { value: 'rent', label: 'Aluguel' },
  { value: 'salary', label: 'Salários / Funcionários' },
  { value: 'fuel', label: 'Combustível' },
  { value: 'food', label: 'Alimentação' },
  { value: 'tools', label: 'Ferramentas / Equipamentos' },
  { value: 'maintenance', label: 'Manutenção' },
  { value: 'taxes', label: 'Impostos / Taxas' },
  { value: 'utilities', label: 'Água / Luz / Internet' },
  { value: 'transport', label: 'Transporte / Frete' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other_expense', label: 'Outras Despesas' },
];

const incomeCategories = [
  { value: 'project', label: 'Projeto / Orçamento' },
  { value: 'installment', label: 'Parcela de Projeto' },
  { value: 'service', label: 'Serviço Avulso' },
  { value: 'other_income', label: 'Outras Receitas' },
];

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-warning/10 text-warning' },
  paid: { label: 'Pago', className: 'bg-success/10 text-success' },
  overdue: { label: 'Vencido', className: 'bg-destructive/10 text-destructive' },
  cancelled: { label: 'Cancelado', className: 'bg-muted text-muted-foreground' },
};

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } };

export default function FinancePage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const emptyForm = {
    type: 'expense' as string, category: '', description: '', amount: '',
    date: new Date().toISOString().slice(0, 10), due_date: '', status: 'pending',
    is_fixed: false, payment_method: '', recurrence: 'none', notes: '',
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { if (user) fetchTransactions(); }, [user]);

  async function fetchTransactions() {
    const { data } = await supabase.from('financial_transactions').select('*').order('date', { ascending: false });
    if (data) setTransactions(data as Transaction[]);
    setLoading(false);
  }

  async function handleSave() {
    if (!form.category || !form.description || !form.amount) { toast.error('Preencha os campos obrigatórios'); return; }
    const { error } = await supabase.from('financial_transactions').insert({
      user_id: user!.id,
      type: form.type,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      date: form.date,
      due_date: form.due_date || null,
      status: form.status,
      is_fixed: form.is_fixed,
      payment_method: form.payment_method || null,
      recurrence: form.recurrence,
      notes: form.notes || null,
    });
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Lançamento criado!');
    setDialogOpen(false);
    setForm(emptyForm);
    fetchTransactions();
  }

  async function markPaid(id: string) {
    await supabase.from('financial_transactions').update({ status: 'paid', paid_date: new Date().toISOString().slice(0, 10) }).eq('id', id);
    fetchTransactions();
    toast.success('Marcado como pago');
  }

  async function deleteTransaction(id: string) {
    await supabase.from('financial_transactions').delete().eq('id', id);
    setTransactions(prev => prev.filter(t => t.id !== id));
    toast.success('Lançamento removido');
  }

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, filterType, filterStatus, search]);

  // KPIs
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const profit = totalIncome - totalExpense;
  const pendingReceivable = transactions.filter(t => t.type === 'income' && t.status === 'pending').reduce((s, t) => s + Number(t.amount), 0);
  const pendingPayable = transactions.filter(t => t.type === 'expense' && t.status === 'pending').reduce((s, t) => s + Number(t.amount), 0);
  const overdueCount = transactions.filter(t => t.status === 'overdue').length;

  // Chart data by month
  const chartData = useMemo(() => {
    const months: Record<string, { month: string; entrada: number; saida: number }> = {};
    transactions.forEach(t => {
      const m = t.date.slice(0, 7);
      if (!months[m]) months[m] = { month: m, entrada: 0, saida: 0 };
      if (t.type === 'income') months[m].entrada += Number(t.amount);
      else months[m].saida += Number(t.amount);
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).slice(-6).map(m => ({
      ...m, month: new Date(m.month + '-01').toLocaleDateString('pt-BR', { month: 'short' }),
    }));
  }, [transactions]);

  // DRE
  const dreData = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthTx = transactions.filter(t => t.date.startsWith(currentMonth));
    const revenue = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const fixedExp = monthTx.filter(t => t.type === 'expense' && t.is_fixed).reduce((s, t) => s + Number(t.amount), 0);
    const varExp = monthTx.filter(t => t.type === 'expense' && !t.is_fixed).reduce((s, t) => s + Number(t.amount), 0);
    return { revenue, fixedExp, varExp, totalExp: fixedExp + varExp, profit: revenue - fixedExp - varExp };
  }, [transactions]);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const kpis = [
    { title: 'Receita Total', value: fmt(totalIncome), icon: TrendingUp, positive: true },
    { title: 'Despesas Totais', value: fmt(totalExpense), icon: TrendingDown, positive: false },
    { title: 'Lucro Líquido', value: fmt(profit), icon: DollarSign, positive: profit >= 0 },
    { title: 'A Receber', value: fmt(pendingReceivable), icon: Calendar, positive: true },
  ];

  const categories = form.type === 'income' ? incomeCategories : expenseCategories;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-1">Controle completo de receitas e despesas</p>
        </div>
        <Button className="gradient-primary shadow-primary border-0" onClick={() => { setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo Lançamento
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
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
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="transactions">Lançamentos</TabsTrigger>
          <TabsTrigger value="receivable">A Receber</TabsTrigger>
          <TabsTrigger value="payable">A Pagar</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader><CardTitle className="text-base font-display">Fluxo de Caixa</CardTitle></CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
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
                      <Tooltip formatter={(value: number) => fmt(value)} contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(220, 16%, 90%)' }} />
                      <Area type="monotone" dataKey="entrada" stroke="hsl(152, 60%, 42%)" fill="url(#colorEntrada)" strokeWidth={2} />
                      <Area type="monotone" dataKey="saida" stroke="hsl(0, 72%, 51%)" fill="url(#colorSaida)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">Nenhum lançamento registrado ainda.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Transactions */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <CardTitle className="text-base font-display">Todos os Lançamentos</CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8 w-48" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="income">Receitas</SelectItem>
                    <SelectItem value="expense">Despesas</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="overdue">Vencido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descrição</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categoria</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado</td></tr>
                    ) : filtered.map((tx) => (
                      <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {tx.type === 'income' ? <ArrowUpRight className="h-4 w-4 text-success shrink-0" /> : <ArrowDownRight className="h-4 w-4 text-destructive shrink-0" />}
                            <div>
                              <span className="text-sm">{tx.description}</span>
                              {tx.is_fixed && <span className="ml-1.5 text-[10px] bg-accent text-accent-foreground rounded px-1.5 py-0.5">Fixa</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{tx.category}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(tx.date).toLocaleDateString('pt-BR')}</td>
                        <td className={`px-4 py-3 text-sm text-right font-semibold ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                          {tx.type === 'income' ? '+' : '-'} {fmt(Number(tx.amount))}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusConfig[tx.status]?.className ?? ''}`}>
                            {statusConfig[tx.status]?.label ?? tx.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {tx.status === 'pending' && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => markPaid(tx.id)}>Pagar</Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteTransaction(tx.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receivable */}
        <TabsContent value="receivable">
          <Card>
            <CardHeader><CardTitle className="text-base font-display">Contas a Receber — {fmt(pendingReceivable)}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Descrição</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Vencimento</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Valor</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-muted-foreground">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.filter(t => t.type === 'income' && (t.status === 'pending' || t.status === 'overdue')).map(tx => (
                      <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm">{tx.description}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{tx.due_date ? new Date(tx.due_date).toLocaleDateString('pt-BR') : '-'}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-success">{fmt(Number(tx.amount))}</td>
                        <td className="px-4 py-3 text-center"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusConfig[tx.status]?.className}`}>{statusConfig[tx.status]?.label}</span></td>
                        <td className="px-4 py-3 text-center"><Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => markPaid(tx.id)}>Receber</Button></td>
                      </tr>
                    ))}
                    {transactions.filter(t => t.type === 'income' && (t.status === 'pending' || t.status === 'overdue')).length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma conta a receber</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payable */}
        <TabsContent value="payable">
          <Card>
            <CardHeader><CardTitle className="text-base font-display">Contas a Pagar — {fmt(pendingPayable)}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Descrição</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Categoria</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Vencimento</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Valor</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-muted-foreground">Tipo</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-muted-foreground">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.filter(t => t.type === 'expense' && (t.status === 'pending' || t.status === 'overdue')).map(tx => (
                      <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 text-sm">{tx.description}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{tx.category}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{tx.due_date ? new Date(tx.due_date).toLocaleDateString('pt-BR') : '-'}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-destructive">{fmt(Number(tx.amount))}</td>
                        <td className="px-4 py-3 text-center">{tx.is_fixed ? <span className="text-[10px] bg-accent text-accent-foreground rounded px-1.5 py-0.5">Fixa</span> : <span className="text-[10px] bg-muted text-muted-foreground rounded px-1.5 py-0.5">Variável</span>}</td>
                        <td className="px-4 py-3 text-center"><Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => markPaid(tx.id)}>Pagar</Button></td>
                      </tr>
                    ))}
                    {transactions.filter(t => t.type === 'expense' && (t.status === 'pending' || t.status === 'overdue')).length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma conta a pagar</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DRE */}
        <TabsContent value="dre">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader><CardTitle className="text-base font-display">DRE — Demonstrativo de Resultados ({new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-sm font-semibold">Receita Bruta</span>
                    <span className="text-sm font-bold text-success">{fmt(dreData.revenue)}</span>
                  </div>
                  <div className="flex justify-between py-2 pl-4">
                    <span className="text-sm text-muted-foreground">(-) Despesas Fixas</span>
                    <span className="text-sm text-destructive">{fmt(dreData.fixedExp)}</span>
                  </div>
                  <div className="flex justify-between py-2 pl-4">
                    <span className="text-sm text-muted-foreground">(-) Despesas Variáveis</span>
                    <span className="text-sm text-destructive">{fmt(dreData.varExp)}</span>
                  </div>
                  <div className="flex justify-between py-2 pl-4 border-b border-border">
                    <span className="text-sm font-medium">Total Despesas</span>
                    <span className="text-sm font-semibold text-destructive">{fmt(dreData.totalExp)}</span>
                  </div>
                  <div className="flex justify-between py-3 bg-accent/50 rounded-lg px-4 -mx-2">
                    <span className="text-sm font-bold">Resultado Líquido</span>
                    <span className={`text-lg font-bold ${dreData.profit >= 0 ? 'text-success' : 'text-destructive'}`}>{fmt(dreData.profit)}</span>
                  </div>
                  {dreData.revenue > 0 && (
                    <p className="text-xs text-muted-foreground text-center">Margem líquida: {((dreData.profit / dreData.revenue) * 100).toFixed(1)}%</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* New Transaction Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Novo Lançamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex gap-2">
              <Button variant={form.type === 'income' ? 'default' : 'outline'} className={form.type === 'income' ? 'flex-1 gradient-primary border-0' : 'flex-1'} onClick={() => setForm({ ...form, type: 'income', category: '' })}>
                <ArrowUpRight className="h-4 w-4 mr-1" /> Receita
              </Button>
              <Button variant={form.type === 'expense' ? 'default' : 'outline'} className={form.type === 'expense' ? 'flex-1 bg-destructive text-destructive-foreground border-0' : 'flex-1'} onClick={() => setForm({ ...form, type: 'expense', category: '' })}>
                <ArrowDownRight className="h-4 w-4 mr-1" /> Despesa
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ex: Pagamento MDF" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="credit">Cartão Crédito</SelectItem>
                    <SelectItem value="debit">Cartão Débito</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_fixed} onCheckedChange={v => setForm({ ...form, is_fixed: v })} />
                <Label className="text-sm">Despesa Fixa (recorrente)</Label>
              </div>
            </div>
            {form.is_fixed && (
              <div className="space-y-2">
                <Label>Recorrência</Label>
                <Select value={form.recurrence} onValueChange={v => setForm({ ...form, recurrence: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gradient-primary shadow-primary border-0" onClick={handleSave}>Salvar Lançamento</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
