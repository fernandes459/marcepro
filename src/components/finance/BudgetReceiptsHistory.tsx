import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChevronDown, ChevronRight, CheckCircle2, Clock, CreditCard, Calendar,
  FileText, User, History, Search, Receipt, Printer,
} from 'lucide-react';
import Decimal from 'decimal.js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatBRL } from '@/lib/format';
import { generateReceiptPdf } from './ReceiptPdfGenerator';

interface PaymentRow {
  id: string;
  transaction_id: string;
  valor: number;
  data: string;
  forma_pagamento: string | null;
  bank_account_id: string | null;
  notes: string | null;
}

interface TxRow {
  id: string;
  budget_id: string | null;
  description: string;
  amount: number;
  status: string;
  valor_recebido: number | null;
  saldo_aberto: number | null;
  due_date: string | null;
  paid_date: string | null;
  payment_method: string | null;
}

interface BudgetLite {
  id: string;
  code: string;
  project_name: string | null;
  client_id: string | null;
  final_price: number | null;
}

interface GroupTx extends TxRow {
  payments: PaymentRow[];
}

interface BudgetGroup {
  key: string;
  code: string;
  project: string | null;
  clientName: string | null;
  contratado: number;
  recebido: number;
  saldo: number;
  progress: number;
  lastDate: string | null;
  txs: GroupTx[];
  paymentsCount: number;
}

const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

export default function BudgetReceiptsHistory() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [budgets, setBudgets] = useState<BudgetLite[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all');
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});

  async function fetchAll() {
    if (!user) return;
    const [phRes, txRes, bRes, cRes, aRes] = await Promise.all([
      supabase.from('payment_history').select('*').order('data', { ascending: false }),
      supabase
        .from('financial_transactions')
        .select('id, budget_id, description, amount, status, valor_recebido, saldo_aberto, due_date, paid_date, payment_method')
        .eq('type', 'income')
        .neq('status', 'cancelled'),
      supabase.from('budgets').select('id, code, project_name, client_id, final_price'),
      supabase.from('clients').select('id, name'),
      supabase.from('bank_accounts').select('id, name'),
    ]);
    setPayments((phRes.data as any) || []);
    setTxs((txRes.data as any) || []);
    setBudgets((bRes.data as any) || []);
    setClients((cRes.data as any) || []);
    setAccounts((aRes.data as any) || []);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`budget-receipts-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_history' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_transactions' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const accountName = (id: string | null) => (id ? accounts.find(a => a.id === id)?.name || null : null);

  const groups = useMemo<BudgetGroup[]>(() => {
    const dec = (n: any) => new Decimal(Number(n) || 0);
    const payByTx = new Map<string, PaymentRow[]>();
    for (const p of payments) {
      if (!payByTx.has(p.transaction_id)) payByTx.set(p.transaction_id, []);
      payByTx.get(p.transaction_id)!.push(p);
    }

    const byBudget = new Map<string, TxRow[]>();
    for (const t of txs) {
      if (!t.budget_id) continue;
      if (!byBudget.has(t.budget_id)) byBudget.set(t.budget_id, []);
      byBudget.get(t.budget_id)!.push(t);
    }

    const out: BudgetGroup[] = [];
    for (const [budgetId, list] of byBudget.entries()) {
      const budget = budgets.find(b => b.id === budgetId);
      if (!budget) continue;
      const clientName = budget.client_id ? clients.find(c => c.id === budget.client_id)?.name || null : null;

      let contratado = new Decimal(0);
      let recebido = new Decimal(0);
      let saldo = new Decimal(0);
      let lastDate: string | null = null;
      let paymentsCount = 0;

      const groupTxs: GroupTx[] = list
        .map(t => {
          const ps = (payByTx.get(t.id) || []).slice().sort((a, b) => b.data.localeCompare(a.data));
          paymentsCount += ps.length;
          contratado = contratado.plus(dec(t.amount));
          const pago = t.status === 'paid'
            ? dec(t.valor_recebido || t.amount)
            : dec(t.valor_recebido);
          recebido = recebido.plus(pago);
          const abertoTx = t.status === 'paid'
            ? new Decimal(0)
            : Decimal.max(0, dec(t.amount).minus(dec(t.valor_recebido)));
          saldo = saldo.plus(abertoTx);
          for (const p of ps) if (!lastDate || p.data > lastDate) lastDate = p.data;
          return { ...t, payments: ps };
        })
        .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

      const progress = contratado.gt(0) ? recebido.div(contratado).times(100).toNumber() : 0;

      out.push({
        key: budgetId,
        code: budget.code,
        project: budget.project_name,
        clientName,
        clientDoc: budget.client_id ? clients.find(c => c.id === budget.client_id)?.cpf_cnpj || null : null,
        contratado: contratado.toNumber(),
        recebido: recebido.toNumber(),
        saldo: saldo.toNumber(),
        progress: Math.min(100, progress),
        lastDate,
        txs: groupTxs,
        paymentsCount,
      });
    }

    return out.sort((a, b) => {
      if ((a.saldo > 0) !== (b.saldo > 0)) return a.saldo > 0 ? -1 : 1;
      return b.saldo - a.saldo || b.contratado - a.contratado;
    });
  }, [payments, txs, budgets, clients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter(g => {
      if (filter === 'open' && g.saldo <= 0) return false;
      if (filter === 'done' && g.saldo > 0) return false;
      if (!q) return true;
      return [g.code, g.project, g.clientName].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    });
  }, [groups, search, filter]);

  const totals = useMemo(() => filtered.reduce(
    (acc, g) => ({
      contratado: acc.contratado + g.contratado,
      recebido: acc.recebido + g.recebido,
      saldo: acc.saldo + g.saldo,
    }),
    { contratado: 0, recebido: 0, saldo: 0 },
  ), [filtered]);

  if (loading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Carregando histórico...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        <Kpi label="Contratado" value={formatBRL(totals.contratado)} tone="primary" icon={FileText} />
        <Kpi label="Recebido" value={formatBRL(totals.recebido)} tone="success" icon={CheckCircle2} />
        <Kpi label="Saldo restante" value={formatBRL(totals.saldo)} tone="warning" icon={Clock} />
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar orçamento, projeto ou cliente"
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="open">Com saldo aberto</SelectItem>
            <SelectItem value="done">Quitados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <History className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum orçamento com recebimentos</p>
            <p className="text-xs text-muted-foreground mt-1">
              Os recebimentos aparecem aqui conforme você registra pagamentos nos lançamentos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(g => {
            const isOpen = !!openKeys[g.key];
            return (
              <Collapsible key={g.key} open={isOpen} onOpenChange={(v) => setOpenKeys(s => ({ ...s, [g.key]: v }))}>
                <Card className="overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <button type="button" className="w-full text-left p-3 hover:bg-accent/40 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              <FileText className="h-3 w-3 mr-1" /> {g.code}
                            </Badge>
                            <p className="text-sm font-bold truncate">{g.project || 'Sem nome de projeto'}</p>
                            {g.saldo <= 0 && (
                              <Badge className="text-[9px] bg-success/15 text-success">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Quitado
                              </Badge>
                            )}
                          </div>
                          {g.clientName && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                              <User className="h-3 w-3" /> {g.clientName}
                            </p>
                          )}
                          <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                            <div>
                              <p className="text-muted-foreground">Contratado</p>
                              <p className="font-bold">{formatBRL(g.contratado)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Recebido</p>
                              <p className="font-bold text-success">{formatBRL(g.recebido)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Saldo restante</p>
                              <p className={`font-bold ${g.saldo > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                                {formatBRL(g.saldo)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Progress value={g.progress} className="h-1.5 flex-1" />
                            <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                              {g.progress.toFixed(0)}%
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                            <Receipt className="h-3 w-3" />
                            {g.paymentsCount} recebimento(s)
                            {g.lastDate && ` · último em ${fmtDate(g.lastDate)}`}
                          </p>
                        </div>
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="border-t bg-muted/20 p-3 space-y-2.5">
                      {g.txs.map(t => {
                        const recebidoTx = t.status === 'paid'
                          ? Number(t.valor_recebido || t.amount)
                          : Number(t.valor_recebido || 0);
                        const saldoTx = t.status === 'paid'
                          ? 0
                          : Math.max(0, Number(t.amount) - recebidoTx);
                        return (
                          <div key={t.id} className="rounded-lg border bg-card p-2.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{t.description}</p>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                                  {t.due_date && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" /> Vence {fmtDate(t.due_date)}
                                    </span>
                                  )}
                                  <span>Parcela: <strong>{formatBRL(t.amount)}</strong></span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-success">{formatBRL(recebidoTx)}</p>
                                <Badge className={`text-[9px] mt-0.5 ${saldoTx === 0 ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                                  {saldoTx === 0 ? 'Quitado' : `Falta ${formatBRL(saldoTx)}`}
                                </Badge>
                              </div>
                            </div>

                            {t.payments.length > 0 ? (
                              <div className="mt-2 space-y-1">
                                {t.payments.map(p => {
                                  const acc = accountName(p.bank_account_id);
                                  return (
                                    <div key={p.id} className="flex items-center justify-between gap-2 text-[11px] rounded bg-muted/40 px-2 py-1.5">
                                      <div className="min-w-0">
                                        <span className="font-medium">{fmtDate(p.data)}</span>
                                        {p.forma_pagamento && (
                                          <span className="text-muted-foreground"> · <CreditCard className="h-3 w-3 inline mb-0.5" /> {p.forma_pagamento}</span>
                                        )}
                                        {acc && <span className="text-muted-foreground"> · {acc}</span>}
                                        {p.notes && <span className="text-muted-foreground block truncate">{p.notes}</span>}
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="font-bold text-success whitespace-nowrap">{formatBRL(p.valor)}</span>
                                        <button
                                          type="button"
                                          title="Gerar recibo em PDF"
                                          onClick={() => generateReceiptPdf({
                                            receiptNumber: `${g.code}-${p.id.slice(0, 6).toUpperCase()}`,
                                            clientName: g.clientName,
                                            clientDoc: g.clientDoc,
                                            budgetCode: g.code,
                                            projectName: g.project,
                                            installmentLabel: t.description,
                                            amount: Number(p.valor),
                                            date: p.data,
                                            paymentMethod: p.forma_pagamento,
                                            accountName: acc,
                                            notes: p.notes,
                                            contracted: g.contratado,
                                            received: g.recebido,
                                            remaining: g.saldo,
                                            companyName: company?.company_name,
                                            companyDoc: company?.cnpj,
                                            companyCity: company?.city,
                                            companyState: company?.state,
                                            companyPhone: company?.phone,
                                            companyEmail: company?.email,
                                          })}
                                          className="h-6 w-6 rounded flex items-center justify-center text-primary hover:bg-primary/10"
                                        >
                                          <Printer className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                {t.status === 'paid'
                                  ? `Quitado${t.paid_date ? ` em ${fmtDate(t.paid_date)}` : ''}${t.payment_method ? ` · ${t.payment_method}` : ''}`
                                  : 'Nenhum recebimento registrado nesta parcela.'}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone, icon: Icon }: { label: string; value: string; tone: 'primary' | 'success' | 'warning'; icon: any }) {
  const map = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
  };
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-3">
        <div className={`h-7 w-7 rounded-lg flex items-center justify-center mb-1.5 ${map[tone]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">{label}</p>
        <p className="text-sm sm:text-base font-bold font-display mt-0.5 truncate">{value}</p>
      </CardContent>
    </Card>
  );
}
