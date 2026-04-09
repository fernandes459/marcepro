import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Plus, Search, Trash2, Building2, ArrowRightLeft, AlertTriangle, FileBarChart,
  Receipt, Wallet, PieChart as PieChartIcon, BarChart3, ChevronLeft,
  CreditCard, Clock, CheckCircle2, X, Pencil,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatBRL } from '@/lib/format';
import { CurrencyInput } from '@/components/CurrencyInput';
import { TransactionDialog } from '@/components/finance/TransactionDialog';

interface Transaction {
  id: string; type: string; category: string; subcategory: string | null;
  description: string; amount: number; date: string; due_date: string | null;
  paid_date: string | null; status: string; is_fixed: boolean;
  payment_method: string | null; recurrence: string; notes: string | null;
  client_id: string | null; budget_id: string | null;
  bank_account_id: string | null; order_number: string | null;
}

interface Client { id: string; name: string; }
interface BankAccount {
  id: string; name: string; bank_name: string | null; account_type: string;
  current_balance: number; color: string; is_main: boolean;
  agency: string | null; account_number: string | null; initial_balance: number;
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
const categoryLabels: Record<string, string> = {};
[...expenseCategories, ...incomeCategories].forEach(c => { categoryLabels[c.value] = c.label; });

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-warning/10 text-warning' },
  paid: { label: 'Pago', className: 'bg-success/10 text-success' },
  overdue: { label: 'Vencido', className: 'bg-destructive/10 text-destructive' },
  cancelled: { label: 'Cancelado', className: 'bg-muted text-muted-foreground' },
};

const EXPENSE_COLORS = ['hsl(28, 85%, 56%)', 'hsl(0, 72%, 51%)', 'hsl(38, 92%, 50%)', 'hsl(210, 80%, 52%)', 'hsl(152, 60%, 42%)', 'hsl(280, 60%, 50%)', 'hsl(220, 16%, 65%)'];

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } };

type Section = 'home' | 'lancamentos' | 'dre' | 'vencer' | 'recebidos' | 'relatorio' | 'contas';

export default function FinancePage() {
  const { user } = useAuth();
  const pageRef = useRef<HTMLDivElement>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('home');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [bankForm, setBankForm] = useState({ name: '', bank_name: '', account_type: 'corrente', agency: '', account_number: '', initial_balance: 0, color: '#3B82F6' });
  const [transferForm, setTransferForm] = useState({ from_account_id: '', to_account_id: '', amount: 0, description: '', date: new Date().toISOString().slice(0, 10) });
  
  // Edit transaction state - uses full TransactionDialog
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;

    const [txRes, clientsRes, banksRes] = await Promise.all([
      supabase.from('financial_transactions').select('*').order('date', { ascending: false }),
      supabase.from('clients').select('id, name').order('name'),
      supabase.from('bank_accounts').select('*').order('is_main', { ascending: false }),
    ]);

    if (txRes.data) setTransactions(txRes.data as Transaction[]);
    if (clientsRes.data) setClients(clientsRes.data);
    if (banksRes.data) setBankAccounts(banksRes.data as BankAccount[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`finance-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_transactions' }, () => {
        void fetchAll();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_accounts' }, () => {
        void fetchAll();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        void fetchAll();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_transfers' }, () => {
        void fetchAll();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll, user]);

  useEffect(() => {
    const container = pageRef.current?.closest('main');
    if (container instanceof HTMLElement) {
      container.scrollTo({ top: 0 });
    }
  }, [activeSection]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    transactions.forEach(t => {
      if (t.status === 'pending' && t.due_date && t.due_date < today) {
        supabase.from('financial_transactions').update({ status: 'overdue' }).eq('id', t.id).then(() => {});
      }
    });
  }, [transactions]);

  async function handleSaveBank() {
    if (!bankForm.name) { toast.error('Nome da conta é obrigatório'); return; }
    const { error } = await supabase.from('bank_accounts').insert({
      user_id: user!.id, name: bankForm.name, bank_name: bankForm.bank_name || null,
      account_type: bankForm.account_type, agency: bankForm.agency || null,
      account_number: bankForm.account_number || null, initial_balance: bankForm.initial_balance,
      current_balance: bankForm.initial_balance, color: bankForm.color,
      is_main: bankAccounts.length === 0,
    } as any);
    if (error) { toast.error('Erro ao salvar conta'); return; }
    toast.success('Conta cadastrada!');
    setBankDialogOpen(false);
    setBankForm({ name: '', bank_name: '', account_type: 'corrente', agency: '', account_number: '', initial_balance: 0, color: '#3B82F6' });
    fetchAll();
  }

  async function handleTransfer() {
    if (!transferForm.from_account_id || !transferForm.to_account_id || !transferForm.amount) { toast.error('Preencha todos os campos'); return; }
    if (transferForm.from_account_id === transferForm.to_account_id) { toast.error('Selecione contas diferentes'); return; }
    const fromAcc = bankAccounts.find(a => a.id === transferForm.from_account_id);
    const toAcc = bankAccounts.find(a => a.id === transferForm.to_account_id);
    if (!fromAcc || !toAcc) return;
    const { error } = await supabase.from('bank_transfers').insert({
      user_id: user!.id, from_account_id: transferForm.from_account_id,
      to_account_id: transferForm.to_account_id, amount: transferForm.amount,
      description: transferForm.description || `Transferência ${fromAcc.name} → ${toAcc.name}`,
      date: transferForm.date,
    } as any);
    if (error) { toast.error('Erro na transferência'); return; }
    await Promise.all([
      supabase.from('bank_accounts').update({ current_balance: fromAcc.current_balance - transferForm.amount } as any).eq('id', fromAcc.id),
      supabase.from('bank_accounts').update({ current_balance: toAcc.current_balance + transferForm.amount } as any).eq('id', toAcc.id),
    ]);
    toast.success('Transferência realizada!');
    setTransferDialogOpen(false);
    setTransferForm({ from_account_id: '', to_account_id: '', amount: 0, description: '', date: new Date().toISOString().slice(0, 10) });
    fetchAll();
  }

  async function markPaid(id: string) {
    const tx = transactions.find(t => t.id === id);
    await supabase.from('financial_transactions').update({ status: 'paid', paid_date: new Date().toISOString().slice(0, 10) } as any).eq('id', id);
    // Update bank balance when marking as paid
    if (tx && tx.bank_account_id) {
      const acc = bankAccounts.find(a => a.id === tx.bank_account_id);
      if (acc) {
        const newBalance = tx.type === 'income'
          ? acc.current_balance + Number(tx.amount)
          : acc.current_balance - Number(tx.amount);
        await supabase.from('bank_accounts').update({ current_balance: newBalance } as any).eq('id', acc.id);
      }
    }
    toast.success('Marcado como pago');
    fetchAll();
  }

  async function deleteTransaction(id: string) {
    const tx = transactions.find(t => t.id === id);
    if (tx && tx.status === 'paid' && tx.bank_account_id) {
      const acc = bankAccounts.find(a => a.id === tx.bank_account_id);
      if (acc) {
        const adjustment = tx.type === 'income'
          ? acc.current_balance - Number(tx.amount)
          : acc.current_balance + Number(tx.amount);
        await supabase.from('bank_accounts').update({ current_balance: adjustment } as any).eq('id', acc.id);
      }
    }
    await supabase.from('financial_transactions').delete().eq('id', id);
    toast.success('Lançamento removido');
    fetchAll();
  }

  async function deleteBank(id: string) {
    await supabase.from('bank_accounts').delete().eq('id', id);
    fetchAll(); toast.success('Conta removida');
  }

  function openEditTransaction(tx: Transaction) {
    setEditingTransaction(tx);
    setDialogOpen(true);
  }

  // Computed
  const today = new Date().toISOString().slice(0, 10);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const profit = totalIncome - totalExpense;
  const totalBankBalance = bankAccounts.reduce((s, a) => s + Number(a.current_balance), 0);
  const pendingReceivable = transactions.filter(t => t.type === 'income' && (t.status === 'pending' || t.status === 'overdue')).reduce((s, t) => s + Number(t.amount), 0);
  const pendingPayable = transactions.filter(t => t.type === 'expense' && (t.status === 'pending' || t.status === 'overdue')).reduce((s, t) => s + Number(t.amount), 0);
  const overdueItems = transactions.filter(t => (t.status === 'overdue') || (t.status === 'pending' && t.due_date && t.due_date < today));
  const paidIncome = transactions.filter(t => t.type === 'income' && t.status === 'paid').reduce((s, t) => s + Number(t.amount), 0);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterClient !== 'all' && t.client_id !== filterClient) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [transactions, filterType, filterClient, search]);

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

  const clientProfitData = useMemo(() => {
    const map: Record<string, { name: string; income: number; material: number; fuel: number; food: number; transport: number; other: number }> = {};
    transactions.forEach(t => {
      if (!t.client_id) return;
      const client = clients.find(c => c.id === t.client_id);
      if (!client) return;
      if (!map[t.client_id]) map[t.client_id] = { name: client.name, income: 0, material: 0, fuel: 0, food: 0, transport: 0, other: 0 };
      if (t.type === 'income') map[t.client_id].income += Number(t.amount);
      else {
        if (t.category === 'material') map[t.client_id].material += Number(t.amount);
        else if (t.category === 'fuel') map[t.client_id].fuel += Number(t.amount);
        else if (t.category === 'food') map[t.client_id].food += Number(t.amount);
        else if (t.category === 'transport') map[t.client_id].transport += Number(t.amount);
        else map[t.client_id].other += Number(t.amount);
      }
    });
    return Object.values(map).map(c => ({
      ...c,
      totalExpense: c.material + c.fuel + c.food + c.transport + c.other,
      profit: c.income - (c.material + c.fuel + c.food + c.transport + c.other),
      margin: c.income > 0 ? ((c.income - (c.material + c.fuel + c.food + c.transport + c.other)) / c.income * 100) : 0,
    })).sort((a, b) => b.profit - a.profit);
  }, [transactions, clients]);

  const dreData = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthTx = transactions.filter(t => t.date.startsWith(currentMonth));
    const revenue = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const fixedExp = monthTx.filter(t => t.type === 'expense' && t.is_fixed).reduce((s, t) => s + Number(t.amount), 0);
    const varExp = monthTx.filter(t => t.type === 'expense' && !t.is_fixed).reduce((s, t) => s + Number(t.amount), 0);
    const byCategory: Record<string, number> = {};
    monthTx.filter(t => t.type === 'expense').forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount);
    });
    return { revenue, fixedExp, varExp, totalExp: fixedExp + varExp, profit: revenue - fixedExp - varExp, byCategory };
  }, [transactions]);

  const expenseByCat = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const counts: Record<string, number> = {};
    transactions.filter(t => t.date.startsWith(currentMonth) && t.type === 'expense').forEach(t => {
      const cat = categoryLabels[t.category] || t.category;
      counts[cat] = (counts[cat] || 0) + Number(t.amount);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [transactions]);

  // Mini cards config
  const miniCards = [
    { id: 'lancamentos' as Section, title: 'Lançamentos', icon: Receipt, value: String(transactions.length), sub: 'registros', color: 'text-primary' },
    { id: 'dre' as Section, title: 'DRE', icon: BarChart3, value: formatBRL(dreData.profit), sub: 'resultado mensal', color: dreData.profit >= 0 ? 'text-success' : 'text-destructive' },
    { id: 'vencer' as Section, title: 'A Vencer', icon: Clock, value: String(transactions.filter(t => t.status === 'pending' || t.status === 'overdue').length), sub: formatBRL(pendingPayable + pendingReceivable), color: 'text-warning' },
    { id: 'recebidos' as Section, title: 'Recebidos', icon: CheckCircle2, value: formatBRL(paidIncome), sub: 'total recebido', color: 'text-success' },
    { id: 'relatorio' as Section, title: 'Relatório', icon: FileBarChart, value: String(clientProfitData.length), sub: 'clientes', color: 'text-info' },
    { id: 'contas' as Section, title: 'Contas', icon: Building2, value: formatBRL(totalBankBalance), sub: `${bankAccounts.length} conta(s)`, color: 'text-primary' },
  ];

  function renderSection() {
    switch (activeSection) {
      case 'lancamentos': return renderLancamentos();
      case 'dre': return renderDRE();
      case 'vencer': return renderAVencer();
      case 'recebidos': return renderRecebidos();
      case 'relatorio': return renderRelatorio();
      case 'contas': return renderContas();
      default: return renderHome();
    }
  }

  function renderHome() {
    return (
      <>
        {/* KPI Summary */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Receita Total', value: formatBRL(totalIncome), icon: TrendingUp, positive: true },
            { title: 'Despesas', value: formatBRL(totalExpense), icon: TrendingDown, positive: false },
            { title: 'Lucro Líquido', value: formatBRL(profit), icon: DollarSign, positive: profit >= 0 },
            { title: 'Saldo Bancário', value: formatBRL(totalBankBalance), icon: Building2, positive: totalBankBalance >= 0 },
          ].map((kpi) => (
            <motion.div key={kpi.title} variants={itemVariants}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1 min-w-0">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.title}</p>
                      <p className={`text-lg font-bold font-display ${kpi.positive ? 'text-success' : 'text-destructive'}`}>{kpi.value}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent shrink-0">
                      <kpi.icon className="h-4 w-4 text-accent-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Mini Cards Navigation */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {miniCards.map((card) => (
            <motion.div key={card.id} variants={itemVariants}>
              <Card
                className="cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-2 border-transparent hover:border-primary/30 group"
                onClick={() => setActiveSection(card.id)}
              >
                <CardContent className="p-4 text-center space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent group-hover:bg-primary/10 transition-colors">
                    <card.icon className={`h-6 w-6 ${card.color}`} />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{card.title}</p>
                  <p className={`text-base font-bold font-display ${card.color}`}>{card.value}</p>
                  <p className="text-[10px] text-muted-foreground">{card.sub}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Chart */}
        <Card>
          <CardHeader><CardTitle className="text-base font-display">Fluxo de Caixa</CardTitle></CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
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
                  <YAxis axisLine={false} tickLine={false} fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatBRL(value)} contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(220, 16%, 90%)' }} />
                  <Area type="monotone" dataKey="entrada" stroke="hsl(152, 60%, 42%)" fill="url(#colorEntrada)" strokeWidth={2} name="Receita" />
                  <Area type="monotone" dataKey="saida" stroke="hsl(0, 72%, 51%)" fill="url(#colorSaida)" strokeWidth={2} name="Despesa" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-12">Nenhum lançamento registrado ainda. Crie um lançamento para ver o gráfico.</p>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  function renderLancamentos() {
    return (
      <Card>
        <CardHeader className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <CardTitle className="text-base font-display">Todos os Lançamentos</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8 w-40" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Clientes</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Categoria</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado</td></tr>
                ) : filtered.map((tx) => {
                  const clientName = tx.client_id ? clients.find(c => c.id === tx.client_id)?.name : null;
                  return (
                    <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {tx.type === 'income' ? <ArrowUpRight className="h-4 w-4 text-success shrink-0" /> : <ArrowDownRight className="h-4 w-4 text-destructive shrink-0" />}
                          <div>
                            <span className="text-sm">{tx.description}</span>
                            {tx.order_number && <span className="ml-1.5 text-[10px] bg-accent text-accent-foreground rounded px-1.5 py-0.5">OS: {tx.order_number}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">{clientName || '—'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{categoryLabels[tx.category] || tx.category}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>
                        {tx.type === 'income' ? '+' : '-'} {formatBRL(Number(tx.amount))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusConfig[tx.status]?.className ?? ''}`}>
                          {statusConfig[tx.status]?.label ?? tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {(tx.status === 'pending' || tx.status === 'overdue') && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => markPaid(tx.id)}>Pagar</Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditTransaction(tx)} title="Editar">
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteTransaction(tx.id)} title="Excluir">
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderDRE() {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base font-display">DRE — {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-sm font-semibold">Receita Bruta</span>
                <span className="text-sm font-bold text-success">{formatBRL(dreData.revenue)}</span>
              </div>
              <div className="flex justify-between py-2 pl-4">
                <span className="text-sm text-muted-foreground">(-) Despesas Fixas</span>
                <span className="text-sm text-destructive">{formatBRL(dreData.fixedExp)}</span>
              </div>
              <div className="flex justify-between py-2 pl-4">
                <span className="text-sm text-muted-foreground">(-) Despesas Variáveis</span>
                <span className="text-sm text-destructive">{formatBRL(dreData.varExp)}</span>
              </div>
              {Object.entries(dreData.byCategory).length > 0 && (
                <div className="pl-8 space-y-1 border-l-2 border-muted ml-4">
                  {Object.entries(dreData.byCategory).map(([cat, val]) => (
                    <div key={cat} className="flex justify-between py-1">
                      <span className="text-xs text-muted-foreground">{categoryLabels[cat] || cat}</span>
                      <span className="text-xs text-destructive">{formatBRL(val)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between py-2 border-t border-border">
                <span className="text-sm font-medium">Total Despesas</span>
                <span className="text-sm font-semibold text-destructive">{formatBRL(dreData.totalExp)}</span>
              </div>
              <div className="flex justify-between py-3 bg-accent/50 rounded-lg px-4 -mx-2">
                <span className="text-sm font-bold">Resultado Líquido</span>
                <span className={`text-lg font-bold ${dreData.profit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatBRL(dreData.profit)}</span>
              </div>
              {dreData.revenue > 0 && (
                <p className="text-xs text-muted-foreground text-center">Margem líquida: {((dreData.profit / dreData.revenue) * 100).toFixed(1)}%</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base font-display">Despesas por Categoria</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center">
            {expenseByCat.length > 0 ? (
              <>
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie data={expenseByCat} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                      {expenseByCat.map((_, i) => <Cell key={i} fill={EXPENSE_COLORS[i % EXPENSE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatBRL(value)} contentStyle={{ borderRadius: '0.5rem', fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full mt-3 space-y-1.5">
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
      </div>
    );
  }

  function renderAVencer() {
    const upcoming = transactions.filter(t => t.status === 'pending' || t.status === 'overdue').sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" /> Contas a Pagar / Receber — {formatBRL(upcoming.reduce((s, t) => s + Number(t.amount), 0))}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Descrição</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground hidden sm:table-cell">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Vencimento</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Valor</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma conta pendente</td></tr>
                ) : upcoming.map(tx => {
                  const isOverdue = tx.status === 'overdue' || (tx.due_date && tx.due_date < today);
                  return (
                    <tr key={tx.id} className={`border-b last:border-0 hover:bg-muted/30 ${isOverdue ? 'bg-destructive/5' : ''}`}>
                      <td className="px-4 py-3">
                        {tx.type === 'income' ? <Badge variant="outline" className="text-success border-success/30 text-[10px]">Receber</Badge> : <Badge variant="outline" className="text-destructive border-destructive/30 text-[10px]">Pagar</Badge>}
                      </td>
                      <td className="px-4 py-3 text-sm">{tx.description}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">{tx.client_id ? clients.find(c => c.id === tx.client_id)?.name : '—'}</td>
                      <td className={`px-4 py-3 text-sm font-medium ${isOverdue ? 'text-destructive' : ''}`}>{tx.due_date ? new Date(tx.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>{formatBRL(Number(tx.amount))}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusConfig[tx.status]?.className ?? ''}`}>
                          {statusConfig[tx.status]?.label ?? tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => markPaid(tx.id)}>
                          {tx.type === 'income' ? 'Receber' : 'Pagar'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderRecebidos() {
    const paid = transactions.filter(t => t.type === 'income' && t.status === 'paid').sort((a, b) => (b.paid_date || b.date).localeCompare(a.paid_date || a.date));
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" /> Valores Recebidos — {formatBRL(paidIncome)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Descrição</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground hidden sm:table-cell">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">Recebido em</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground hidden md:table-cell">Pagamento</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">Valor</th>
                </tr>
              </thead>
              <tbody>
                {paid.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum recebimento registrado</td></tr>
                ) : paid.map(tx => (
                  <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm">{tx.description}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden sm:table-cell">{tx.client_id ? clients.find(c => c.id === tx.client_id)?.name : '—'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{tx.paid_date ? new Date(tx.paid_date + 'T12:00:00').toLocaleDateString('pt-BR') : new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{tx.payment_method || '—'}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-success">{formatBRL(Number(tx.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderRelatorio() {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base font-display flex items-center gap-2"><FileBarChart className="h-5 w-5" /> Relatório de Lucro por Cliente</CardTitle></CardHeader>
        <CardContent>
          {clientProfitData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum lançamento vinculado a clientes ainda.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={clientProfitData.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={11} />
                  <YAxis axisLine={false} tickLine={false} fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatBRL(value)} contentStyle={{ borderRadius: '0.75rem' }} />
                  <Legend />
                  <Bar dataKey="income" name="Receita" fill="hsl(152, 60%, 42%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalExpense" name="Despesas" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="Lucro" fill="hsl(28, 85%, 56%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">Cliente</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">Receita</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground hidden sm:table-cell">Material</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground hidden md:table-cell">Combustível</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground hidden md:table-cell">Alimentação</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground hidden lg:table-cell">Frete</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">Lucro</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-muted-foreground">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientProfitData.map((c) => (
                      <tr key={c.name} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 text-sm font-medium">{c.name}</td>
                        <td className="px-3 py-2 text-sm text-right text-success">{formatBRL(c.income)}</td>
                        <td className="px-3 py-2 text-sm text-right text-destructive hidden sm:table-cell">{formatBRL(c.material)}</td>
                        <td className="px-3 py-2 text-sm text-right text-destructive hidden md:table-cell">{formatBRL(c.fuel)}</td>
                        <td className="px-3 py-2 text-sm text-right text-destructive hidden md:table-cell">{formatBRL(c.food)}</td>
                        <td className="px-3 py-2 text-sm text-right text-destructive hidden lg:table-cell">{formatBRL(c.transport)}</td>
                        <td className={`px-3 py-2 text-sm text-right font-bold ${c.profit >= 0 ? 'text-success' : 'text-destructive'}`}>{formatBRL(c.profit)}</td>
                        <td className="px-3 py-2 text-sm text-right">{c.margin.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderContas() {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setBankDialogOpen(true)}>
            <Building2 className="h-4 w-4 mr-2" /> Nova Conta
          </Button>
          <Button variant="outline" onClick={() => setTransferDialogOpen(true)}>
            <ArrowRightLeft className="h-4 w-4 mr-2" /> Transferir
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bankAccounts.map(acc => (
            <Card key={acc.id} className="border-l-4" style={{ borderLeftColor: acc.color }}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{acc.name}{acc.is_main && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5">Principal</span>}</p>
                  <p className="text-xs text-muted-foreground">{acc.bank_name || acc.account_type}{acc.agency ? ` • Ag: ${acc.agency}` : ''}{acc.account_number ? ` • CC: ${acc.account_number}` : ''}</p>
                  <p className="text-lg font-bold font-display mt-1">{formatBRL(acc.current_balance)}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteBank(acc.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </CardContent>
            </Card>
          ))}
          {bankAccounts.length === 0 && (
            <Card className="col-span-full border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma conta bancária cadastrada. Clique em "Nova Conta" para começar.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <motion.div ref={pageRef} variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {activeSection !== 'home' && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveSection('home')}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold font-display">Financeiro</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {activeSection === 'home' ? 'Controle completo de receitas, despesas e contas' :
                miniCards.find(c => c.id === activeSection)?.title || 'Financeiro'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="gradient-primary shadow-primary border-0" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Lançamento
          </Button>
        </div>
      </div>

      {overdueItems.length > 0 && activeSection === 'home' && (
        <motion.div variants={itemVariants}>
          <Card className="border-destructive/50 bg-destructive/5 cursor-pointer" onClick={() => setActiveSection('vencer')}>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-destructive">{overdueItems.length} conta(s) vencida(s)!</p>
                <p className="text-xs text-muted-foreground">Total: {formatBRL(overdueItems.reduce((s, t) => s + Number(t.amount), 0))}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div key={activeSection} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
        {renderSection()}
      </motion.div>

      {/* Dialogs */}
      <TransactionDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingTransaction(null); }}
        userId={user!.id}
        clients={clients}
        bankAccounts={bankAccounts}
        onSaved={fetchAll}
        editTransaction={editingTransaction}
      />

      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Nova Conta Bancária</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome da Conta *</Label><Input value={bankForm.name} onChange={e => setBankForm({ ...bankForm, name: e.target.value })} placeholder="Ex: Conta Principal PJ" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Banco</Label><Input value={bankForm.bank_name} onChange={e => setBankForm({ ...bankForm, bank_name: e.target.value })} placeholder="Ex: Itaú" /></div>
              <div className="space-y-2"><Label>Tipo</Label>
                <Select value={bankForm.account_type} onValueChange={v => setBankForm({ ...bankForm, account_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                    <SelectItem value="investimento">Investimento</SelectItem>
                    <SelectItem value="caixa">Caixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Agência</Label><Input value={bankForm.agency} onChange={e => setBankForm({ ...bankForm, agency: e.target.value })} placeholder="0001" /></div>
              <div className="space-y-2"><Label>Nº Conta</Label><Input value={bankForm.account_number} onChange={e => setBankForm({ ...bankForm, account_number: e.target.value })} placeholder="12345-6" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Saldo Inicial</Label><CurrencyInput value={bankForm.initial_balance} onChange={v => setBankForm({ ...bankForm, initial_balance: v })} /></div>
              <div className="space-y-2"><Label>Cor</Label><Input type="color" value={bankForm.color} onChange={e => setBankForm({ ...bankForm, color: e.target.value })} className="h-10" /></div>
            </div>
            <Button className="w-full gradient-primary shadow-primary border-0" onClick={handleSaveBank}>Cadastrar Conta</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Transferência entre Contas</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Conta de Origem</Label>
              <Select value={transferForm.from_account_id} onValueChange={v => setTransferForm({ ...transferForm, from_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {formatBRL(a.current_balance)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Conta de Destino</Label>
              <Select value={transferForm.to_account_id} onValueChange={v => setTransferForm({ ...transferForm, to_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} — {formatBRL(a.current_balance)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Valor</Label><CurrencyInput value={transferForm.amount} onChange={v => setTransferForm({ ...transferForm, amount: v })} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Input value={transferForm.description} onChange={e => setTransferForm({ ...transferForm, description: e.target.value })} placeholder="Motivo" /></div>
            <Button className="w-full gradient-primary shadow-primary border-0" onClick={handleTransfer}><ArrowRightLeft className="h-4 w-4 mr-2" /> Transferir</Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
