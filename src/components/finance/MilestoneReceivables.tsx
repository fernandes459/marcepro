import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, Clock, AlertTriangle, Milestone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatBRL } from '@/lib/format';
import { syncMilestoneToTransaction } from '@/lib/milestone-sync';

interface MilestoneWithBudget {
  id: string;
  budget_id: string;
  title: string;
  percentage: number;
  amount: number;
  status: string;
  due_date: string | null;
  paid_date: string | null;
  production_stage: string | null;
  sort_order: number;
  budget_code: string;
  budget_project: string | null;
  client_name: string | null;
  client_id: string | null;
  linked_transaction_id: string | null;
}

interface Client {
  id: string;
  name: string;
}

const STAGE_LABELS: Record<string, string> = {
  corte: 'Corte', usinagem: 'Usinagem', colagem: 'Colagem de Borda',
  furacao: 'Furação', pintura: 'Pintura/Acabamento', montagem_interna: 'Montagem Interna',
  embalagem: 'Embalagem', entrega: 'Entrega', montagem: 'Montagem Final',
};

export default function MilestoneReceivables() {
  const { user } = useAuth();
  const [milestones, setMilestones] = useState<MilestoneWithBudget[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClient, setFilterClient] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  async function fetchData() {
    if (!user) return;

    const [msRes, clientsRes] = await Promise.all([
      supabase
        .from('payment_milestones')
        .select('*, budgets!inner(code, project_name, client_id, status, clients(name))')
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('clients').select('id, name').order('name'),
    ]);

    if (msRes.data) {
      const mapped: MilestoneWithBudget[] = msRes.data
        .filter((m: any) => m.budgets?.status === 'approved' || m.budgets?.status === 'in_production')
        .map((m: any) => ({
          id: m.id,
          budget_id: m.budget_id,
          title: m.title,
          percentage: m.percentage,
          amount: m.amount,
          status: m.status,
          due_date: m.due_date,
          paid_date: m.paid_date,
          production_stage: m.production_stage,
          sort_order: m.sort_order,
          budget_code: m.budgets?.code || '',
          budget_project: m.budgets?.project_name,
          client_name: m.budgets?.clients?.name || null,
          client_id: m.budgets?.client_id || null,
          linked_transaction_id: m.linked_transaction_id || null,
        }));
      setMilestones(mapped);
    }
    if (clientsRes.data) setClients(clientsRes.data);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [user]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`milestone-receivables-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_milestones' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financial_transactions' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function markAsPaid(ms: MilestoneWithBudget) {
    const today = new Date().toISOString().slice(0, 10);

    // Update milestone
    const { error: msError } = await supabase
      .from('payment_milestones')
      .update({ status: 'paid', paid_date: today } as any)
      .eq('id', ms.id);

    if (msError) { toast.error('Erro ao atualizar marco'); return; }

    // Create income transaction for cash flow
    await supabase.from('financial_transactions').insert({
      user_id: user!.id,
      type: 'income',
      category: 'installment',
      description: `${ms.budget_code} - ${ms.title}`,
      amount: ms.amount,
      date: today,
      paid_date: today,
      status: 'paid',
      budget_id: ms.budget_id,
      client_id: ms.client_id,
    } as any);

    toast.success(`Marco "${ms.title}" marcado como pago — receita lançada no fluxo de caixa`);
    fetchData();
  }

  const filtered = useMemo(() => {
    return milestones.filter(m => {
      if (filterClient !== 'all' && m.client_id !== filterClient) return false;
      if (filterStatus !== 'all' && m.status !== filterStatus) return false;
      return true;
    });
  }, [milestones, filterClient, filterStatus]);

  const totalPending = filtered.filter(m => m.status === 'pending').reduce((s, m) => s + Number(m.amount), 0);
  const totalPaid = filtered.filter(m => m.status === 'paid').reduce((s, m) => s + Number(m.amount), 0);
  const today = new Date().toISOString().slice(0, 10);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Carregando marcos...</div>;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendente</p>
              <p className="text-lg font-bold font-display">{formatBRL(totalPending)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recebido</p>
              <p className="text-lg font-bold font-display">{formatBRL(totalPaid)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[180px] h-9 text-xs">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Clientes</SelectItem>
            {clients.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Milestone className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum marco encontrado</p>
            <p className="text-xs text-muted-foreground mt-1">Marcos aparecem aqui quando orçamentos são aprovados</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Orçamento</TableHead>
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs">Marco</TableHead>
                <TableHead className="text-xs">Fase</TableHead>
                <TableHead className="text-xs">Vencimento</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs w-[100px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(ms => {
                const isOverdue = ms.status === 'pending' && ms.due_date && ms.due_date < today;
                return (
                  <TableRow key={ms.id} className={isOverdue ? 'bg-destructive/5' : ''}>
                    <TableCell className="text-xs font-medium">
                      <div>{ms.budget_code}</div>
                      {ms.budget_project && <div className="text-[10px] text-muted-foreground">{ms.budget_project}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{ms.client_name || '—'}</TableCell>
                    <TableCell className="text-xs">{ms.title}</TableCell>
                    <TableCell className="text-xs">
                      {ms.production_stage ? (
                        <Badge variant="outline" className="text-[10px]">
                          {STAGE_LABELS[ms.production_stage] || ms.production_stage}
                        </Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        {isOverdue && <AlertTriangle className="h-3 w-3 text-destructive" />}
                        {ms.due_date
                          ? new Date(ms.due_date + 'T12:00:00').toLocaleDateString('pt-BR')
                          : '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-right font-bold">{formatBRL(ms.amount)}</TableCell>
                    <TableCell>
                      {ms.status === 'paid' ? (
                        <Badge className="bg-success/10 text-success text-[10px]">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Pago
                        </Badge>
                      ) : (
                        <Badge className={`text-[10px] ${isOverdue ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>
                          {isOverdue ? 'Vencido' : 'Pendente'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {ms.status !== 'paid' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] text-success hover:text-success"
                          onClick={() => markAsPaid(ms)}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Pagar
                        </Button>
                      )}
                      {ms.status === 'paid' && ms.paid_date && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(ms.paid_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
