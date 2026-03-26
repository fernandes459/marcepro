import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Eye, Send, FileText, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BudgetItem {
  name: string;
  quantity: number;
  unitPrice: number;
  materialCost: number;
  laborCost: number;
}

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  city: string | null;
}

interface Budget {
  id: string;
  code: string;
  client_id: string | null;
  project_name: string | null;
  status: string;
  total_cost: number;
  profit_margin: number;
  final_price: number;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  clients?: Client | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-muted text-muted-foreground' },
  pending: { label: 'Pendente', className: 'bg-warning/10 text-warning' },
  approved: { label: 'Aprovado', className: 'bg-success/10 text-success' },
  rejected: { label: 'Rejeitado', className: 'bg-destructive/10 text-destructive' },
  expired: { label: 'Expirado', className: 'bg-muted text-muted-foreground' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

function generateBudgetPDF(budget: Budget, items: BudgetItem[], clientData: Client | null) {
  // Build a simple text-based "PDF" as a Blob for WhatsApp sharing
  const lines = [
    '═══════════════════════════════════',
    '        ORÇAMENTO - MARCENARIA PRO',
    '═══════════════════════════════════',
    '',
    `Código: ${budget.code}`,
    `Data: ${new Date(budget.created_at).toLocaleDateString('pt-BR')}`,
    budget.project_name ? `Projeto: ${budget.project_name}` : '',
    '',
    '── CLIENTE ──────────────────────',
    clientData ? `Nome: ${clientData.name}` : '',
    clientData?.phone ? `Telefone: ${clientData.phone}` : '',
    clientData?.email ? `Email: ${clientData.email}` : '',
    clientData?.city ? `Cidade: ${clientData.city}` : '',
    '',
    '── RESUMO ──────────────────────',
    '',
    `💰 VALOR TOTAL: R$ ${Number(budget.final_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    '',
    budget.payment_method ? `Forma de Pagamento: ${budget.payment_method}` : '',
    '',
    budget.notes ? `Observações: ${budget.notes}` : '',
    '',
    '═══════════════════════════════════',
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

  // Form
  const [selectedClientId, setSelectedClientId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [margin, setMargin] = useState(40);
  const [items, setItems] = useState<BudgetItem[]>([
    { name: '', quantity: 1, unitPrice: 0, materialCost: 0, laborCost: 0 },
  ]);

  const fetchData = async () => {
    const [budgetsRes, clientsRes] = await Promise.all([
      supabase.from('budgets').select('*, clients(id, name, phone, email, city)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name, phone, email, city').order('name'),
    ]);
    if (budgetsRes.data) setBudgets(budgetsRes.data as any);
    if (clientsRes.data) setClients(clientsRes.data as Client[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = budgets.filter(
    (b) => {
      const clientName = (b.clients as any)?.name || '';
      return clientName.toLowerCase().includes(search.toLowerCase()) ||
        b.code.toLowerCase().includes(search.toLowerCase()) ||
        (b.project_name || '').toLowerCase().includes(search.toLowerCase());
    }
  );

  const totalMaterial = items.reduce((s, i) => s + i.materialCost * i.quantity, 0);
  const totalLabor = items.reduce((s, i) => s + i.laborCost * i.quantity, 0);
  const totalCost = totalMaterial + totalLabor;
  const profit = totalCost * (margin / 100);
  const finalPrice = totalCost + profit;

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
    if (!user || !selectedClientId) {
      toast.error('Selecione um cliente');
      return;
    }
    setSaving(true);

    // Insert budget
    const { data: budgetData, error: budgetError } = await supabase.from('budgets').insert({
      user_id: user.id,
      client_id: selectedClientId,
      code: 'TEMP', // will be overwritten by trigger
      project_name: projectName || null,
      status: 'draft',
      total_cost: totalCost,
      profit_margin: margin,
      final_price: finalPrice,
      payment_method: paymentMethod || null,
      notes: notes || null,
    } as any).select().single();

    if (budgetError || !budgetData) {
      toast.error('Erro ao criar orçamento');
      console.error(budgetError);
      setSaving(false);
      return;
    }

    // Insert items
    const budgetItems = items.filter(i => i.name.trim()).map(i => ({
      budget_id: (budgetData as any).id,
      name: i.name,
      quantity: i.quantity,
      material_cost: i.materialCost,
      labor_cost: i.laborCost,
      unit_price: i.unitPrice,
    }));

    if (budgetItems.length > 0) {
      await supabase.from('budget_items').insert(budgetItems as any);
    }

    toast.success('Orçamento criado com sucesso!');
    setDialogOpen(false);
    resetForm();
    fetchData();
    setSaving(false);
  };

  const resetForm = () => {
    setSelectedClientId('');
    setProjectName('');
    setPaymentMethod('');
    setNotes('');
    setMargin(40);
    setItems([{ name: '', quantity: 1, unitPrice: 0, materialCost: 0, laborCost: 0 }]);
  };

  const sendWhatsApp = (budget: Budget) => {
    const client = budget.clients as Client | null;
    if (!client?.phone) {
      toast.error('Cliente sem telefone cadastrado');
      return;
    }
    const phone = client.phone.replace(/\D/g, '');
    const phoneWithCountry = phone.startsWith('55') ? phone : `55${phone}`;
    const text = generateBudgetPDF(budget, [], client);
    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const deleteBudget = async (id: string) => {
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir'); else { toast.success('Excluído'); fetchData(); }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Orçamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">{budgets.length} orçamentos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary shadow-primary border-0">
              <Plus className="h-4 w-4 mr-2" />
              Novo Orçamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Novo Orçamento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nome do Projeto</Label>
                  <Input placeholder="Ex: Cozinha Planejada" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Margem de Lucro (%)</Label>
                  <Input type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="avista">À Vista</SelectItem>
                      <SelectItem value="2x">2x</SelectItem>
                      <SelectItem value="3x">3x</SelectItem>
                      <SelectItem value="4x">4x</SelectItem>
                      <SelectItem value="5x">5x</SelectItem>
                      <SelectItem value="6x">6x</SelectItem>
                      <SelectItem value="10x">10x</SelectItem>
                      <SelectItem value="12x">12x</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Itens do Orçamento</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-6 gap-2 rounded-lg bg-muted/50 p-3 items-center">
                    <Input placeholder="Descrição" value={item.name} onChange={(e) => updateItem(idx, 'name', e.target.value)} className="col-span-2" />
                    <Input type="number" placeholder="Qtd" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} />
                    <Input type="number" placeholder="Material R$" value={item.materialCost || ''} onChange={(e) => updateItem(idx, 'materialCost', Number(e.target.value))} />
                    <Input type="number" placeholder="M.O. R$" value={item.laborCost || ''} onChange={(e) => updateItem(idx, 'laborCost', Number(e.target.value))} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)} className="text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Calculator */}
              <Card className="bg-accent/30 border-accent">
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Material</span>
                    <span className="font-medium">R$ {totalMaterial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Mão de Obra</span>
                    <span className="font-medium">R$ {totalLabor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Custo Total</span>
                    <span className="font-medium">R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lucro ({margin}%)</span>
                    <span className="font-medium text-success">R$ {profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between">
                    <span className="font-bold font-display">Preço Final</span>
                    <span className="font-bold font-display text-lg">R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea placeholder="Notas sobre o orçamento..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <div className="flex gap-3">
                <Button type="submit" className="flex-1 gradient-primary shadow-primary border-0" disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <FileText className="h-4 w-4 mr-2" />
                  Salvar Orçamento
                </Button>
              </div>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preço Final</th>
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
                      <td className="px-4 py-3 text-sm font-medium">{(b.clients as any)?.name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">R$ {Number(b.final_price).toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusConfig[b.status]?.className || ''}`}>
                          {statusConfig[b.status]?.label || b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => sendWhatsApp(b)} className="rounded p-1.5 hover:bg-muted transition-colors" title="Enviar WhatsApp">
                            <Send className="h-4 w-4 text-muted-foreground" />
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
    </motion.div>
  );
}
