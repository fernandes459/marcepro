import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Search, Send, FileText, Loader2, Trash2, Edit, CheckCircle, XCircle,
  Factory, Download, MessageSquare, ChevronDown, Settings2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatBRL } from '@/lib/format';
import { CurrencyInput } from '@/components/CurrencyInput';
import { generateBudgetPdf, defaultContractClauses } from '@/components/finance/BudgetPdfGenerator';

interface BudgetItem { name: string; quantity: number; unitPrice: number; materialCost: number; laborCost: number; }
const DEFAULT_PAYMENT_TEXT = '50% de entrada e o restante na entrega da obra';
interface Client {
  id: string; name: string; phone: string; email: string | null; city: string | null;
  cpf_cnpj: string | null; address: string | null; neighborhood: string | null;
  state: string | null; cep: string | null; address_number: string | null; complement: string | null;
}
interface Budget {
  id: string; code: string; client_id: string | null; project_name: string | null;
  status: string; total_cost: number; profit_margin: number; final_price: number;
  payment_method: string | null; notes: string | null; created_at: string;
  clients?: Client | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-muted text-muted-foreground' },
  pending: { label: 'Pendente', className: 'bg-warning/10 text-warning' },
  approved: { label: 'Aprovado', className: 'bg-success/10 text-success' },
  rejected: { label: 'Rejeitado', className: 'bg-destructive/10 text-destructive' },
  in_production: { label: 'Em Produção', className: 'bg-info/10 text-info' },
};

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } };

function generateBudgetText(budget: Budget, clientData: Client | null, simplified = false) {
  const lines = [
    '═══════════════════════════════════',
    '        ORÇAMENTO - MARCENARIA PRO',
    '═══════════════════════════════════',
    '', `Código: ${budget.code}`,
    `Data: ${new Date(budget.created_at).toLocaleDateString('pt-BR')}`,
    budget.project_name ? `Projeto: ${budget.project_name}` : '',
    '', '── CLIENTE ──────────────────────',
    clientData ? `Nome: ${clientData.name}` : '',
    clientData?.phone ? `Telefone: ${clientData.phone}` : '',
    clientData?.email ? `Email: ${clientData.email}` : '',
    clientData?.city ? `Cidade: ${clientData.city}` : '',
    '', '── RESUMO ──────────────────────', '',
    `💰 VALOR TOTAL: ${formatBRL(budget.final_price)}`, '',
    budget.payment_method ? `Forma de Pagamento: ${budget.payment_method}` : '',
    '', budget.notes && !simplified ? `Observações: ${budget.notes}` : '',
    '', '═══════════════════════════════════',
    '      Marcenaria Pro - ERP',
    '═══════════════════════════════════',
  ].filter(Boolean).join('\n');
  return lines;
}

export default function BudgetsPage() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [deliveryDays, setDeliveryDays] = useState(30);
  const [contractClauses, setContractClauses] = useState<string[]>([...defaultContractClauses]);
  const [newClause, setNewClause] = useState('');
  const [enabledClauses, setEnabledClauses] = useState<boolean[]>(defaultContractClauses.map(() => true));
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);

  const [selectedClientId, setSelectedClientId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [notes, setNotes] = useState('');
  const [margin, setMargin] = useState(40);
  const [items, setItems] = useState<BudgetItem[]>([{ name: '', quantity: 1, unitPrice: 0, materialCost: 0, laborCost: 0 }]);
  const [useAdvancedPayment, setUseAdvancedPayment] = useState(false);
  const [downPayment, setDownPayment] = useState(0);
  const [downPaymentMethod, setDownPaymentMethod] = useState('pix');
  const [installments, setInstallments] = useState(1);
  const [installmentMethod, setInstallmentMethod] = useState('credit');
  const [cardFeePercent, setCardFeePercent] = useState(0);
  const [simplePaymentMethod, setSimplePaymentMethod] = useState(DEFAULT_PAYMENT_TEXT);
  const [sendSimplified, setSendSimplified] = useState(false);
  const fetchData = async () => {
    const [budgetsRes, clientsRes, settingsRes] = await Promise.all([
      supabase.from('budgets').select('*, clients(id, name, phone, email, city, cpf_cnpj, address, neighborhood, state, cep, address_number, complement)').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('company_settings').select('*').limit(1).maybeSingle(),
    ]);
    if (budgetsRes.data) setBudgets(budgetsRes.data as any);
    if (clientsRes.data) setClients(clientsRes.data as Client[]);
    if (settingsRes.data) setCompanySettings(settingsRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Auto-fill card fee from company settings
  useEffect(() => {
    if (installmentMethod === 'credit' && companySettings) {
      const fees = (companySettings as any).card_fees || {};
      const autoFee = fees[String(installments)];
      if (autoFee !== undefined && autoFee !== null) {
        setCardFeePercent(Number(autoFee));
      }
    } else if (installmentMethod !== 'credit') {
      setCardFeePercent(0);
    }
  }, [installments, installmentMethod, companySettings]);

  // Realtime subscription for budgets
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`budgets-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filtered = budgets.filter(b => {
    const clientName = (b.clients as any)?.name || '';
    return clientName.toLowerCase().includes(search.toLowerCase()) ||
      b.code.toLowerCase().includes(search.toLowerCase()) ||
      (b.project_name || '').toLowerCase().includes(search.toLowerCase());
  });

  const totalMaterial = items.reduce((s, i) => s + i.materialCost * i.quantity, 0);
  const totalLabor = items.reduce((s, i) => s + i.laborCost * i.quantity, 0);
  const totalCost = totalMaterial + totalLabor;
  const profit = totalCost * (margin / 100);
  const finalPrice = totalCost + profit;
  const remaining = finalPrice - downPayment;
  const cardFeeAmount = remaining * (cardFeePercent / 100);
  const totalWithFee = remaining + (installmentMethod === 'credit' ? cardFeeAmount : 0);
  const installmentValue = installments > 0 ? totalWithFee / installments : 0;

  const buildPaymentDescription = () => {
    if (!useAdvancedPayment) return simplePaymentMethod;
    const parts: string[] = [];
    if (downPayment > 0) parts.push(`Entrada: ${formatBRL(downPayment)} (${downPaymentMethod === 'pix' ? 'PIX' : downPaymentMethod})`);
    if (remaining > 0 && installments > 0) {
      let text = `${installments}x de ${formatBRL(installmentValue)}`;
      if (installmentMethod === 'credit') text += ' no cartão';
      if (installmentMethod === 'credit' && cardFeePercent > 0) text += ` (taxa ${cardFeePercent}% inclusa)`;
      if (installmentMethod !== 'credit') text += ` (${installmentMethod === 'pix' ? 'PIX' : installmentMethod})`;
      parts.push(text);
    }
    return parts.join(' + ') || 'A combinar';
  };

  const addItem = () => setItems([...items, { name: '', quantity: 1, unitPrice: 0, materialCost: 0, laborCost: 0 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof BudgetItem, value: string | number) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    updated[idx].unitPrice = updated[idx].materialCost + updated[idx].laborCost;
    setItems(updated);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedClientId) { toast.error('Selecione um cliente'); return; }
    if (!projectName.trim()) { toast.error('Nome do projeto é obrigatório'); return; }
    setSaving(true);
    const paymentDesc = buildPaymentDescription();

    if (editingBudgetId) {
      // Update existing budget
      const { error: budgetError } = await supabase.from('budgets').update({
        client_id: selectedClientId,
        project_name: projectName || null,
        total_cost: totalCost, profit_margin: margin, final_price: finalPrice,
        payment_method: paymentDesc || null, notes: notes || null,
      } as any).eq('id', editingBudgetId);
      if (budgetError) { toast.error('Erro ao atualizar orçamento'); setSaving(false); return; }
      
      // Delete old items and insert new ones
      await supabase.from('budget_items').delete().eq('budget_id', editingBudgetId);
      const budgetItems = items.filter(i => i.name.trim()).map(i => ({
        budget_id: editingBudgetId, name: i.name, quantity: i.quantity,
        material_cost: i.materialCost, labor_cost: i.laborCost, unit_price: i.unitPrice,
      }));
      if (budgetItems.length > 0) await supabase.from('budget_items').insert(budgetItems as any);
      toast.success('Orçamento atualizado!');
    } else {
      // Create new budget
      const { data: budgetData, error: budgetError } = await supabase.from('budgets').insert({
        user_id: user.id, client_id: selectedClientId, code: 'TEMP',
        project_name: projectName || null, status: 'draft',
        total_cost: totalCost, profit_margin: margin, final_price: finalPrice,
        payment_method: paymentDesc || null, notes: notes || null,
      } as any).select().single();
      if (budgetError || !budgetData) { toast.error('Erro ao criar orçamento'); setSaving(false); return; }
      const budgetItems = items.filter(i => i.name.trim()).map(i => ({
        budget_id: (budgetData as any).id, name: i.name, quantity: i.quantity,
        material_cost: i.materialCost, labor_cost: i.laborCost, unit_price: i.unitPrice,
      }));
      if (budgetItems.length > 0) await supabase.from('budget_items').insert(budgetItems as any);
      toast.success('Orçamento criado com sucesso!');
    }
    setDialogOpen(false); resetForm(); fetchData(); setSaving(false);
  };

  const resetForm = () => {
    setSelectedClientId(''); setProjectName(''); setSimplePaymentMethod(DEFAULT_PAYMENT_TEXT); setNotes('');
    setMargin(40); setItems([{ name: '', quantity: 1, unitPrice: 0, materialCost: 0, laborCost: 0 }]);
    setUseAdvancedPayment(false); setDownPayment(0); setDownPaymentMethod('pix');
    setInstallments(1); setInstallmentMethod('credit'); setCardFeePercent(0);
    setEditingBudgetId(null); setSendSimplified(false);
  };

  const openEditBudget = async (budget: Budget) => {
    setEditingBudgetId(budget.id);
    setSelectedClientId(budget.client_id || '');
    setProjectName(budget.project_name || '');
    setNotes(budget.notes || '');
    setMargin(budget.profit_margin);
    
    // Load budget items
    const { data: budgetItems } = await supabase.from('budget_items').select('*').eq('budget_id', budget.id);
    if (budgetItems && budgetItems.length > 0) {
      setItems(budgetItems.map((i: any) => ({
        name: i.name, quantity: i.quantity, unitPrice: i.unit_price,
        materialCost: i.material_cost, laborCost: i.labor_cost,
      })));
    } else {
      setItems([{ name: '', quantity: 1, unitPrice: 0, materialCost: 0, laborCost: 0 }]);
    }

    // Parse payment method
    if (budget.payment_method && budget.payment_method.includes('Entrada:')) {
      setUseAdvancedPayment(true);
      // Simple parsing - just set the payment method text
    } else {
      setUseAdvancedPayment(false);
      setSimplePaymentMethod(budget.payment_method || '');
    }
    
    setDialogOpen(true);
  };

  const sendWhatsApp = (budget: Budget, simplified = false) => {
    const client = budget.clients as Client | null;
    if (!client?.phone) { toast.error('Cliente sem telefone cadastrado'); return; }
    const phone = client.phone.replace(/\D/g, '');
    const phoneWithCountry = phone.startsWith('55') ? phone : `55${phone}`;
    const text = generateBudgetText(budget, client, simplified);
    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const deleteBudget = async (id: string) => {
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir'); else { toast.success('Excluído'); fetchData(); }
  };

  const addBusinessDays = (startDate: Date, days: number): Date => {
    const result = new Date(startDate);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      const dow = result.getDay();
      if (dow !== 0 && dow !== 6) added++;
    }
    return result;
  };

  const updateBudgetStatus = async (id: string, status: string) => {
    const budget = budgets.find(b => b.id === id);
    const { error } = await supabase.from('budgets').update({ status } as any).eq('id', id);
    if (error) { toast.error('Erro ao atualizar status'); return; }
    
    // Auto-create financial transactions when budget is approved
    if (status === 'approved' && budget && user) {
      const client = budget.clients as Client | null;
      const paymentStr = budget.payment_method || '';
      
      // Parse down payment from payment method string
      const entradaMatch = paymentStr.match(/Entrada:\s*R\$\s*([\d.,]+)/);
      const downPaymentValue = entradaMatch 
        ? parseFloat(entradaMatch[1].replace(/\./g, '').replace(',', '.')) 
        : 0;
      const remainingValue = budget.final_price - downPaymentValue;

      // Parse installments
      const parcelasMatch = paymentStr.match(/(\d+)x\s*de/);
      const numInstallments = parcelasMatch ? parseInt(parcelasMatch[1]) : 1;

      const today = new Date().toISOString().slice(0, 10);
      const baseDesc = `${budget.project_name || budget.code} — ${client?.name || 'Cliente'}`;

      if (downPaymentValue > 0) {
        // Create PAID entry for down payment
        await supabase.from('financial_transactions').insert({
          user_id: user.id, type: 'income', category: 'project',
          description: `${baseDesc} (Entrada)`,
          amount: downPaymentValue, date: today, status: 'paid', paid_date: today,
          client_id: budget.client_id, budget_id: budget.id,
          order_number: budget.code, payment_method: paymentStr.split('+')[0]?.trim() || 'PIX',
          notes: `Entrada do orçamento ${budget.code}`,
        } as any);
      }

      if (remainingValue > 0) {
        // Create PENDING entry for remaining amount with due date in business days
        const dueDate = addBusinessDays(new Date(), 30);
        await supabase.from('financial_transactions').insert({
          user_id: user.id, type: 'income', category: 'project',
          description: `${baseDesc} (Restante)`,
          amount: remainingValue, date: today, status: 'pending',
          due_date: dueDate.toISOString().slice(0, 10),
          client_id: budget.client_id, budget_id: budget.id,
          order_number: budget.code,
          payment_method: numInstallments > 1 ? `${numInstallments}x cartão` : 'A combinar',
          notes: `Saldo restante do orçamento ${budget.code}\nVencimento: ${dueDate.toLocaleDateString('pt-BR')}\nTotal do projeto: ${formatBRL(budget.final_price)}`,
        } as any);
      }

      if (downPaymentValue === 0 && remainingValue === 0) {
        // No payment info parsed, create single pending transaction
        await supabase.from('financial_transactions').insert({
          user_id: user.id, type: 'income', category: 'project',
          description: baseDesc, amount: budget.final_price, date: today,
          status: 'pending', client_id: budget.client_id, budget_id: budget.id,
          order_number: budget.code, payment_method: paymentStr || null,
          notes: `Orçamento aprovado: ${budget.code}\nValor total: ${formatBRL(budget.final_price)}`,
        } as any);
      }
      
      toast.info('Lançamentos financeiros criados automaticamente');
    }
    
    toast.success(`Status atualizado para ${statusConfig[status]?.label || status}`);
    fetchData();
  };

  const sendToProduction = async (budget: Budget) => {
    const client = budget.clients as Client | null;
    if (!client) { toast.error('Orçamento sem cliente vinculado'); return; }
    const { error } = await supabase.from('production_tasks').insert({
      user_id: user!.id,
      project_name: budget.project_name || budget.code,
      client_name: client.name,
      budget_id: budget.id,
      stage: 'corte',
      priority: 'normal',
      notes: `Orçamento: ${budget.code} - ${formatBRL(budget.final_price)}`,
    });
    if (error) { toast.error('Erro ao enviar para produção'); return; }
    await updateBudgetStatus(budget.id, 'in_production');
    toast.success('Enviado para produção!');
  };

  const openPdfDialog = async (budget: Budget) => {
    setSelectedBudget(budget);
    setContractClauses([...defaultContractClauses]);
    setEnabledClauses(defaultContractClauses.map(() => true));
    setDeliveryDays(30);
    setPdfDialogOpen(true);
  };

  const handleGeneratePdf = async () => {
    if (!selectedBudget) return;
    const client = selectedBudget.clients as Client | null;
    const { data: budgetItems } = await supabase.from('budget_items').select('*').eq('budget_id', selectedBudget.id);
    const activeClauses = contractClauses.filter((_, i) => enabledClauses[i]);

    generateBudgetPdf({
      code: selectedBudget.code,
      projectName: selectedBudget.project_name,
      finalPrice: selectedBudget.final_price,
      totalCost: selectedBudget.total_cost,
      profitMargin: selectedBudget.profit_margin,
      paymentMethod: selectedBudget.payment_method,
      notes: selectedBudget.notes,
      createdAt: selectedBudget.created_at,
      deliveryDays,
      client: client ? {
        name: client.name, phone: client.phone, email: client.email,
        cpf_cnpj: client.cpf_cnpj, address: client.address,
        address_number: client.address_number, complement: client.complement,
        neighborhood: client.neighborhood, city: client.city,
        state: client.state, cep: client.cep,
      } : null,
      items: (budgetItems || []).map((i: any) => ({ name: i.name, quantity: i.quantity, unit_price: i.unit_price })),
      companyName: companySettings?.company_name,
      companyCnpj: companySettings?.cnpj,
      companyPhone: companySettings?.phone,
      companyEmail: companySettings?.email,
      companyAddress: companySettings?.address,
      contractClauses: activeClauses,
    });
    setPdfDialogOpen(false);
  };

  const addCustomClause = () => {
    if (!newClause.trim()) return;
    setContractClauses([...contractClauses, newClause.trim()]);
    setEnabledClauses([...enabledClauses, true]);
    setNewClause('');
  };

  const removeClause = (idx: number) => {
    setContractClauses(contractClauses.filter((_, i) => i !== idx));
    setEnabledClauses(enabledClauses.filter((_, i) => i !== idx));
  };

  // Calculate delivery date preview
  const deliveryDate = selectedBudget ? addBusinessDays(new Date(selectedBudget.created_at), deliveryDays) : addBusinessDays(new Date(), deliveryDays);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Orçamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">{budgets.length} orçamentos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary shadow-primary border-0"><Plus className="h-4 w-4 mr-2" /> Novo Orçamento</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-display">{editingBudgetId ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                    <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nome do Projeto *</Label>
                  <Input placeholder="Ex: Cozinha Planejada" value={projectName} onChange={(e) => setProjectName(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Margem de Lucro (%)</Label>
                <Input type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="max-w-[120px]" />
              </div>

              {/* Materiais */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Materiais e Serviços</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const itemSubtotal = (item.materialCost + item.laborCost) * item.quantity;
                    return (
                      <div key={idx} className="rounded-lg bg-muted/50 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input placeholder="Nome do material/serviço" value={item.name} onChange={(e) => updateItem(idx, 'name', e.target.value)} className="flex-1 text-sm" />
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)} className="text-destructive shrink-0 h-8 w-8 p-0"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">Qtd</label>
                            <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} className="text-sm h-9" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">Material (R$)</label>
                            <CurrencyInput value={item.materialCost} onChange={(v) => updateItem(idx, 'materialCost', v)} placeholder="0,00" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">M.O. (R$)</label>
                            <CurrencyInput value={item.laborCost} onChange={(v) => updateItem(idx, 'laborCost', v)} placeholder="0,00" />
                          </div>
                        </div>
                        {itemSubtotal > 0 && (
                          <div className="text-right text-xs text-muted-foreground">
                            Subtotal: <span className="font-semibold text-foreground">{formatBRL(itemSubtotal)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Resumo financeiro */}
              <Card className="bg-accent/30 border-accent">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Material</span><span className="font-medium">{formatBRL(totalMaterial)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Mão de Obra</span><span className="font-medium">{formatBRL(totalLabor)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Custo Total</span><span className="font-medium">{formatBRL(totalCost)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Lucro ({margin}%)</span><span className="font-medium text-success">{formatBRL(profit)}</span></div>
                  <div className="border-t border-border pt-2 flex justify-between items-center">
                    <span className="font-bold font-display">Preço Final</span>
                    <span className="font-bold font-display text-xl">{formatBRL(finalPrice)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Forma de pagamento */}
              <div className="space-y-4 border border-border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Forma de Pagamento</Label>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Avançado</Label>
                    <Switch checked={useAdvancedPayment} onCheckedChange={setUseAdvancedPayment} />
                  </div>
                </div>
                {!useAdvancedPayment ? (
                  <Textarea
                    value={simplePaymentMethod}
                    onChange={(e) => setSimplePaymentMethod(e.target.value)}
                    placeholder="Ex: 50% de entrada e o restante na entrega da obra"
                    className="min-h-[60px] text-sm"
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-xs">Entrada</Label><CurrencyInput value={downPayment} onChange={setDownPayment} /></div>
                      <div className="space-y-2"><Label className="text-xs">Método da Entrada</Label>
                        <Select value={downPaymentMethod} onValueChange={setDownPaymentMethod}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="transferencia">Transferência</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-xs">Parcelas</Label>
                        <Select value={String(installments)} onValueChange={v => setInstallments(Number(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{Array.from({length: 18}, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>{n}x</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2"><Label className="text-xs">Método</Label>
                        <Select value={installmentMethod} onValueChange={(v) => { setInstallmentMethod(v); if (v !== 'credit') setCardFeePercent(0); }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="credit">Cartão Crédito</SelectItem>
                            <SelectItem value="debit">Cartão Débito</SelectItem>
                            <SelectItem value="boleto">Boleto</SelectItem>
                            <SelectItem value="pix">PIX (à vista)</SelectItem>
                            <SelectItem value="dinheiro">Dinheiro (à vista)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {installmentMethod === 'credit' && (
                      <div className="space-y-2">
                        <Label className="text-xs">Taxa do Cartão (%)</Label>
                        <Input type="number" step="0.1" value={cardFeePercent || ''} onChange={e => setCardFeePercent(Number(e.target.value))} placeholder="Ex: 5.5" />
                        <p className="text-[10px] text-muted-foreground">
                          {companySettings && (companySettings as any).card_fees?.[String(installments)]
                            ? '✓ Taxa preenchida automaticamente das configurações'
                            : 'Configure taxas padrão em Configurações → Taxas'}
                        </p>
                      </div>
                    )}
                    <Card className="bg-muted/50">
                      <CardContent className="p-3 space-y-1 text-sm">
                        {downPayment > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Entrada ({downPaymentMethod === 'pix' ? 'PIX' : downPaymentMethod})</span><span className="font-medium">{formatBRL(downPayment)}</span></div>}
                        <div className="flex justify-between"><span className="text-muted-foreground">Restante</span><span className="font-medium">{formatBRL(remaining)}</span></div>
                        {installmentMethod === 'credit' && cardFeePercent > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Taxa cartão ({cardFeePercent}%)</span><span className="font-medium text-destructive">+{formatBRL(cardFeeAmount)}</span></div>}
                        {installmentMethod === 'credit' && cardFeePercent > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Total c/ taxa</span><span className="font-medium">{formatBRL(totalWithFee)}</span></div>}
                        <div className="flex justify-between border-t border-border pt-1"><span className="font-semibold">{installments}x de</span><span className="font-bold">{formatBRL(installmentValue)}</span></div>
                        {installmentMethod !== 'credit' && <div className="text-[10px] text-success mt-1">✓ Sem taxa de cartão</div>}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>

              {/* Envio simplificado toggle */}
              <div className="flex items-center justify-between border border-border rounded-xl p-4">
                <div>
                  <Label className="text-sm font-semibold">Enviar versão resumida</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Mostra apenas projeto, valor e pagamento</p>
                </div>
                <Switch checked={sendSimplified} onCheckedChange={setSendSimplified} />
              </div>

              <div className="space-y-2"><Label>Observações</Label><Textarea placeholder="Notas sobre o orçamento..." value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <Button type="submit" className="w-full gradient-primary shadow-primary border-0" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                <FileText className="h-4 w-4 mr-2" /> {editingBudgetId ? 'Salvar Alterações' : 'Salvar Orçamento'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar orçamentos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Projeto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Cliente</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preço</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum orçamento encontrado</td></tr>
                  ) : filtered.map((b) => (
                    <motion.tr key={b.id} variants={itemVariants} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono font-medium">{b.code}</td>
                      <td className="px-4 py-3 text-sm">{b.project_name || '—'}</td>
                      <td className="px-4 py-3 text-sm font-medium hidden sm:table-cell">{(b.clients as any)?.name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">{formatBRL(b.final_price)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusConfig[b.status]?.className || ''}`}>
                          {statusConfig[b.status]?.label || b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {(b.status === 'draft' || b.status === 'pending') && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-success" onClick={() => updateBudgetStatus(b.id, 'approved')} title="Aprovar">
                              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aprovar
                            </Button>
                          )}
                          {(b.status === 'draft' || b.status === 'pending') && (
                            <button onClick={() => updateBudgetStatus(b.id, 'rejected')} className="rounded p-1.5 hover:bg-destructive/10 transition-colors" title="Rejeitar">
                              <XCircle className="h-4 w-4 text-destructive" />
                            </button>
                          )}
                          {b.status === 'approved' && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-info" onClick={() => sendToProduction(b)} title="Enviar para Produção">
                              <Factory className="h-3.5 w-3.5 mr-1" /> Produzir
                            </Button>
                          )}
                          <button onClick={() => openPdfDialog(b)} className="rounded p-1.5 hover:bg-muted transition-colors" title="Gerar PDF">
                            <Download className="h-4 w-4 text-muted-foreground" />
                          </button>
                          <button onClick={() => sendWhatsApp(b, true)} className="rounded p-1.5 hover:bg-muted transition-colors" title="WhatsApp (resumido)">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                          </button>
                          <button onClick={() => sendWhatsApp(b)} className="rounded p-1.5 hover:bg-muted transition-colors" title="WhatsApp (completo)">
                            <Send className="h-4 w-4 text-muted-foreground" />
                          </button>
                          <button onClick={() => openEditBudget(b)} className="rounded p-1.5 hover:bg-muted transition-colors" title="Editar">
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </button>
                          <button onClick={() => deleteBudget(b.id)} className="rounded p-1.5 hover:bg-destructive/10 transition-colors" title="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PDF / Contract Dialog */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Gerar PDF — Orçamento / Contrato
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Prazo de Entrega (dias úteis)</Label>
              <Input type="number" value={deliveryDays} onChange={e => setDeliveryDays(Number(e.target.value))} className="max-w-[150px]" />
              <p className="text-xs text-muted-foreground">
                Data prevista de entrega: <strong>{deliveryDate.toLocaleDateString('pt-BR')}</strong>
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Settings2 className="h-4 w-4" /> Cláusulas do Contrato
                </Label>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {contractClauses.map((clause, idx) => (
                  <div key={idx} className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                    <Checkbox
                      checked={enabledClauses[idx]}
                      onCheckedChange={(checked) => {
                        const newEnabled = [...enabledClauses];
                        newEnabled[idx] = checked === true;
                        setEnabledClauses(newEnabled);
                      }}
                      className="mt-0.5"
                    />
                    <p className={`text-xs flex-1 ${!enabledClauses[idx] ? 'line-through text-muted-foreground' : ''}`}>{clause}</p>
                    <button onClick={() => removeClause(idx)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar nova cláusula..."
                  value={newClause}
                  onChange={e => setNewClause(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomClause(); } }}
                  className="text-xs"
                />
                <Button type="button" variant="outline" size="sm" onClick={addCustomClause}><Plus className="h-3 w-3" /></Button>
              </div>
            </div>

            <Button className="w-full gradient-primary shadow-primary border-0" onClick={handleGeneratePdf}>
              <Download className="h-4 w-4 mr-2" /> Gerar PDF do Orçamento + Contrato
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
