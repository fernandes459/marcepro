import { useState, useEffect } from 'react';
import {
  ArrowUpRight, ArrowDownRight, Plus, Trash2, CreditCard, Banknote,
  Smartphone, Receipt, Building2, Landmark, CircleDollarSign,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { CurrencyInput } from '@/components/CurrencyInput';
import { formatBRL } from '@/lib/format';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FinancialCategoryOption, mergeFinancialCategories } from '@/lib/financial';

interface Client { id: string; name: string; }
interface BankAccount { id: string; name: string; bank_name: string | null; current_balance: number; }
interface BudgetLite { id: string; project_name: string | null; code: string; client_id: string | null; }
interface EmployeeLite { id: string; name: string; }

const LABOR_CATEGORIES = ['salary', 'labor', 'commission'];

interface PaymentSplit {
  id: string;
  method: string;
  amount: number;
  installments: number;
  machineDiscount: number;
}

const paymentMethods = [
  { value: 'pix', label: 'PIX', icon: Smartphone },
  { value: 'cash', label: 'Dinheiro', icon: Banknote },
  { value: 'credit', label: 'Cartão Crédito', icon: CreditCard },
  { value: 'debit', label: 'Cartão Débito', icon: CreditCard },
  { value: 'transfer', label: 'Transferência', icon: Landmark },
  { value: 'boleto', label: 'Boleto', icon: Receipt },
  { value: 'cheque', label: 'Cheque', icon: Receipt },
];

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  clients: Client[];
  bankAccounts: BankAccount[];
  budgets?: BudgetLite[];
  onSaved: () => void;
  editTransaction?: {
    id: string; type: string; category: string; description: string;
    amount: number; date: string; due_date: string | null; status: string;
    is_fixed: boolean; recurrence: string; notes: string | null;
    client_id: string | null; order_number: string | null;
    bank_account_id: string | null; payment_method: string | null;
    budget_id?: string | null;
  } | null;
}

export function TransactionDialog({ open, onOpenChange, userId, clients, bankAccounts, budgets = [], onSaved, editTransaction }: TransactionDialogProps) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('pending');
  const [isFixed, setIsFixed] = useState(false);
  const [recurrence, setRecurrence] = useState('monthly');
  const [notes, setNotes] = useState('');
  const [clientId, setClientId] = useState('');
  const [budgetId, setBudgetId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);

  useEffect(() => {
    supabase.from('employees').select('id, name').eq('status', 'active').order('name').then(({ data }) => {
      if (data) setEmployees(data as EmployeeLite[]);
    });
  }, []);

  // Split payments
  const [useSplitPayment, setUseSplitPayment] = useState(false);
  const [payments, setPayments] = useState<PaymentSplit[]>([
    { id: '1', method: 'pix', amount: 0, installments: 1, machineDiscount: 0 },
  ]);
  const [customCategories, setCustomCategories] = useState<FinancialCategoryOption[]>([]);

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

  const categories = mergeFinancialCategories(customCategories).filter((item) => item.type === type);

  // Load edit data when editTransaction changes
  useEffect(() => {
    if (editTransaction && open) {
      setType(editTransaction.type as 'income' | 'expense');
      setCategory(editTransaction.category);
      setDescription(editTransaction.description);
      setTotalAmount(Number(editTransaction.amount));
      setDate(editTransaction.date);
      setDueDate(editTransaction.due_date || '');
      setStatus(editTransaction.status);
      setIsFixed(editTransaction.is_fixed);
      setRecurrence(editTransaction.recurrence || 'monthly');
      setNotes(editTransaction.notes || '');
      setClientId(editTransaction.client_id || '');
      setBudgetId(editTransaction.budget_id || '');
      setOrderNumber(editTransaction.order_number || '');
      setBankAccountId(editTransaction.bank_account_id || '');
      setSubcategory((editTransaction as any).subcategory || '');
      // Parse payment method
      if (editTransaction.payment_method && editTransaction.payment_method.includes('|')) {
        setUseSplitPayment(true);
      } else {
        setUseSplitPayment(false);
        const method = editTransaction.payment_method || 'pix';
        const validMethod = paymentMethods.find(m => m.value === method || m.label === method);
        setPayments([{ id: '1', method: validMethod?.value || 'pix', amount: Number(editTransaction.amount), installments: 1, machineDiscount: 0 }]);
      }
    }
  }, [editTransaction, open]);

  function resetForm() {
    setType('expense'); setCategory(''); setDescription(''); setTotalAmount(0);
    setDate(new Date().toISOString().slice(0, 10)); setDueDate(''); setStatus('pending');
    setIsFixed(false); setRecurrence('monthly'); setNotes(''); setClientId(''); setBudgetId('');
    setOrderNumber(''); setBankAccountId(''); setUseSplitPayment(false);
    setSubcategory('');
    setPayments([{ id: '1', method: 'pix', amount: 0, installments: 1, machineDiscount: 0 }]);
  }

  function addPayment() {
    setPayments([...payments, {
      id: Date.now().toString(), method: 'credit', amount: 0, installments: 1, machineDiscount: 0,
    }]);
  }

  function removePayment(id: string) {
    if (payments.length <= 1) return;
    setPayments(payments.filter(p => p.id !== id));
  }

  function updatePayment(id: string, field: keyof PaymentSplit, value: any) {
    setPayments(payments.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  // Auto-distribute remaining to first payment
  useEffect(() => {
    if (useSplitPayment && payments.length === 1) {
      updatePayment(payments[0].id, 'amount', totalAmount);
    }
  }, [totalAmount, useSplitPayment]);

  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);
  const totalAfterDiscounts = payments.reduce((s, p) => {
    const discount = (p.method === 'credit' || p.method === 'debit') ? p.machineDiscount : 0;
    return s + p.amount * (1 - discount / 100);
  }, 0);
  const totalDiscounts = totalPayments - totalAfterDiscounts;
  const remaining = totalAmount - totalPayments;

  function getPaymentSummary(): string {
    if (!useSplitPayment) return '';
    return payments.map(p => {
      const mLabel = paymentMethods.find(m => m.value === p.method)?.label || p.method;
      if (p.installments > 1) return `${mLabel}: ${p.installments}x de ${formatBRL(p.amount / p.installments)}`;
      return `${mLabel}: ${formatBRL(p.amount)}`;
    }).join(' | ');
  }

  async function handleSave() {
    if (!category || !description || !totalAmount) {
      toast.error('Preencha os campos obrigatórios'); return;
    }
    if (useSplitPayment && Math.abs(remaining) > 0.01) {
      toast.error('A soma dos pagamentos deve ser igual ao valor total'); return;
    }

    const paymentMethod = useSplitPayment ? getPaymentSummary() : (payments[0]?.method || null);
    const finalNotes = [
      notes,
      useSplitPayment && totalDiscounts > 0 ? `Desconto maquininha: ${formatBRL(totalDiscounts)}` : '',
      useSplitPayment ? `Valor líquido recebido: ${formatBRL(totalAfterDiscounts)}` : '',
    ].filter(Boolean).join('\n');

    const payload = {
      user_id: userId, type, category, description, amount: totalAmount,
      date, due_date: dueDate || null, status, is_fixed: isFixed,
      payment_method: paymentMethod, recurrence: isFixed ? recurrence : 'none',
      notes: finalNotes || null, client_id: clientId || null,
      budget_id: budgetId || null,
      order_number: orderNumber || null, bank_account_id: bankAccountId || null,
      subcategory: subcategory || null,
    };

    let error;
    if (editTransaction?.id) {
      const res = await supabase.from('financial_transactions').update(payload as any).eq('id', editTransaction.id);
      error = res.error;
    } else {
      const res = await supabase.from('financial_transactions').insert(payload as any);
      error = res.error;
    }

    if (error) { toast.error('Erro ao salvar'); console.error(error); return; }
    toast.success(editTransaction?.id ? 'Lançamento atualizado!' : 'Lançamento criado!');
    resetForm();
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{editTransaction?.id ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Type toggle */}
          <div className="flex gap-2">
            <Button variant={type === 'income' ? 'default' : 'outline'} className={type === 'income' ? 'flex-1 gradient-primary border-0' : 'flex-1'} onClick={() => { setType('income'); setCategory(''); }}>
              <ArrowUpRight className="h-4 w-4 mr-1" /> Receita
            </Button>
            <Button variant={type === 'expense' ? 'default' : 'outline'} className={type === 'expense' ? 'flex-1 bg-destructive text-destructive-foreground border-0' : 'flex-1'} onClick={() => { setType('expense'); setCategory(''); }}>
              <ArrowDownRight className="h-4 w-4 mr-1" /> Despesa
            </Button>
          </div>

          {/* Client + OS */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clientId || 'none'} onValueChange={v => { setClientId(v === 'none' ? '' : v); setBudgetId(''); }}>
                <SelectTrigger><SelectValue placeholder="Vincular cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ordem de Serviço</Label>
              <Input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="Ex: OS-001" />
            </div>
          </div>

          {/* Vincular ao Projeto/Orçamento (alimenta Lucro por Cliente) */}
          {budgets.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                Vincular ao Projeto / Orçamento
                <span className="text-[10px] text-muted-foreground font-normal">(opcional — alimenta o Lucro por Cliente)</span>
              </Label>
              <Select value={budgetId || 'none'} onValueChange={v => {
                if (v === 'none') { setBudgetId(''); return; }
                setBudgetId(v);
                const b = budgets.find(x => x.id === v);
                if (b?.client_id && !clientId) setClientId(b.client_id);
              }}>
                <SelectTrigger><SelectValue placeholder="Selecionar projeto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {(clientId
                    ? budgets.filter(b => b.client_id === clientId)
                    : budgets
                  ).slice(0, 60).map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.code}{b.project_name ? ` — ${b.project_name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category + Description */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição *</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Pagamento MDF" />
            </div>
          </div>

          {/* Subcategory — collaborator name when category is labor/salary/commission */}
          {type === 'expense' && (
            <div className="space-y-2">
              <Label>
                Subcategoria
                {LABOR_CATEGORIES.includes(category) && (
                  <span className="text-[10px] text-muted-foreground ml-1.5">(colaborador)</span>
                )}
              </Label>
              {LABOR_CATEGORIES.includes(category) ? (
                <Select value={subcategory || 'none'} onValueChange={(v) => setSubcategory(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar colaborador" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {employees.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={subcategory}
                  onChange={e => setSubcategory(e.target.value)}
                  placeholder="Opcional — ex: Tinta branca, Frete cliente João..."
                />
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Valor Total *</Label>
              <CurrencyInput value={totalAmount} onChange={setTotalAmount} />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Vencimento</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Bank Account + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Conta Bancária</Label>
              <Select value={bankAccountId || 'none'} onValueChange={v => setBankAccountId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fixed expense */}
          <div className="flex items-center gap-3">
            <Switch checked={isFixed} onCheckedChange={setIsFixed} />
            <Label className="text-sm">Despesa Fixa (recorrente)</Label>
            {isFixed && (
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <Separator />

          {/* Split Payment Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-5 w-5 text-primary" />
                <Label className="text-sm font-semibold">Formas de Pagamento</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Dividir pagamento</Label>
                <Switch checked={useSplitPayment} onCheckedChange={setUseSplitPayment} />
              </div>
            </div>

            {payments.map((payment, idx) => (
              <div key={payment.id} className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {useSplitPayment ? `Pagamento ${idx + 1}` : 'Forma de Pagamento'}
                  </span>
                  {useSplitPayment && payments.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removePayment(payment.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Método</Label>
                    <Select value={payment.method} onValueChange={v => updatePayment(payment.id, 'method', v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map(m => (
                          <SelectItem key={m.value} value={m.value}>
                            <span className="flex items-center gap-2"><m.icon className="h-3.5 w-3.5" />{m.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {useSplitPayment && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor</Label>
                      <CurrencyInput value={payment.amount} onChange={v => updatePayment(payment.id, 'amount', v)} />
                    </div>
                  )}
                </div>

                {(payment.method === 'credit' || payment.method === 'debit') && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Parcelas</Label>
                      <Select value={String(payment.installments)} onValueChange={v => updatePayment(payment.id, 'installments', Number(v))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                            <SelectItem key={n} value={String(n)}>
                              {n === 1 ? 'À vista' : `${n}x de ${payment.amount > 0 ? formatBRL(payment.amount / n) : '—'}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Taxa maquininha (%)</Label>
                      <Input
                        type="number" step="0.1" min="0" max="100"
                        value={payment.machineDiscount || ''}
                        onChange={e => updatePayment(payment.id, 'machineDiscount', Number(e.target.value))}
                        placeholder="0"
                        className="h-9"
                      />
                    </div>
                  </div>
                )}

                {(payment.method === 'credit' || payment.method === 'debit') && payment.machineDiscount > 0 && payment.amount > 0 && (
                  <div className="text-xs text-muted-foreground bg-warning/10 rounded-lg px-3 py-2">
                    Taxa: {formatBRL(payment.amount * payment.machineDiscount / 100)} → Líquido: {formatBRL(payment.amount * (1 - payment.machineDiscount / 100))}
                  </div>
                )}
              </div>
            ))}

            {useSplitPayment && (
              <Button variant="outline" size="sm" className="w-full" onClick={addPayment}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar Forma de Pagamento
              </Button>
            )}

            {/* Summary */}
            {useSplitPayment && totalAmount > 0 && (
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Resumo do Pagamento</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor Total</span>
                    <span className="font-semibold">{formatBRL(totalAmount)}</span>
                  </div>
                  {payments.map((p, i) => {
                    const mLabel = paymentMethods.find(m => m.value === p.method)?.label || p.method;
                    return (
                      <div key={p.id} className="flex justify-between text-sm pl-3">
                        <span className="text-muted-foreground">
                          {mLabel} {p.installments > 1 ? `(${p.installments}x)` : ''}
                        </span>
                        <span>{formatBRL(p.amount)}</span>
                      </div>
                    );
                  })}
                  {totalDiscounts > 0 && (
                    <div className="flex justify-between text-sm text-warning">
                      <span>(-) Taxas de máquina</span>
                      <span>{formatBRL(totalDiscounts)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-sm font-bold">
                    <span>Líquido Recebido</span>
                    <span className="text-success">{formatBRL(totalAfterDiscounts)}</span>
                  </div>
                  {Math.abs(remaining) > 0.01 && (
                    <div className="flex justify-between text-sm text-destructive font-semibold">
                      <span>Faltando distribuir</span>
                      <span>{formatBRL(remaining)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionais..." rows={2} />
          </div>

          <Button className="w-full gradient-primary shadow-primary border-0 h-11" onClick={handleSave}>
            Salvar Lançamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
