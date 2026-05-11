import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2, Clock, AlertTriangle, Calendar, DollarSign,
  TrendingUp, FileText, User, CreditCard, Receipt,
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

export default function ReceivableDetailDialog({
  open, onOpenChange, selectedTx, allTransactions, clients, budgets, onMarkPaid,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const ctx = useMemo(() => {
    if (!selectedTx) return null;

    // Agrupa por orçamento (se existir) ou pelo cliente
    const related = allTransactions.filter(t => {
      if (selectedTx.budget_id) return t.budget_id === selectedTx.budget_id && t.type === selectedTx.type;
      if (selectedTx.client_id) return t.client_id === selectedTx.client_id && t.type === selectedTx.type;
      return t.id === selectedTx.id;
    });

    const sorted = related.slice().sort((a, b) => {
      const da = a.due_date || a.date;
      const db = b.due_date || b.date;
      return da.localeCompare(db);
    });

    const dec = (n: number | string) => new Decimal(n || 0);
    const totalContracted = sorted.reduce((s, t) => s.plus(dec(t.amount)), new Decimal(0));
    const totalPaid = sorted.filter(t => t.status === 'paid').reduce((s, t) => s.plus(dec(t.amount)), new Decimal(0));
    const totalOpen = sorted.filter(t => t.status !== 'paid' && t.status !== 'cancelled').reduce((s, t) => s.plus(dec(t.amount)), new Decimal(0));
    const overdue = sorted.filter(t => t.status === 'overdue' || (t.status === 'pending' && t.due_date && t.due_date < today));
    const overdueAmount = overdue.reduce((s, t) => s.plus(dec(t.amount)), new Decimal(0));
    const paidCount = sorted.filter(t => t.status === 'paid').length;
    const progress = totalContracted.gt(0) ? totalPaid.div(totalContracted).times(100).toNumber() : 0;

    const budget = selectedTx.budget_id ? budgets.find(b => b.id === selectedTx.budget_id) : null;
    const clientName = selectedTx.client_id ? clients.find(c => c.id === selectedTx.client_id)?.name : null;

    const nextDue = sorted.find(t => t.status !== 'paid' && t.status !== 'cancelled');
    const lastPaid = sorted.filter(t => t.status === 'paid').sort((a, b) =>
      (b.paid_date || b.date).localeCompare(a.paid_date || a.date),
    )[0];

    return {
      sorted, totalContracted: totalContracted.toNumber(), totalPaid: totalPaid.toNumber(),
      totalOpen: totalOpen.toNumber(), overdueCount: overdue.length, overdueAmount: overdueAmount.toNumber(),
      paidCount, progress, budget, clientName, nextDue, lastPaid,
    };
  }, [selectedTx, allTransactions, budgets, clients, today]);

  if (!selectedTx || !ctx) return null;

  const isIncome = selectedTx.type === 'income';
  const headerLabel = isIncome ? 'A Receber' : 'A Pagar';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-5 py-4 border-b bg-gradient-to-br from-primary/5 to-transparent">
          <DialogTitle className="font-display text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" /> Detalhes do {headerLabel}
          </DialogTitle>
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
            {ctx.budget && (
              <Badge variant="outline" className="text-[10px]">
                <FileText className="h-3 w-3 mr-1" /> {ctx.budget.code}
                {ctx.budget.project_name ? ` · ${ctx.budget.project_name}` : ''}
              </Badge>
            )}
            {ctx.clientName && (
              <Badge variant="outline" className="text-[10px]">
                <User className="h-3 w-3 mr-1" /> {ctx.clientName}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-5 space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <KpiCard label="Total contratado" value={formatBRL(ctx.totalContracted)} icon={DollarSign} tone="primary" />
            <KpiCard label="Já pago" value={formatBRL(ctx.totalPaid)} icon={CheckCircle2} tone="success" />
            <KpiCard label="Em aberto" value={formatBRL(ctx.totalOpen)} icon={Clock} tone="warning" />
            <KpiCard
              label={ctx.overdueCount > 0 ? `Vencido (${ctx.overdueCount})` : 'Vencido'}
              value={formatBRL(ctx.overdueAmount)}
              icon={AlertTriangle}
              tone={ctx.overdueCount > 0 ? 'destructive' : 'muted'}
            />
          </div>

          {/* Progresso */}
          <Card className="border-0 bg-accent/30">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Progresso de pagamento</span>
                <span className="font-bold">
                  {ctx.paidCount}/{ctx.sorted.length} parcelas · {ctx.progress.toFixed(0)}%
                </span>
              </div>
              <Progress value={ctx.progress} className="h-2.5" />
              <div className="flex justify-between text-[10px] text-muted-foreground pt-1">
                <span>Recebido: <strong className="text-success">{formatBRL(ctx.totalPaid)}</strong></span>
                <span>Restante: <strong className="text-warning">{formatBRL(ctx.totalOpen)}</strong></span>
              </div>
            </CardContent>
          </Card>

          {/* Próximo vencimento + último pago */}
          <div className="grid sm:grid-cols-2 gap-2.5">
            {ctx.nextDue && (
              <Card className="border-l-4 border-l-warning">
                <CardContent className="p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Próximo a vencer
                  </p>
                  <p className="text-sm font-bold mt-1 truncate">{ctx.nextDue.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {ctx.nextDue.due_date
                      ? new Date(ctx.nextDue.due_date + 'T12:00:00').toLocaleDateString('pt-BR')
                      : 'Sem data'} · <strong>{formatBRL(ctx.nextDue.amount)}</strong>
                  </p>
                </CardContent>
              </Card>
            )}
            {ctx.lastPaid && (
              <Card className="border-l-4 border-l-success">
                <CardContent className="p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Último pagamento
                  </p>
                  <p className="text-sm font-bold mt-1 truncate">{ctx.lastPaid.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date((ctx.lastPaid.paid_date || ctx.lastPaid.date) + 'T12:00:00').toLocaleDateString('pt-BR')}
                    {' · '}<strong>{formatBRL(ctx.lastPaid.amount)}</strong>
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Histórico completo */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Histórico de parcelas
            </h3>
            <div className="space-y-2">
              {ctx.sorted.map((t, idx) => {
                const isPaid = t.status === 'paid';
                const isOverdue = t.status === 'overdue' || (t.status === 'pending' && t.due_date && t.due_date < today);
                const isSelected = t.id === selectedTx.id;
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
                    className={`border-l-4 rounded-r-lg p-3 ${tone.split(' ').slice(2).join(' ')} ${
                      isSelected ? 'ring-2 ring-primary/40' : ''
                    } bg-card`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${tone.split(' ').slice(0, 2).join(' ')}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold text-muted-foreground">#{idx + 1}</span>
                            <p className="text-sm font-medium truncate">{t.description}</p>
                            {isSelected && <Badge variant="outline" className="text-[9px]">Selecionado</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                            {t.due_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Vence {new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
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
                                Pago em {new Date(t.paid_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                              </span>
                            )}
                            {t.payment_method && (
                              <span className="flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                {t.payment_method}
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
          </div>
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
