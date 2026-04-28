import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  Plus, Search, Trash2, Building2, ArrowRightLeft, AlertTriangle, FileBarChart,
  Receipt, Wallet, PieChart as PieChartIcon, BarChart3, ChevronLeft,
  CreditCard, Clock, CheckCircle2, X, Pencil, Milestone,
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
import MilestoneReceivables from '@/components/finance/MilestoneReceivables';
import { FinancialCategoryOption, getCategoryLabel, mergeFinancialCategories } from '@/lib/financial';
import { summarizeFinance } from '@/lib/finance-calc';

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

type PeriodFilterMode = 'month' | 'custom';

function getMonthOptions() {
  return Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1).padStart(2, '0'),
    label: new Date(2026, index, 1).toLocaleDateString('pt-BR', { month: 'long' }),
  }));
}

function getYearOptions(currentYear: number) {
  return Array.from({ length: 5 }, (_, index) => String(currentYear - 2 + index));
}

function getMonthRange(year: string, month: string) {
  const start = `${year}-${month}-01`;
  const end = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);
  return { start, end };
}

function isDateWithinRange(value: string | null | undefined, start: string, end: string) {
  if (!value) return false;
  return value >= start && value <= end;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-warning/10 text-warning' },
  paid: { label: 'Pago', className: 'bg-success/10 text-success' },
  overdue: { label: 'Vencido', className: 'bg-destructive/10 text-destructive' },
  cancelled: { label: 'Cancelado', className: 'bg-muted text-muted-foreground' },
};

const EXPENSE_COLORS = ['hsl(28, 85%, 56%)', 'hsl(0, 72%, 51%)', 'hsl(38, 92%, 50%)', 'hsl(210, 80%, 52%)', 'hsl(152, 60%, 42%)', 'hsl(280, 60%, 50%)', 'hsl(220, 16%, 65%)'];

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } };

type Section = 'home' | 'lancamentos' | 'dre' | 'vencer' | 'recebidos' | 'relatorio' | 'contas' | 'marcos';

export default function FinancePage() {
  const { user } = useAuth();
  const pageRef = useRef<HTMLDivElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [customCategories, setCustomCategories] = useState<FinancialCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>('home');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterClient, setFilterClient] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [periodMode, setPeriodMode] = useState<PeriodFilterMode>('month');
  const [selectedMonth, setSelectedMonth] = useState(today.slice(5, 7));
  const [selectedYear, setSelectedYear] = useState(today.slice(0, 4));
  const [customStart, setCustomStart] = useState(`${today.slice(0, 7)}-01`);
  const [customEnd, setCustomEnd] = useState(today);
  const [bankForm, setBankForm] = useState({ name: '', bank_name: '', account_type: 'corrente', agency: '', account_number: '', initial_balance: 0, color: '#3B82F6' });
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
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
    supabase
      .from('financial_categories' as any)
      .select('slug, name, type, color, is_system, sort_order')
      .order('sort_order')
      .then(({ data }) => {
        if (data) {
          setCustomCategories((data as any[]).map((item) => ({
            value: item.slug,
            label: item.name,
            type: item.type,
            color: item.color,
            isSystem: item.is_system,
            sortOrder: item.sort_order,
          })));
        }
      });
  }, []);

  const mergedCategories = useMemo(() => mergeFinancialCategories(customCategories), [customCategories]);

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

  // Scroll to top when section changes
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
    const container = pageRef.current?.closest('main');
    if (container instanceof HTMLElement) {
      container.scrollTo({ top: 0 });
    }
  }, [activeSection]);

  // Mark overdue transactions (fire-and-forget, only once per load)
  const overdueCheckedRef = useRef(false);
  useEffect(() => {
    if (overdueCheckedRef.current || transactions.length === 0) return;
    overdueCheckedRef.current = true;
    const today = new Date().toISOString().slice(0, 10);
    const overdueIds = transactions
      .filter(t => t.status === 'pending' && t.due_date && t.due_date < today)
      .map(t => t.id);
    if (overdueIds.length > 0) {
      supabase.from('financial_transactions')
        .update({ status: 'overdue' } as any)
        .in('id', overdueIds)
        .then(() => fetchAll());
    }
  }, [transactions]);

  async function handleSaveBank() {
    if (!bankForm.name) { toast.error('Nome da conta é obrigatório'); return; }
    if (editingBankId) {
      // Update — recalcula saldo: novo saldo = saldo atual + (novo inicial - inicial antigo)
      const existing = bankAccounts.find((a) => a.id === editingBankId);
      const balanceDelta = bankForm.initial_balance - (existing?.initial_balance ?? 0);
      const newBalance = (existing?.current_balance ?? 0) + balanceDelta;
      const { error } = await supabase.from('bank_accounts').update({
        name: bankForm.name, bank_name: bankForm.bank_name || null,
        account_type: bankForm.account_type, agency: bankForm.agency || null,
        account_number: bankForm.account_number || null,
        initial_balance: bankForm.initial_balance,
        current_balance: newBalance,
        color: bankForm.color,
      } as any).eq('id', editingBankId);
      if (error) { toast.error('Erro ao atualizar conta'); return; }
      toast.success('Conta atualizada!');
    } else {
      const { error } = await supabase.from('bank_accounts').insert({
        user_id: user!.id, name: bankForm.name, bank_name: bankForm.bank_name || null,
        account_type: bankForm.account_type, agency: bankForm.agency || null,
        account_number: bankForm.account_number || null, initial_balance: bankForm.initial_balance,
        current_balance: bankForm.initial_balance, color: bankForm.color,
        is_main: bankAccounts.length === 0,
      } as any);
      if (error) { toast.error('Erro ao salvar conta'); return; }
      toast.success('Conta cadastrada!');
    }
    setBankDialogOpen(false);
    setEditingBankId(null);
    setBankForm({ name: '', bank_name: '', account_type: 'corrente', agency: '', account_number: '', initial_balance: 0, color: '#3B82F6' });
    fetchAll();
  }

  function openEditBank(acc: BankAccount) {
    setEditingBankId(acc.id);
    setBankForm({
      name: acc.name,
      bank_name: acc.bank_name ?? '',
      account_type: acc.account_type,
      agency: acc.agency ?? '',
      account_number: acc.account_number ?? '',
      initial_balance: Number(acc.initial_balance) || 0,
      color: acc.color,
    });
    setBankDialogOpen(true);
  }

  async function deleteBankConfirm(id: string) {
    const acc = bankAccounts.find((a) => a.id === id);
    if (!acc) return;
    const linked = transactions.some((t) => t.bank_account_id === id);
    const msg = linked
      ? `A conta "${acc.name}" possui lançamentos vinculados. Excluir mesmo assim? Os lançamentos ficarão sem conta.`
      : `Excluir a conta "${acc.name}"?`;
    if (!window.confirm(msg)) return;
    await deleteBank(id);
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

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const yearOptions = useMemo(() => getYearOptions(new Date().getFullYear()), []);
  const period = useMemo(() => {
    if (periodMode === 'custom') {
      const start = customStart || `${selectedYear}-${selectedMonth}-01`;
      const end = customEnd || today;
      return {
        start: start <= end ? start : end,
        end: end >= start ? end : start,
      };
    }

    return getMonthRange(selectedYear, selectedMonth);
  }, [customEnd, customStart, periodMode, selectedMonth, selectedYear, today]);

  const periodTransactions = useMemo(
    () => transactions.filter((transaction) => isDateWithinRange(transaction.date, period.start, period.end)),
    [period.end, period.start, transactions]
  );

  // Computed — regras canônicas (finance-calc): só transações pagas contam como entrada/saída efetiva
  const summary = useMemo(() => summarizeFinance(periodTransactions, today), [periodTransactions, today]);
  const totalIncome = summary.income;       // Entradas recebidas no período
  const totalExpense = summary.expense;     // Saídas pagas no período
  const profit = summary.profit;            // Resultado
  const totalBankBalance = bankAccounts.reduce((s, a) => s + Number(a.current_balance), 0);
  const pendingReceivable = summary.receivable;
  const pendingPayable = summary.payable;
  const overdueItems = periodTransactions.filter(t => (t.status === 'overdue') || (t.status === 'pending' && t.due_date && t.due_date < today));
  const paidIncome = summary.income;

  const filtered = useMemo(() => {
    return periodTransactions.filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterClient !== 'all' && t.client_id !== filterClient) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [periodTransactions, filterType, filterClient, search]);

  const chartData = useMemo(() => {
    const months: Record<string, { month: string; entrada: number; saida: number }> = {};
    periodTransactions.forEach(t => {
      const m = t.date.slice(0, 7);
      if (!months[m]) months[m] = { month: m, entrada: 0, saida: 0 };
      if (t.type === 'income') months[m].entrada += Number(t.amount);
      else months[m].saida += Number(t.amount);
    });
    return Object.values(months).sort((a, b) => a.month.localeCompare(b.month)).slice(-6).map(m => ({
      ...m, month: new Date(m.month + '-01').toLocaleDateString('pt-BR', { month: 'short' }),
    }));
  }, [periodTransactions]);

  const clientProfitData = useMemo(() => {
    const map: Record<string, { name: string; income: number; material: number; fuel: number; food: number; transport: number; other: number }> = {};
    periodTransactions.forEach(t => {
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
  }, [periodTransactions, clients]);

  const dreData = useMemo(() => {
    const monthTx = periodTransactions;
    const revenue = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const fixedExp = monthTx.filter(t => t.type === 'expense' && t.is_fixed).reduce((s, t) => s + Number(t.amount), 0);
    const varExp = monthTx.filter(t => t.type === 'expense' && !t.is_fixed).reduce((s, t) => s + Number(t.amount), 0);
    const byCategory: Record<string, number> = {};
    monthTx.filter(t => t.type === 'expense').forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount);
    });
    return { revenue, fixedExp, varExp, totalExp: fixedExp + varExp, profit: revenue - fixedExp - varExp, byCategory };
  }, [periodTransactions]);

  const expenseByCat = useMemo(() => {
    const counts: Record<string, number> = {};
    periodTransactions.filter(t => t.type === 'expense').forEach(t => {
      const cat = getCategoryLabel(mergedCategories, t.category);
      counts[cat] = (counts[cat] || 0) + Number(t.amount);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [mergedCategories, periodTransactions]);

  const periodLabel = useMemo(() => {
    if (periodMode === 'custom') {
      return `${new Date(`${period.start}T12:00:00`).toLocaleDateString('pt-BR')} → ${new Date(`${period.end}T12:00:00`).toLocaleDateString('pt-BR')}`;
    }

    return new Date(`${selectedYear}-${selectedMonth}-01T12:00:00`).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });
  }, [period.end, period.start, periodMode, selectedMonth, selectedYear]);

  // Mini cards config
  const miniCards = [
    { id: 'lancamentos' as Section, title: 'Lançamentos', icon: Receipt, value: String(periodTransactions.length), sub: 'registros', color: 'text-primary' },
    { id: 'dre' as Section, title: 'DRE', icon: BarChart3, value: formatBRL(dreData.profit), sub: 'resultado do período', color: dreData.profit >= 0 ? 'text-success' : 'text-destructive' },
    { id: 'vencer' as Section, title: 'A Vencer', icon: Clock, value: String(periodTransactions.filter(t => t.status === 'pending' || t.status === 'overdue').length), sub: formatBRL(pendingPayable + pendingReceivable), color: 'text-warning' },
    { id: 'recebidos' as Section, title: 'Recebidos', icon: CheckCircle2, value: formatBRL(paidIncome), sub: 'total recebido', color: 'text-success' },
    { id: 'relatorio' as Section, title: 'Relatório', icon: FileBarChart, value: String(clientProfitData.length), sub: 'clientes', color: 'text-info' },
    { id: 'contas' as Section, title: 'Contas', icon: Building2, value: formatBRL(totalBankBalance), sub: `${bankAccounts.length} conta(s)`, color: 'text-primary' },
    { id: 'marcos' as Section, title: 'Marcos', icon: Milestone, value: '—', sub: 'recebimentos', color: 'text-accent' },
  ];
  function renderSection() {
    switch (activeSection) {
      case 'lancamentos': return renderLancamentos();
      case 'dre': return renderDRE();
      case 'vencer': return renderAVencer();
      case 'recebidos': return renderRecebidos();
      case 'relatorio': return renderRelatorio();
      case 'contas': return renderContas();
      case 'marcos': return <MilestoneReceivables />;
      default: return renderHome();
    }
  }

  function renderHome() {
    const recentTransactions = [...periodTransactions]
      .sort((a, b) => (b.paid_date || b.date).localeCompare(a.paid_date || a.date))
      .slice(0, 8);

    const quickActions: { id: Section | 'new'; label: string; icon: typeof Plus; onClick: () => void }[] = [
      { id: 'new', label: 'Lançar', icon: Plus, onClick: () => setDialogOpen(true) },
      { id: 'contas', label: 'Contas', icon: Building2, onClick: () => setActiveSection('contas') },
      { id: 'vencer', label: 'A Vencer', icon: Clock, onClick: () => setActiveSection('vencer') },
      { id: 'recebidos', label: 'Recebidos', icon: CheckCircle2, onClick: () => setActiveSection('recebidos') },
      { id: 'dre', label: 'DRE', icon: BarChart3, onClick: () => setActiveSection('dre') },
      { id: 'relatorio', label: 'Relatório', icon: FileBarChart, onClick: () => setActiveSection('relatorio') },
      { id: 'marcos', label: 'Marcos', icon: Milestone, onClick: () => setActiveSection('marcos') },
      { id: 'lancamentos', label: 'Histórico', icon: Receipt, onClick: () => setActiveSection('lancamentos') },
    ];

    return (
      <>
        {/* HERO — Saldo total estilo banking app */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-[hsl(215,28%,17%)] via-[hsl(215,25%,22%)] to-[hsl(215,30%,15%)] text-white">
            <CardContent className="p-6 sm:p-8 space-y-6">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-medium">Saldo total disponível</p>
                  <p className="text-3xl sm:text-4xl font-bold font-display tracking-tight">{formatBRL(totalBankBalance)}</p>
                  <p className="text-xs text-white/50">{bankAccounts.length} {bankAccounts.length === 1 ? 'conta ativa' : 'contas ativas'}</p>
                </div>
                <button
                  onClick={() => setActiveSection('contas')}
                  className="rounded-full bg-white/10 hover:bg-white/20 transition-colors p-2.5"
                  title="Ver contas"
                >
                  <Wallet className="h-4 w-4" />
                </button>
              </div>

              {/* Resumo do período */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
                <div>
                  <div className="flex items-center gap-1 text-white/60 text-[10px] uppercase tracking-wider font-medium">
                    <ArrowUpRight className="h-3 w-3" /> Entradas
                  </div>
                  <p className="text-base sm:text-lg font-bold mt-1 text-emerald-300">{formatBRL(totalIncome)}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-white/60 text-[10px] uppercase tracking-wider font-medium">
                    <ArrowDownRight className="h-3 w-3" /> Saídas
                  </div>
                  <p className="text-base sm:text-lg font-bold mt-1 text-rose-300">{formatBRL(totalExpense)}</p>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-white/60 text-[10px] uppercase tracking-wider font-medium">
                    <DollarSign className="h-3 w-3" /> Resultado
                  </div>
                  <p className={`text-base sm:text-lg font-bold mt-1 ${profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatBRL(profit)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions — pills horizontais */}
        <motion.div variants={itemVariants}>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={action.onClick}
                className="flex flex-col items-center gap-2 min-w-[72px] group"
              >
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all group-hover:scale-105 group-active:scale-95 ${
                  action.id === 'new'
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                    : 'bg-card border border-border text-foreground group-hover:border-primary/30 group-hover:bg-accent'
                }`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight">{action.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Contas — cards horizontais */}
        {bankAccounts.length > 0 && (
          <motion.div variants={itemVariants} className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Minhas contas</h3>
              <button onClick={() => setActiveSection('contas')} className="text-xs font-medium text-primary hover:underline">
                Ver todas
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide snap-x">
              {bankAccounts.slice(0, 6).map(acc => (
                <Card
                  key={acc.id}
                  onClick={() => setActiveSection('contas')}
                  className="min-w-[220px] sm:min-w-[240px] snap-start cursor-pointer overflow-hidden border-0 shadow-sm hover:shadow-md transition-all relative"
                  style={{ background: `linear-gradient(135deg, ${acc.color} 0%, ${acc.color}cc 100%)` }}
                >
                  <CardContent className="p-4 text-white relative z-10 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="rounded-lg bg-white/15 p-2">
                        <Building2 className="h-4 w-4" />
                      </div>
                      {acc.is_main && (
                        <span className="text-[9px] uppercase tracking-wider bg-white/20 rounded-full px-2 py-0.5 font-semibold">Principal</span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-white/80 font-medium truncate">{acc.name}</p>
                      <p className="text-[10px] text-white/60 truncate">{acc.bank_name || acc.account_type}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/60 uppercase tracking-wider">Saldo</p>
                      <p className="text-lg font-bold font-display">{formatBRL(acc.current_balance)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <button
                onClick={() => { setActiveSection('contas'); setBankDialogOpen(true); }}
                className="min-w-[120px] snap-start rounded-lg border-2 border-dashed border-border hover:border-primary/40 hover:bg-accent/50 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
              >
                <Plus className="h-5 w-5" />
                <span className="text-xs font-medium">Nova conta</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Atividade recente + Fluxo de caixa */}
        <div className="grid gap-4 lg:grid-cols-5">
          <motion.div variants={itemVariants} className="lg:col-span-3">
            <Card className="h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base font-display">Atividade recente</CardTitle>
                <button onClick={() => setActiveSection('lancamentos')} className="text-xs font-medium text-primary hover:underline">
                  Ver tudo
                </button>
              </CardHeader>
              <CardContent className="p-0">
                {recentTransactions.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <Receipt className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhum lançamento neste período.</p>
                    <Button size="sm" variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Criar primeiro lançamento
                    </Button>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {recentTransactions.map((tx) => {
                      const clientName = tx.client_id ? clients.find(c => c.id === tx.client_id)?.name : null;
                      const isIncome = tx.type === 'income';
                      return (
                        <li
                          key={tx.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 cursor-pointer transition-colors"
                          onClick={() => openEditTransaction(tx)}
                        >
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                            isIncome ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                          }`}>
                            {isIncome ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{tx.description}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {clientName ? `${clientName} • ` : ''}
                              {new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-bold ${isIncome ? 'text-success' : 'text-destructive'}`}>
                              {isIncome ? '+' : '−'} {formatBRL(Number(tx.amount))}
                            </p>
                            <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold mt-0.5 ${statusConfig[tx.status]?.className ?? ''}`}>
                              {statusConfig[tx.status]?.label ?? tx.status}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants} className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-display">Fluxo de caixa</CardTitle>
                <p className="text-xs text-muted-foreground">Últimos meses do período</p>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorEntrada" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(152, 60%, 42%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorSaida" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" vertical={false} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} fontSize={11} />
                      <YAxis axisLine={false} tickLine={false} fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatBRL(value)} contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(220, 16%, 90%)', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="entrada" stroke="hsl(152, 60%, 42%)" fill="url(#colorEntrada)" strokeWidth={2} name="Receita" />
                      <Area type="monotone" dataKey="saida" stroke="hsl(0, 72%, 51%)" fill="url(#colorSaida)" strokeWidth={2} name="Despesa" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">Sem dados para o período.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Resumo rápido — A Receber / A Pagar */}
        <div className="grid gap-3 sm:grid-cols-2">
          <motion.div variants={itemVariants}>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-success"
              onClick={() => setActiveSection('vencer')}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">A receber no período</p>
                  <p className="text-xl font-bold font-display text-success mt-1">{formatBRL(pendingReceivable)}</p>
                </div>
                <ArrowUpRight className="h-5 w-5 text-success/60" />
              </CardContent>
            </Card>
          </motion.div>
          <motion.div variants={itemVariants}>
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-destructive"
              onClick={() => setActiveSection('vencer')}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">A pagar no período</p>
                  <p className="text-xl font-bold font-display text-destructive mt-1">{formatBRL(pendingPayable)}</p>
                </div>
                <ArrowDownRight className="h-5 w-5 text-destructive/60" />
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </>
    );
  }

  function renderLancamentos() {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pb-4">
          <div>
            <CardTitle className="text-base font-display">Todos os Lançamentos</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9 w-44 h-9 rounded-full bg-muted/40 border-0 focus-visible:ring-1" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-32 h-9 rounded-full bg-muted/40 border-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-40 h-9 rounded-full bg-muted/40 border-0"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos clientes</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Receipt className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum lançamento encontrado.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((tx) => {
                const clientName = tx.client_id ? clients.find(c => c.id === tx.client_id)?.name : null;
                const isIncome = tx.type === 'income';
                return (
                  <li key={tx.id} className="group flex items-center gap-3 px-4 sm:px-6 py-3.5 hover:bg-accent/40 transition-colors">
                    <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${
                      isIncome ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {isIncome ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        {tx.order_number && <span className="text-[9px] bg-accent text-accent-foreground rounded-full px-1.5 py-0.5 font-semibold shrink-0">OS {tx.order_number}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {clientName ? `${clientName} • ` : ''}
                        {getCategoryLabel(mergedCategories, tx.category)} • {new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${isIncome ? 'text-success' : 'text-destructive'}`}>
                        {isIncome ? '+' : '−'} {formatBRL(Number(tx.amount))}
                      </p>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold mt-0.5 ${statusConfig[tx.status]?.className ?? ''}`}>
                        {statusConfig[tx.status]?.label ?? tx.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(tx.status === 'pending' || tx.status === 'overdue') && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs rounded-full" onClick={() => markPaid(tx.id)}>
                          {isIncome ? 'Receber' : 'Pagar'}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => openEditTransaction(tx)} title="Editar">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => deleteTransaction(tx.id)} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  }

  function renderDRE() {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base font-display">DRE — {periodLabel}</CardTitle></CardHeader>
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
                      <span className="text-xs text-muted-foreground">{getCategoryLabel(mergedCategories, cat)}</span>
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
              <p className="text-sm text-muted-foreground py-12">Nenhuma despesa no período.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderAVencer() {
    const upcoming = periodTransactions
      .filter(t => t.status === 'pending' || t.status === 'overdue')
      .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'));
    const totalPendente = upcoming.reduce((s, t) => s + Number(t.amount), 0);
    const totalReceber = upcoming.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const totalPagar = upcoming.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

    return (
      <div className="space-y-4">
        {/* Resumo */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-l-4 border-l-warning">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total pendente</p>
              <p className="text-xl font-bold font-display mt-1">{formatBRL(totalPendente)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-success">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">A receber</p>
              <p className="text-xl font-bold font-display text-success mt-1">{formatBRL(totalReceber)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-destructive">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">A pagar</p>
              <p className="text-xl font-bold font-display text-destructive mt-1">{formatBRL(totalPagar)}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Próximos vencimentos
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {upcoming.length === 0 ? (
              <div className="text-center py-16 px-4">
                <CheckCircle2 className="h-10 w-10 text-success/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Tudo em dia! Nenhuma conta pendente.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map(tx => {
                  const isOverdue = tx.status === 'overdue' || (tx.due_date && tx.due_date < today);
                  const isIncome = tx.type === 'income';
                  const clientName = tx.client_id ? clients.find(c => c.id === tx.client_id)?.name : null;
                  const daysToDue = tx.due_date
                    ? Math.ceil((new Date(tx.due_date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000)
                    : null;
                  return (
                    <li key={tx.id} className={`flex items-center gap-3 px-4 sm:px-6 py-3.5 hover:bg-accent/40 transition-colors ${isOverdue ? 'bg-destructive/5' : ''}`}>
                      <div className={`h-11 w-11 rounded-full flex items-center justify-center shrink-0 ${
                        isOverdue ? 'bg-destructive/10 text-destructive' :
                        isIncome ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                      }`}>
                        {isOverdue ? <AlertTriangle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {clientName ? `${clientName} • ` : ''}
                          {tx.due_date ? `Vence ${new Date(tx.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}` : 'Sem vencimento'}
                          {daysToDue !== null && (
                            <span className={`ml-1 font-semibold ${isOverdue ? 'text-destructive' : daysToDue <= 3 ? 'text-warning' : ''}`}>
                              {isOverdue ? `(${Math.abs(daysToDue)}d atrasado)` : daysToDue === 0 ? '(hoje)' : `(em ${daysToDue}d)`}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${isIncome ? 'text-success' : 'text-destructive'}`}>
                          {isIncome ? '+' : '−'} {formatBRL(Number(tx.amount))}
                        </p>
                        <Badge variant="outline" className={`text-[9px] mt-0.5 ${isIncome ? 'text-success border-success/30' : 'text-destructive border-destructive/30'}`}>
                          {isIncome ? 'Receber' : 'Pagar'}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        className={`h-8 text-xs rounded-full ml-1 shrink-0 ${
                          isIncome ? 'bg-success hover:bg-success/90 text-success-foreground' : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                        }`}
                        onClick={() => markPaid(tx.id)}
                      >
                        {isIncome ? 'Receber' : 'Pagar'}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  function renderRecebidos() {
    const paid = transactions
      .filter(t => t.type === 'income' && t.status === 'paid')
      .sort((a, b) => (b.paid_date || b.date).localeCompare(a.paid_date || a.date));
    const periodPaid = paid.filter(t => isDateWithinRange(t.paid_date || t.date, period.start, period.end));
    const periodTotal = periodPaid.reduce((s, t) => s + Number(t.amount), 0);

    return (
      <div className="space-y-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-success/10 via-success/5 to-transparent">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total recebido no período</p>
              <p className="text-3xl font-bold font-display text-success mt-1">{formatBRL(periodTotal)}</p>
              <p className="text-xs text-muted-foreground mt-1">{periodPaid.length} {periodPaid.length === 1 ? 'recebimento' : 'recebimentos'}</p>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-success/15 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Histórico de recebimentos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {paid.length === 0 ? (
              <div className="text-center py-16 px-4">
                <CheckCircle2 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum recebimento registrado ainda.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {paid.map(tx => {
                  const clientName = tx.client_id ? clients.find(c => c.id === tx.client_id)?.name : null;
                  const dateStr = tx.paid_date || tx.date;
                  return (
                    <li key={tx.id} className="flex items-center gap-3 px-4 sm:px-6 py-3.5 hover:bg-accent/40 transition-colors">
                      <div className="h-11 w-11 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{tx.description}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {clientName ? `${clientName} • ` : ''}
                          Recebido em {new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')}
                          {tx.payment_method ? ` • ${tx.payment_method}` : ''}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-success shrink-0">+ {formatBRL(Number(tx.amount))}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
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
            <p className="text-xs text-muted-foreground mt-1">Período analisado: {periodLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-end justify-end">
          <div className="grid gap-2 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="finance-filter-mode">Filtro</Label>
              <Select value={periodMode} onValueChange={(value: PeriodFilterMode) => setPeriodMode(value)}>
                <SelectTrigger id="finance-filter-mode" className="w-full sm:w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mês/Ano</SelectItem>
                  <SelectItem value="custom">Período</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodMode === 'month' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="finance-month">Mês</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger id="finance-month" className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((month) => (
                        <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-year">Ano</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger id="finance-year" className="w-full sm:w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="finance-start">Início</Label>
                  <Input id="finance-start" type="date" value={customStart} max={customEnd || undefined} onChange={e => setCustomStart(e.target.value)} className="w-full sm:w-[150px]" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-end">Fim</Label>
                  <Input id="finance-end" type="date" value={customEnd} min={customStart || undefined} onChange={e => setCustomEnd(e.target.value)} className="w-full sm:w-[150px]" />
                </div>
              </>
            )}
          </div>

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
