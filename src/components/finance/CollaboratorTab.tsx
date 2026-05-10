import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Clock, CheckCircle2, Users, Receipt, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatBRL } from '@/lib/format';
import { WorkLogDialog } from './WorkLogDialog';

interface Employee { id: string; name: string; hourly_rate?: number; daily_rate?: number; role?: string; }
interface BudgetLite { id: string; project_name: string | null; code: string; client_id: string | null; }
interface ClientLite { id: string; name: string; }
interface BankAcc { id: string; name: string; current_balance: number; }

interface WorkLog {
  id: string;
  employee_id: string;
  work_date: string;
  hours_worked: number;
  days_worked: number;
  hourly_rate: number;
  daily_rate: number;
  total_amount: number;
  budget_id: string | null;
  client_id: string | null;
  description: string | null;
  status: string;
  linked_transaction_id: string | null;
}

interface Props {
  userId: string;
  budgets: BudgetLite[];
  clients: ClientLite[];
  bankAccounts: BankAcc[];
  onChange?: () => void;
}

export default function CollaboratorTab({ userId, budgets, clients, bankAccounts, onChange }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLog, setEditLog] = useState<WorkLog | null>(null);
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>(today.slice(0, 7));
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [defaultAcc, setDefaultAcc] = useState<string>(bankAccounts.find(a => (a as any).is_main)?.id || bankAccounts[0]?.id || '');

  useEffect(() => {
    if (!defaultAcc && bankAccounts[0]) setDefaultAcc(bankAccounts[0].id);
  }, [bankAccounts, defaultAcc]);

  const fetchAll = useCallback(async () => {
    const [empRes, logsRes] = await Promise.all([
      supabase.from('employees').select('id, name, hourly_rate, daily_rate, role').eq('status', 'active').order('name'),
      supabase.from('collaborator_work_logs' as any).select('*').order('work_date', { ascending: false }),
    ]);
    if (empRes.data) setEmployees(empRes.data as Employee[]);
    if (logsRes.data) setLogs(logsRes.data as unknown as WorkLog[]);
  }, []);

  useEffect(() => {
    void fetchAll();
    const ch = supabase
      .channel(`worklogs-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collaborator_work_logs' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll, userId]);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      if (filterEmployee !== 'all' && l.employee_id !== filterEmployee) return false;
      if (filterMonth && !l.work_date.startsWith(filterMonth)) return false;
      if (filterStatus !== 'all' && l.status !== filterStatus) return false;
      return true;
    });
  }, [logs, filterEmployee, filterMonth, filterStatus]);

  const summary = useMemo(() => {
    const byEmp: Record<string, { name: string; hours: number; days: number; total: number; pending: number; pendingTotal: number }> = {};
    filtered.forEach(l => {
      const emp = employees.find(e => e.id === l.employee_id);
      if (!byEmp[l.employee_id]) {
        byEmp[l.employee_id] = { name: emp?.name || '—', hours: 0, days: 0, total: 0, pending: 0, pendingTotal: 0 };
      }
      byEmp[l.employee_id].hours += Number(l.hours_worked);
      byEmp[l.employee_id].days += Number(l.days_worked);
      byEmp[l.employee_id].total += Number(l.total_amount);
      if (l.status === 'pending') {
        byEmp[l.employee_id].pending += 1;
        byEmp[l.employee_id].pendingTotal += Number(l.total_amount);
      }
    });
    return Object.values(byEmp).sort((a, b) => b.total - a.total);
  }, [filtered, employees]);

  const totals = useMemo(() => ({
    total: filtered.reduce((s, l) => s + Number(l.total_amount), 0),
    pending: filtered.filter(l => l.status === 'pending').reduce((s, l) => s + Number(l.total_amount), 0),
    paid: filtered.filter(l => l.status === 'paid').reduce((s, l) => s + Number(l.total_amount), 0),
    hours: filtered.reduce((s, l) => s + Number(l.hours_worked), 0),
    days: filtered.reduce((s, l) => s + Number(l.days_worked), 0),
  }), [filtered]);

  async function handleDelete(id: string) {
    if (!window.confirm('Excluir este registro?')) return;
    const log = logs.find(l => l.id === id);
    if (log?.linked_transaction_id) {
      await supabase.from('financial_transactions').delete().eq('id', log.linked_transaction_id);
    }
    await supabase.from('collaborator_work_logs' as any).delete().eq('id', id);
    toast.success('Registro removido');
    fetchAll();
    onChange?.();
  }

  async function generateExpense(log: WorkLog) {
    const emp = employees.find(e => e.id === log.employee_id);
    if (!emp) { toast.error('Colaborador não encontrado'); return; }
    if (!defaultAcc) { toast.error('Cadastre uma conta bancária primeiro'); return; }
    const desc = `Pagamento ${emp.name} — ${log.hours_worked > 0 ? `${log.hours_worked}h` : `${log.days_worked} dia(s)`}${log.description ? ` (${log.description})` : ''}`;
    const { data, error } = await supabase.from('financial_transactions').insert({
      user_id: userId,
      type: 'expense',
      category: 'salary',
      subcategory: emp.name,
      description: desc,
      amount: Number(log.total_amount),
      date: log.work_date,
      due_date: log.work_date,
      status: 'pending',
      payment_method: 'transfer',
      client_id: log.client_id,
      budget_id: log.budget_id,
      bank_account_id: defaultAcc,
      notes: `Gerado a partir de horas trabalhadas — ${log.work_date}`,
    } as any).select().single();
    if (error || !data) { toast.error('Erro ao gerar despesa'); return; }
    await supabase.from('collaborator_work_logs' as any).update({
      status: 'paid', linked_transaction_id: data.id,
    } as any).eq('id', log.id);
    toast.success('Despesa criada no financeiro');
    fetchAll();
    onChange?.();
  }

  async function generateBatch() {
    const pending = filtered.filter(l => l.status === 'pending');
    if (pending.length === 0) { toast.info('Sem registros pendentes'); return; }
    if (!window.confirm(`Gerar ${pending.length} despesa(s) no financeiro?`)) return;
    for (const log of pending) {
      await generateExpense(log);
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total no período</p>
            <p className="text-xl font-bold font-display text-primary mt-1 tabular-nums">{formatBRL(totals.total)}</p>
            <p className="text-[10px] text-muted-foreground">{totals.hours.toFixed(1)}h • {totals.days} dia(s)</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-warning">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">A pagar</p>
            <p className="text-xl font-bold font-display text-warning mt-1 tabular-nums">{formatBRL(totals.pending)}</p>
            <p className="text-[10px] text-muted-foreground">pendente</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-success">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pago</p>
            <p className="text-xl font-bold font-display text-success mt-1 tabular-nums">{formatBRL(totals.paid)}</p>
            <p className="text-[10px] text-muted-foreground">já lançado</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-info">
          <CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Colaboradores ativos</p>
            <p className="text-xl font-bold font-display text-info mt-1 tabular-nums">{employees.length}</p>
            <p className="text-[10px] text-muted-foreground">cadastrados</p>
          </CardContent>
        </Card>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2 items-end">
        <Button className="gradient-primary border-0" onClick={() => { setEditLog(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Registrar horas
        </Button>
        {totals.pending > 0 && (
          <Button variant="outline" onClick={generateBatch}>
            <Receipt className="h-4 w-4 mr-1" /> Gerar despesas pendentes
          </Button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Colaborador" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os colaboradores</SelectItem>
              {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
            </SelectContent>
          </Select>
          <input
            type="month"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
          {bankAccounts.length > 0 && (
            <Select value={defaultAcc} onValueChange={setDefaultAcc}>
              <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Conta destino" /></SelectTrigger>
              <SelectContent>
                {bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Per-employee summary */}
      {summary.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-bold flex items-center gap-2">
              <Users className="h-4 w-4" /> Resumo por colaborador
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {summary.map(s => (
                <li key={s.name} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.hours.toFixed(1)}h • {s.days} dia(s){s.pending > 0 ? ` • ${s.pending} pendente(s)` : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tabular-nums">{formatBRL(s.total)}</p>
                    {s.pendingTotal > 0 && (
                      <p className="text-[10px] text-warning">A pagar: {formatBRL(s.pendingTotal)}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Logs list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-bold flex items-center gap-2">
            <Clock className="h-4 w-4" /> Registros de horas ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum registro neste filtro.</p>
              <Button size="sm" className="mt-3 gradient-primary border-0" onClick={() => { setEditLog(null); setDialogOpen(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Registrar primeiro
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map(log => {
                const emp = employees.find(e => e.id === log.employee_id);
                const budget = budgets.find(b => b.id === log.budget_id);
                const client = clients.find(c => c.id === log.client_id);
                const isPaid = log.status === 'paid';
                return (
                  <motion.li
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group flex items-center gap-3 px-4 py-3 hover:bg-accent/40"
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isPaid ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                      {isPaid ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">{emp?.name || '—'}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {log.hours_worked > 0 ? `${log.hours_worked}h` : `${log.days_worked} dia(s)`}
                        </Badge>
                        {budget && <span className="text-[10px] bg-accent rounded px-1.5 py-0.5">{budget.code}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {new Date(log.work_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        {client ? ` • ${client.name}` : ''}
                        {log.description ? ` • ${log.description}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular-nums">{formatBRL(Number(log.total_amount))}</p>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold mt-0.5 ${isPaid ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                        {isPaid ? 'Pago' : 'Pendente'}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!isPaid && (
                        <Button size="sm" variant="ghost" className="h-8 text-xs rounded-full" onClick={() => generateExpense(log)} title="Gerar despesa no financeiro">
                          <Receipt className="h-3.5 w-3.5 mr-1" /> Gerar
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => { setEditLog(log); setDialogOpen(true); }} title="Editar">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => handleDelete(log.id)} title="Excluir">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <WorkLogDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditLog(null); }}
        userId={userId}
        employees={employees}
        budgets={budgets}
        clients={clients}
        editLog={editLog}
        onSaved={() => { fetchAll(); onChange?.(); }}
      />
    </div>
  );
}

export function getPendingWorkLogsTotal(logs: { status: string; total_amount: number }[]) {
  return logs.filter(l => l.status === 'pending').reduce((s, l) => s + Number(l.total_amount), 0);
}
