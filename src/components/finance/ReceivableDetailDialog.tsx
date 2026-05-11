import { useMemo, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  CheckCircle2, Clock, AlertTriangle, Calendar, DollarSign,
  TrendingUp, FileText, User, CreditCard, Receipt, ChevronDown, ChevronRight,
  Layers,
} from 'lucide-react';
import Decimal from 'decimal.js';
import { formatBRL } from '@/lib/format';

export interface DetailTx {
  id: string;
  type: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  due_date: string | null;
  paid_date: string | null;
  status: string;
  payment_method: string | null;
  client_id: string | null;
  budget_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTx: DetailTx | null;
  allTransactions: DetailTx[];
  clients: { id: string; name: string }[];
  budgets: { id: string; project_name: string | null; code: string; client_id: string | null; final_price?: number }[];
  onMarkPaid: (id: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'Pago', pending: 'Pendente', overdue: 'Vencido', cancelled: 'Cancelado',
};

interface Group {
  key: string;
  label: string;
  sublabel?: string;
  budget?: { id: string; code: string; project_name: string | null } | null;
  clientName?: string | null;
  txs: DetailTx[];
  totalContracted: number;
  totalPaid: number;
  totalOpen: number;
  overdueAmount: number;
  overdueCount: number;
  paidCount: number;
  progress: number;
  hasSelected: boolean;
  nextDue: DetailTx | null;
}

export default function ReceivableDetailDialog({
  open, onOpenChange, selectedTx, allTransactions, clients, budgets, onMarkPaid,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const { groups, totals, selectedGroupKey } = useMemo(() => {
    if (!selectedTx) {
      return { groups: [] as Group[], totals: null as any, selectedGroupKey: '' };
    }

    // Considera todas as transações do mesmo tipo (income/expense) ainda relevantes
    const sameType = allTransactions.filter(t => t.type === selectedTx.type && t.status !== 'cancelled');

    const dec = (n: number | string) => new Decimal(n || 0);
    const groupsMap = new Map<string, DetailTx[]>();
    const keyOf = (t: DetailTx) => {
      if (t.budget_id) return `b:${t.budget_id}`;
      if (t.client_id) return `c:${t.client_id}`;
      return `t:${t.id}`;
    };

    for (const t of sameType) {
      const k = keyOf(t);
      if (!groupsMap.has(k)) groupsMap.set(k, []);
      groupsMap.get(k)!.push(t);
    }

    const selKey = keyOf(selectedTx);

    const built: Group[] = [];
    for (const [key, txs] of groupsMap.entries()) {
      const sorted = txs.slice().sort((a, b) =>
        (a.due_date || a.date).localeCompare(b.due_date || b.date),
      );
      const totalContracted = sorted.reduce((s, t) => s.plus(dec(t.amount)), new Decimal(0));
      const totalPaid = sorted.filter(t => t.status === 'paid').reduce((s, t) => s.plus(dec(t.amount)), new Decimal(0));
      const totalOpen = sorted.filter(t => t.status !== 'paid').reduce((s, t) => s.plus(dec(t.amount)), new Decimal(0));
      const overdue = sorted.filter(t => t.status === 'overdue' || (t.status === 'pending' && t.due_date && t.due_date < today));
      const overdueAmount = overdue.reduce((s, t) => s.plus(dec(t.amount)), new Decimal(0));
      const paidCount = sorted.filter(t => t.status === 'paid').length;
      const progress = totalContracted.gt(0) ? totalPaid.div(totalContracted).times(100).toNumber() : 0;
      const nextDue = sorted.find(t => t.status !== 'paid') || null;

      const first = sorted[0];
      const budget = first.budget_id ? budgets.find(b => b.id === first.budget_id) : null;
      const clientId = first.client_id || budget?.client_id || null;
      const clientName = clientId ? clients.find(c => c.id === clientId)?.name || null : null;

      const label = budget ? `${budget.code}${budget.project_name ? ' · ' + budget.project_name : ''}`
        : clientName ? clientName
        : first.description;
      const sublabel = budget ? clientName || undefined : undefined;

      built.push({
        key, label, sublabel,
        budget: budget ? { id: budget.id, code: budget.code, project_name: budget.project_name } : null,
        clientName,
        txs: sorted,
        totalContracted: totalContracted.toNumber(),
        totalPaid: totalPaid.toNumber(),
        totalOpen: totalOpen.toNumber(),
        overdueAmount: overdueAmount.toNumber(),
        overdueCount: overdue.length,
        paidCount,
        progress,
        hasSelected: key === selKey,
        nextDue,
      });
    }

    // Ordena: grupo selecionado primeiro, depois por valor em aberto desc
    built.sort((a, b) => {
      if (a.hasSelected !== b.hasSelected) return a.hasSelected ? -1 : 1;
      return b.totalOpen - a.totalOpen;
    });

    const sumTotals = built.reduce(
      (acc, g) => ({
        contracted: acc.contracted + g.totalContracted,
        paid: acc.paid + g.totalPaid,
        open: acc.open + g.totalOpen,
        overdue: acc.overdue + g.overdueAmount,
        overdueCount: acc.overdueCount + g.overdueCount,
      }),
      { contracted: 0, paid: 0, open: 0, overdue: 0, overdueCount: 0 },
    );

    return { groups: built, totals: sumTotals, selectedGroupKey: selKey };
  }, [selectedTx, allTransactions, budgets, clients, today]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Sempre que abrir o modal/trocar seleção, expande apenas o grupo selecionado
  useEffect(() => {
    if (!open || !selectedGroupKey) return;
    setOpenGroups({ [selectedGroupKey]: true });
  }, [open, selectedGroupKey]);

  if (!selectedTx || !totals) return null;

  const isIncome = selectedTx.type === 'income';
  const headerLabel = isIncome ? 'A Receber' : 'A Pagar';
  const allOpen = groups.length > 0 && groups.every(g => openGroups[g.key]);

  const toggleAll = () => {
    if (allOpen) setOpenGroups({});
    else setOpenGroups(Object.fromEntries(groups.map(g => [g.key, true])));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-5 py-4 border-b bg-gradient-to-br from-primary/5 to-transparent">
          <DialogTitle className="font-display text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" /> Detalhes do {headerLabel}
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-1">
            Agrupado por orçamento/cliente — clique para expandir e analisar parcelas.
          </p>
        </DialogHeader>

        <div className="p-4 sm:p-5 space-y-4">
          {/* KPIs gerais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <KpiCard label="Total contratado" value={formatBRL(totals.contracted)} icon={DollarSign} tone="primary" />
            <KpiCard label="Já pago" value={formatBRL(totals.paid)} icon={CheckCircle2} tone="success" />
            <KpiCard label="Em aberto" value={formatBRL(totals.open)} icon={Clock} tone="warning" />
            <KpiCard
              label={totals.overdueCount > 0 ? `Vencido (${totals.overdueCount})` : 'Vencido'}
              value={formatBRL(totals.overdue)}
              icon={AlertTriangle}
              tone={totals.overdueCount > 0 ? 'destructive' : 'muted'}
            />
          </div>

          {/* Cabeçalho lista grupos */}
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" /> Origens ({groups.length})
            </h3>
            {groups.length > 1 && (
              <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={toggleAll}>
                {allOpen ? 'Recolher tudo' : 'Expandir tudo'}
              </Button>
            )}
          </div>

          {/* Grupos colapsáveis */}
          <div className="space-y-2.5">
            {groups.map(g => {
              const isOpen = !!openGroups[g.key];
              return (
                <Collapsible
                  key={g.key}
                  open={isOpen}
                  onOpenChange={(v) => setOpenGroups(s => ({ ...s, [g.key]: v }))}
                >
                  <Card className={`overflow-hidden ${g.hasSelected ? 'ring-1 ring-primary/40' : ''}`}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="w-full text-left p-3 hover:bg-accent/40 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {g.budget ? (
                                <Badge variant="outline" className="text-[10px]">
                                  <FileText className="h-3 w-3 mr-1" /> {g.budget.code}
                                </Badge>
                              ) : g.clientName ? (
                                <Badge variant="outline" className="text-[10px]">
                                  <User className="h-3 w-3 mr-1" /> Cliente
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">Avulso</Badge>
                              )}
                              <p className="text-sm font-bold truncate">{g.label}</p>
                              {g.hasSelected && (
                                <Badge variant="outline" className="text-[9px] border-primary text-primary">Selecionado</Badge>
                              )}
                            </div>
                            {g.sublabel && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                                <User className="h-3 w-3" /> {g.sublabel}
                              </p>
                            )}
                            <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                              <div>
                                <p className="text-muted-foreground">Em aberto</p>
                                <p className="font-bold text-warning">{formatBRL(g.totalOpen)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Pago</p>
                                <p className="font-bold text-success">{formatBRL(g.totalPaid)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Vencido</p>
                                <p className={`font-bold ${g.overdueCount ? 'text-destructive' : 'text-muted-foreground'}`}>
                                  {formatBRL(g.overdueAmount)}
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <Progress value={g.progress} className="h-1.5 flex-1" />
                              <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                                {g.paidCount}/{g.txs.length} · {g.progress.toFixed(0)}%
                              </span>
                            </div>
                            {g.nextDue?.due_date && (
                              <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Próx.: {new Date(g.nextDue.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                {' · '}<strong>{formatBRL(g.nextDue.amount)}</strong>
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t bg-muted/20 p-3 space-y-2">
                        {g.txs.map((t, idx) => {
                          const isPaid = t.status === 'paid';
                          const isOverdue = t.status === 'overdue' || (t.status === 'pending' && t.due_date && t.due_date < today);
                          const isSel = t.id === selectedTx.id;
                          const Icon = isPaid ? CheckCircle2 : isOverdue ? AlertTriangle : Clock;
                          const tone = isPaid ? 'text-success bg-success/10 border-l-success'
                            : isOverdue ? 'text-destructive bg-destructive/10 border-l-destructive'
                            : 'text-warning bg-warning/10 border-l-warning';

                          const daysToDue = t.due_date
                            ? Math.ceil((new Date(t.due_date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000)
                            : null;

                          return (
                            <div
                              key={t.id}
                              className={`border-l-4 rounded-r-lg p-2.5 bg-card ${tone.split(' ').slice(2).join(' ')} ${isSel ? 'ring-2 ring-primary/40' : ''}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${tone.split(' ').slice(0, 2).join(' ')}`}>
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[10px] font-bold text-muted-foreground">#{idx + 1}</span>
                                      <p className="text-sm font-medium truncate">{t.description}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                                      {t.due_date && (
                                        <span className="flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          {new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                          {!isPaid && daysToDue !== null && (
                                            <span className={`font-semibold ${isOverdue ? 'text-destructive' : daysToDue <= 3 ? 'text-warning' : ''}`}>
                                              {' · '}
                                              {isOverdue ? `${Math.abs(daysToDue)}d atrasado` : daysToDue === 0 ? 'hoje' : `em ${daysToDue}d`}
                                            </span>
                                          )}
                                        </span>
                                      )}
                                      {isPaid && t.paid_date && (
                                        <span className="flex items-center gap-1 text-success">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Pago {new Date(t.paid_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        </span>
                                      )}
                                      {t.payment_method && (
                                        <span className="flex items-center gap-1">
                                          <CreditCard className="h-3 w-3" /> {t.payment_method}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={`text-sm font-bold ${isIncome ? 'text-success' : 'text-destructive'}`}>
                                    {isIncome ? '+' : '−'} {formatBRL(t.amount)}
                                  </p>
                                  <Badge className={`text-[9px] mt-0.5 ${
                                    isPaid ? 'bg-success/15 text-success'
                                    : isOverdue ? 'bg-destructive/15 text-destructive'
                                    : 'bg-warning/15 text-warning'
                                  }`}>
                                    {isOverdue && !isPaid ? 'Vencido' : STATUS_LABELS[t.status]}
                                  </Badge>
                                  {!isPaid && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="mt-1.5 h-6 text-[10px] px-2"
                                      onClick={() => onMarkPaid(t.id)}
                                    >
                                      {isIncome ? 'Receber' : 'Pagar'}
                                    </Button>
                                  )}
                                </div>
                              </div>
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

          <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1">
            <TrendingUp className="h-3 w-3" /> Mostrando todas as origens com lançamentos de {isIncome ? 'receita' : 'despesa'}.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({
  label, value, icon: Icon, tone,
}: { label: string; value: string; icon: any; tone: 'primary' | 'success' | 'warning' | 'destructive' | 'muted' }) {
  const map = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    destructive: 'text-destructive bg-destructive/10',
    muted: 'text-muted-foreground bg-muted/40',
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
