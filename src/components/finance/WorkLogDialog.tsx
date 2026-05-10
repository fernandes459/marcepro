import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/CurrencyInput';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatBRL } from '@/lib/format';
import Decimal from 'decimal.js';

interface Employee { id: string; name: string; hourly_rate?: number; daily_rate?: number; }
interface BudgetLite { id: string; project_name: string | null; code: string; client_id: string | null; }
interface ClientLite { id: string; name: string; }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  employees: Employee[];
  budgets: BudgetLite[];
  clients: ClientLite[];
  onSaved: () => void;
  editLog?: any;
}

export function WorkLogDialog({ open, onOpenChange, userId, employees, budgets, clients, onSaved, editLog }: Props) {
  const [mode, setMode] = useState<'hours' | 'days'>('hours');
  const [employeeId, setEmployeeId] = useState('');
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState(8);
  const [days, setDays] = useState(1);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [dailyRate, setDailyRate] = useState(0);
  const [budgetId, setBudgetId] = useState('');
  const [clientId, setClientId] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editLog) {
      setMode(Number(editLog.days_worked) > 0 && Number(editLog.hours_worked) === 0 ? 'days' : 'hours');
      setEmployeeId(editLog.employee_id);
      setWorkDate(editLog.work_date);
      setHours(Number(editLog.hours_worked));
      setDays(Number(editLog.days_worked));
      setHourlyRate(Number(editLog.hourly_rate));
      setDailyRate(Number(editLog.daily_rate));
      setBudgetId(editLog.budget_id || '');
      setClientId(editLog.client_id || '');
      setDescription(editLog.description || '');
    } else {
      setMode('hours');
      setEmployeeId('');
      setWorkDate(new Date().toISOString().slice(0, 10));
      setHours(8);
      setDays(1);
      setHourlyRate(0);
      setDailyRate(0);
      setBudgetId('');
      setClientId('');
      setDescription('');
    }
  }, [editLog, open]);

  // Auto-fill rates from employee
  useEffect(() => {
    const emp = employees.find(e => e.id === employeeId);
    if (emp && !editLog) {
      if (emp.hourly_rate) setHourlyRate(Number(emp.hourly_rate));
      if (emp.daily_rate) setDailyRate(Number(emp.daily_rate));
    }
  }, [employeeId, employees, editLog]);

  // Auto-fill client from budget
  useEffect(() => {
    if (budgetId) {
      const b = budgets.find(x => x.id === budgetId);
      if (b?.client_id) setClientId(b.client_id);
    }
  }, [budgetId, budgets]);

  const total = mode === 'hours'
    ? new Decimal(hours || 0).times(hourlyRate || 0).toNumber()
    : new Decimal(days || 0).times(dailyRate || 0).toNumber();

  async function handleSave() {
    if (!employeeId) { toast.error('Selecione o colaborador'); return; }
    if (total <= 0) { toast.error('Informe horas/dias e valor'); return; }
    const payload = {
      user_id: userId,
      employee_id: employeeId,
      work_date: workDate,
      hours_worked: mode === 'hours' ? hours : 0,
      days_worked: mode === 'days' ? days : 0,
      hourly_rate: hourlyRate,
      daily_rate: dailyRate,
      total_amount: total,
      budget_id: budgetId || null,
      client_id: clientId || null,
      description: description || null,
    };
    const res = editLog
      ? await supabase.from('collaborator_work_logs' as any).update(payload as any).eq('id', editLog.id)
      : await supabase.from('collaborator_work_logs' as any).insert(payload as any);
    if (res.error) { toast.error('Erro ao salvar'); console.error(res.error); return; }
    toast.success(editLog ? 'Registro atualizado' : 'Horas registradas!');
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{editLog ? 'Editar registro' : 'Registrar horas/dias'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Colaborador *</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder="Selecionar colaborador" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {employees.length === 0 && (
              <p className="text-xs text-muted-foreground">Cadastre colaboradores em Gestão → Equipe.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={workDate} onChange={e => setWorkDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Modo</Label>
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'hours' | 'days')}>
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="hours">Horas</TabsTrigger>
                  <TabsTrigger value="days">Dias</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {mode === 'hours' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Horas trabalhadas</Label>
                <Input type="number" step="0.5" min="0" value={hours} onChange={e => setHours(Number(e.target.value))} onFocus={e => e.target.select()} />
              </div>
              <div className="space-y-2">
                <Label>Valor por hora</Label>
                <CurrencyInput value={hourlyRate} onChange={setHourlyRate} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Dias trabalhados</Label>
                <Input type="number" step="0.5" min="0" value={days} onChange={e => setDays(Number(e.target.value))} onFocus={e => e.target.select()} />
              </div>
              <div className="space-y-2">
                <Label>Valor por dia (diária)</Label>
                <CurrencyInput value={dailyRate} onChange={setDailyRate} />
              </div>
            </div>
          )}

          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-bold text-primary">Total a pagar</span>
            <span className="text-2xl font-bold font-display text-primary tabular-nums">{formatBRL(total)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Obra (opcional)</Label>
              <Select value={budgetId || 'none'} onValueChange={v => setBudgetId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Vincular obra" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {budgets.map(b => <SelectItem key={b.id} value={b.id}>{b.code} — {b.project_name || 'Sem nome'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clientId || 'none'} onValueChange={v => setClientId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Montagem de armário no quarto" />
          </div>

          <Button className="w-full gradient-primary border-0 h-11" onClick={handleSave}>
            {editLog ? 'Salvar alterações' : 'Registrar horas'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
