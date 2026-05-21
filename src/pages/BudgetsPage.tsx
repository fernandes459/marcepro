import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Send, FileText, Loader2, Trash2, Edit, CheckCircle, XCircle,
  Factory, Download, MessageSquare, Settings2, Eye, EyeOff,
  ChevronDown, ChevronUp, BarChart3, Milestone, FileSpreadsheet,
  Clock, CheckCircle2, Hammer, TrendingUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatBRL } from '@/lib/format';
import { generateBudgetPdf, defaultContractClauses } from '@/components/finance/BudgetPdfGenerator';
import { SearchInput } from '@/components/SearchInput';
import ContractDRE from '@/components/finance/ContractDRE';
import PaymentMilestones from '@/components/finance/PaymentMilestones';
import BudgetWizardDialog, {
  type Client, type Employee, type MaterialCatalogItem, type Budget,
} from '@/components/budget/BudgetWizardDialog';

interface BudgetWithClient extends Budget {
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

function generateBudgetText(budget: BudgetWithClient, simplified = false) {
  const c = budget.clients || null;
  const lines = [
    '═══════════════════════════════════',
    '        ORÇAMENTO - MARCENARIA PRO',
    '═══════════════════════════════════',
    '', `Código: ${budget.code}`,
    `Data: ${new Date(budget.created_at).toLocaleDateString('pt-BR')}`,
    budget.project_name ? `Projeto: ${budget.project_name}` : '',
    '', '── CLIENTE ──────────────────────',
    c ? `Nome: ${c.name}` : '',
    c?.phone ? `Telefone: ${c.phone}` : '',
    !simplified && c?.email ? `Email: ${c.email}` : '',
    '', '── RESUMO ──────────────────────',
    `💰 VALOR TOTAL: ${formatBRL(budget.final_price)}`, '',
    budget.payment_method ? `Pagamento: ${budget.payment_method}` : '',
    '', '═══════════════════════════════════',
    '      Marcenaria Pro - ERP',
    '═══════════════════════════════════',
  ].filter(Boolean).join('\n');
  return lines;
}

function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

export default function BudgetsPage() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<BudgetWithClient[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [materialCatalog, setMaterialCatalog] = useState<MaterialCatalogItem[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [activeProductionBudgetIds, setActiveProductionBudgetIds] = useState<Set<string>>(new Set());
  const [overheadPerProject, setOverheadPerProject] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [funnelPeriod, setFunnelPeriod] = useState<'month' | '3m' | '6m' | 'year' | 'all'>('month');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetWithClient | null>(null);
  const [expandedBudgetId, setExpandedBudgetId] = useState<string | null>(null);

  // PDF dialog
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<BudgetWithClient | null>(null);
  const [deliveryDays, setDeliveryDays] = useState(30);
  const [contractClauses, setContractClauses] = useState<string[]>([...defaultContractClauses]);
  const [enabledClauses, setEnabledClauses] = useState<boolean[]>(defaultContractClauses.map(() => true));
  const [newClause, setNewClause] = useState('');
  const [pdfSimplified, setPdfSimplified] = useState(false);
  const [pdfClientOpts, setPdfClientOpts] = useState({
    showDescription: true, showItemsList: false, showPaymentTerms: true, showContractClauses: true,
  });

  const fetchData = async () => {
    const [budgetsRes, clientsRes, settingsRes, employeesRes, materialsRes, opCostsRes, prodRes] = await Promise.all([
      supabase.from('budgets').select('*, clients(id, name, phone, email, city, cpf_cnpj, address, neighborhood, state, cep, address_number, complement)').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('company_settings').select('*').limit(1).maybeSingle(),
      supabase.from('employees').select('id, name').eq('status', 'active').order('name'),
      supabase.from('material_catalog' as any).select('id, name, unit_cost, unit, supplier').order('name'),
      supabase.from('operational_costs').select('monthly_amount, active'),
      supabase.from('production_tasks').select('budget_id, stage'),
    ]);
    if (budgetsRes.data) setBudgets(budgetsRes.data as any);
    if (clientsRes.data) setClients(clientsRes.data as Client[]);
    if (settingsRes.data) setCompanySettings(settingsRes.data);
    if (employeesRes.data) setEmployees(employeesRes.data as Employee[]);
    if (materialsRes.data) setMaterialCatalog(materialsRes.data as unknown as MaterialCatalogItem[]);
    if (opCostsRes.data && settingsRes.data) {
      const total = (opCostsRes.data as any[]).filter(c => c.active).reduce((s, c) => s + Number(c.monthly_amount || 0), 0);
      const avg = Math.max(1, Number((settingsRes.data as any).avg_projects_per_month) || 4);
      setOverheadPerProject(total / avg);
    }
    if (prodRes.data) {
      const ids = new Set<string>();
      (prodRes.data as any[]).forEach(t => {
        if (t.budget_id && t.stage !== 'entregue' && t.stage !== 'cancelado') ids.add(t.budget_id);
      });
      setActiveProductionBudgetIds(ids);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`budgets-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'material_catalog' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filtered = budgets.filter(b => {
    if (filterStatus !== 'all') {
      if (filterStatus === 'open') {
        if (b.status !== 'draft' && b.status !== 'pending') return false;
      } else if (filterStatus === 'closed') {
        if (b.status !== 'approved' && b.status !== 'in_production') return false;
      } else if (b.status !== filterStatus) return false;
    }
    const clientName = (b.clients as any)?.name || '';
    const q = search.toLowerCase();
    return clientName.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q) ||
      (b.project_name || '').toLowerCase().includes(q);
  });

  const periodStart = useMemo(() => {
    if (funnelPeriod === 'all') return null;
    const d = new Date();
    if (funnelPeriod === 'month') d.setDate(1);
    else if (funnelPeriod === '3m') d.setMonth(d.getMonth() - 3);
    else if (funnelPeriod === '6m') d.setMonth(d.getMonth() - 6);
    else if (funnelPeriod === 'year') { d.setMonth(0); d.setDate(1); }
    d.setHours(0, 0, 0, 0);
    return d;
  }, [funnelPeriod]);

  const periodBudgets = useMemo(() => {
    if (!periodStart) return budgets;
    return budgets.filter(b => {
      // Para fechados (aprovado / em produção), considera a data de aprovação (faturamento).
      // Para os demais, usa a data de criação.
      const isClosed = b.status === 'approved' || b.status === 'in_production';
      const refDate = isClosed && (b as any).approved_at
        ? new Date((b as any).approved_at)
        : new Date(b.created_at);
      return refDate >= periodStart;
    });
  }, [budgets, periodStart]);

  const kpis = useMemo(() => {
    const sum = (arr: BudgetWithClient[]) => arr.reduce((s, b) => s + Number(b.final_price || 0), 0);
    const pending = periodBudgets.filter(b => b.status === 'pending' || b.status === 'draft');
    const approved = periodBudgets.filter(b => b.status === 'approved');
    const inProd = periodBudgets.filter(b => b.status === 'in_production');
    const rejected = periodBudgets.filter(b => b.status === 'rejected');
    const won = approved.length + inProd.length;
    const closedTotal = won + rejected.length;
    const winRate = closedTotal > 0 ? (won / closedTotal) * 100 : 0;
    const total = periodBudgets.length || 1;
    return {
      total: periodBudgets.length,
      pending: pending.length,
      approved: approved.length,
      inProduction: inProd.length,
      rejected: rejected.length,
      rejectedList: rejected,
      revenueApproved: sum(approved) + sum(inProd),
      revenueApprovedOnly: sum(approved),
      revenueInProduction: sum(inProd),
      revenuePending: sum(pending),
      revenueLost: sum(rejected),
      ticketMedio: won > 0 ? (sum(approved) + sum(inProd)) / won : 0,
      winRate,
      pctApproved: ((approved.length + inProd.length) / total) * 100,
      pctPending: (pending.length / total) * 100,
      pctRejected: (rejected.length / total) * 100,
    };
  }, [periodBudgets]);

  const periodLabel: Record<typeof funnelPeriod, string> = {
    month: 'Este mês',
    '3m': 'Últimos 3 meses',
    '6m': 'Últimos 6 meses',
    year: 'Este ano',
    all: 'Tudo',
  } as const;

  const extractRejectReason = (notes?: string | null): string | null => {
    if (!notes) return null;
    const m = notes.match(/\[Motivo recusa\]:\s*([^\n]+)/);
    return m ? m[1].trim() : null;
  };

  const rejectWithReason = async (budget: BudgetWithClient) => {
    const reason = window.prompt('Por que esse orçamento foi recusado?\n(ex: preço, prazo, concorrente, sumiu, outro)');
    if (reason === null) return;
    const cleaned = reason.trim();
    const baseNotes = (budget.notes || '').replace(/\n?\[Motivo recusa\]:[^\n]*/g, '').trim();
    const newNotes = cleaned
      ? `${baseNotes}\n[Motivo recusa]: ${cleaned}`.trim()
      : baseNotes;
    const { error } = await supabase
      .from('budgets')
      .update({ status: 'rejected', notes: newNotes } as any)
      .eq('id', budget.id);
    if (error) { toast.error(`Erro: ${error.message}`); return; }
    toast.success('Orçamento marcado como recusado');
    fetchData();
  };

  const exportToExcel = () => {
    if (filtered.length === 0) { toast.error('Nada para exportar'); return; }
    const rows = filtered.map(b => ({
      'Código': b.code,
      'Projeto': b.project_name || '',
      'Cliente': (b.clients as any)?.name || '',
      'Telefone': (b.clients as any)?.phone || '',
      'Cidade': (b.clients as any)?.city || '',
      'Status': statusConfig[b.status]?.label || b.status,
      'Custo Total': Number(b.total_cost || 0),
      'Margem (%)': Number(b.profit_margin || 0),
      'Preço Final': Number(b.final_price || 0),
      'Pagamento': b.payment_method || '',
      'Criado em': new Date(b.created_at).toLocaleDateString('pt-BR'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orçamentos');
    XLSX.writeFile(wb, `orcamentos_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${filtered.length} orçamento(s) exportado(s)`);
  };

  const sendWhatsApp = (budget: BudgetWithClient, simplified = false) => {
    const c = budget.clients;
    if (!c?.phone) { toast.error('Cliente sem telefone'); return; }
    const phone = c.phone.replace(/\D/g, '');
    const phoneWithCountry = phone.startsWith('55') ? phone : `55${phone}`;
    const text = generateBudgetText(budget, simplified);
    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const deleteBudget = async (id: string) => {
    if (!confirm('Excluir orçamento?')) return;
    const { error } = await supabase.from('budgets').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir'); else { toast.success('Excluído'); fetchData(); }
  };

  const updateBudgetStatus = async (id: string, status: string) => {
    const budget = budgets.find(b => b.id === id);
    const patch: any = { status };
    if (status === 'approved') {
      // Marca a data de aprovação (fechamento) — usada como referência de faturamento.
      patch.approved_at = new Date().toISOString();
    }
    const { error } = await supabase.from('budgets').update(patch).eq('id', id);
    if (error) { toast.error(`Erro: ${error.message}`); return; }
    if (status === 'approved' && budget && user) {
      await generateReceivablesAndCommission({ ...budget, approved_at: patch.approved_at } as any);
    }
    toast.success(`Status: ${statusConfig[status]?.label || status}`);
    fetchData();
  };

  const generateReceivablesAndCommission = async (budget: BudgetWithClient) => {
    if (!user) return;
    const client = budget.clients;
    const today = new Date().toISOString().slice(0, 10);
    const baseDesc = `${budget.code} — ${client?.name || 'Cliente'}`;

    // Parse meta from notes
    const META_RE = /<!--BUDGET_META:(.*?)-->/s;
    let meta: any = {};
    try {
      const m = (budget.notes || '').match(META_RE);
      if (m) meta = JSON.parse(m[1]);
    } catch { /* noop */ }

    const { data: milestones } = await supabase
      .from('payment_milestones').select('*').eq('budget_id', budget.id).order('sort_order');

    // Wipe previous auto-generated entries for this budget (receivables + auto costs)
    const { data: existingReceivables } = await supabase
      .from('financial_transactions').select('id').eq('budget_id', budget.id)
      .in('category', ['project', 'installment', 'material', 'operational', 'extras', 'commission']);
    if (existingReceivables && existingReceivables.length > 0) {
      await supabase.from('financial_transactions').delete().in('id', existingReceivables.map(t => t.id));
    }

    if (milestones && milestones.length > 0) {
      const inserts = milestones.map((ms: any, idx: number) => {
        const dueDate = ms.due_date || addBusinessDays(new Date(), 30 * (idx + 1)).toISOString().slice(0, 10);
        // try to parse method from notes "Forma: pix"
        const methodMatch = (ms.notes || '').match(/Forma:\s*(\w+)/);
        return {
          user_id: user.id, type: 'income', category: 'installment',
          description: `${baseDesc} — ${ms.title} (${Number(ms.percentage).toFixed(0)}%)`,
          amount: ms.amount, date: today, status: 'pending', due_date: dueDate,
          client_id: budget.client_id, budget_id: budget.id, order_number: budget.code,
          payment_method: methodMatch?.[1] || budget.payment_method || null,
          notes: `Marco "${ms.title}" do orçamento ${budget.code}`,
        };
      });
      await supabase.from('financial_transactions').insert(inserts as any);
    } else {
      const paymentStr = budget.payment_method || '';
      const entradaMatch = paymentStr.match(/Entrada:\s*R\$\s*([\d.,]+)/);
      const downPaymentValue = entradaMatch ? parseFloat(entradaMatch[1].replace(/\./g, '').replace(',', '.')) : 0;
      const remaining = budget.final_price - downPaymentValue;
      const parcelasMatch = paymentStr.match(/(\d+)x\s*de/);
      const numInstallments = parcelasMatch ? parseInt(parcelasMatch[1]) : 1;
      if (downPaymentValue > 0) {
        await supabase.from('financial_transactions').insert({
          user_id: user.id, type: 'income', category: 'project',
          description: `${baseDesc} (Entrada)`, amount: downPaymentValue, date: today,
          status: 'paid', paid_date: today, client_id: budget.client_id, budget_id: budget.id,
          order_number: budget.code, payment_method: paymentStr.split('+')[0]?.trim() || 'PIX',
          notes: `Entrada do orçamento ${budget.code}`,
        } as any);
      }
      if (remaining > 0) {
        await supabase.from('financial_transactions').insert({
          user_id: user.id, type: 'income', category: 'project',
          description: `${baseDesc} (Restante)`, amount: remaining, date: today, status: 'pending',
          due_date: addBusinessDays(new Date(), 30).toISOString().slice(0, 10),
          client_id: budget.client_id, budget_id: budget.id, order_number: budget.code,
          payment_method: numInstallments > 1 ? `${numInstallments}x cartão` : 'A combinar',
          notes: `Saldo restante do orçamento ${budget.code}`,
        } as any);
      }
      if (downPaymentValue === 0 && remaining === 0) {
        await supabase.from('financial_transactions').insert({
          user_id: user.id, type: 'income', category: 'project',
          description: baseDesc, amount: budget.final_price, date: today, status: 'pending',
          client_id: budget.client_id, budget_id: budget.id, order_number: budget.code,
          payment_method: paymentStr || null,
          notes: `Orçamento aprovado: ${budget.code}`,
        } as any);
      }
    }
    toast.info('Contas a receber geradas');

    // ============ CUSTOS ATRELADOS AO CLIENTE (para calcular lucro real) ============
    try {
      const { data: bItems } = await supabase
        .from('budget_items').select('material_cost, labor_cost, quantity').eq('budget_id', budget.id);
      const matMul = Number((budget as any).material_multiplier) || 1;
      const totalMaterial = (bItems || []).reduce((s: number, i: any) => s + Number(i.material_cost || 0) * Number(i.quantity || 1), 0) * matMul;
      const laborTotal = (bItems || []).reduce((s: number, i: any) => s + Number(i.labor_cost || 0) * Number(i.quantity || 1), 0);
      const dueIn7 = addBusinessDays(new Date(), 7).toISOString().slice(0, 10);
      const costInserts: any[] = [];

      if (totalMaterial > 0) {
        costInserts.push({
          user_id: user.id, type: 'expense', category: 'material',
          description: `Materiais — ${baseDesc}`, amount: +totalMaterial.toFixed(2),
          date: today, status: 'pending', due_date: dueIn7,
          client_id: budget.client_id, budget_id: budget.id, order_number: budget.code,
          notes: `Custo de materiais previsto do orçamento ${budget.code}. Confirme como pago ao adquirir os materiais.`,
        });
      }
      const extras = Number(meta.extraTaxes || 0) + Number(meta.extraFreight || 0) + Number(meta.extraOther || 0);
      if (extras > 0) {
        costInserts.push({
          user_id: user.id, type: 'expense', category: 'extras',
          description: `Custos extras — ${baseDesc}`, amount: +extras.toFixed(2),
          date: today, status: 'pending', due_date: dueIn7,
          client_id: budget.client_id, budget_id: budget.id, order_number: budget.code,
          notes: `Taxas/Frete/Outros do orçamento ${budget.code}.`,
        });
      }
      if (meta.includeOverhead !== false) {
        const opCost = Number(budget.total_cost) > 0
          ? Math.max(0, Number(budget.total_cost) - totalMaterial - laborTotal - extras)
          : 0;
        if (opCost > 0) {
          costInserts.push({
            user_id: user.id, type: 'expense', category: 'operational',
            description: `Custo operacional — ${baseDesc}`, amount: +opCost.toFixed(2),
            date: today, status: 'pending', due_date: dueIn7,
            client_id: budget.client_id, budget_id: budget.id, order_number: budget.code,
            notes: `Rateio de custos fixos para o orçamento ${budget.code}.`,
          });
        }
      }
      if (costInserts.length > 0) {
        await supabase.from('financial_transactions').insert(costInserts as any);
        toast.info(`${costInserts.length} custo(s) lançado(s) no Financeiro`);
      }

      // Comissão para vendedor
      const sellerId = (budget as any).seller_id;
      if (sellerId) {
        const profit = Number(budget.final_price) - Number(budget.total_cost);
        const commissionBase = laborTotal + Math.max(0, profit);
        const overridePct = meta.commissionPctOverride;
        const commissionPct = (overridePct !== undefined && overridePct !== null && overridePct !== '')
          ? Number(overridePct)
          : (Number(companySettings?.default_commission ?? 10) || 10);
        const commissionAmt = +(commissionBase * (commissionPct / 100)).toFixed(2);
        const seller = employees.find(e => e.id === sellerId);
        const sellerName = seller?.name || 'Vendedor';
        if (commissionAmt > 0) {
          await supabase.from('financial_transactions').insert({
            user_id: user.id, type: 'expense', category: 'commission', subcategory: sellerName,
            description: `Comissão ${sellerName} — ${baseDesc}`, amount: commissionAmt, date: today,
            due_date: addBusinessDays(new Date(), 30).toISOString().slice(0, 10),
            status: 'pending', client_id: budget.client_id, budget_id: budget.id,
            order_number: budget.code,
            notes: `Comissão gerada na aprovação do orçamento ${budget.code}.\nVendedor: ${sellerName}\nBase: ${formatBRL(commissionBase)} × ${commissionPct}%`,
          } as any);
          toast.info(`Comissão de ${formatBRL(commissionAmt)} criada`);
        } else {
          toast.warning('Comissão não gerada: base de cálculo é zero');
        }
      } else {
        toast.warning('Comissão não gerada: vendedor não definido no orçamento');
      }
    } catch (e) { console.error('[receivables/costs/commission]', e); }
  };

  const sendToProduction = async (budget: BudgetWithClient) => {
    const client = budget.clients;
    if (!client) { toast.error('Sem cliente vinculado'); return; }
    const { error } = await supabase.from('production_tasks').insert({
      user_id: user!.id,
      project_name: budget.project_name || budget.code,
      client_name: client.name, budget_id: budget.id,
      stage: 'corte', priority: 'normal',
      notes: `Orçamento: ${budget.code} - ${formatBRL(budget.final_price)}`,
    });
    if (error) { toast.error('Erro ao enviar'); return; }
    await updateBudgetStatus(budget.id, 'in_production');
    toast.success('Enviado para produção!');
  };

  const openPdfDialog = (budget: BudgetWithClient) => {
    setSelectedBudget(budget);
    setContractClauses([...defaultContractClauses]);
    setEnabledClauses(defaultContractClauses.map(() => true));
    setDeliveryDays(30);
    setPdfSimplified(false);
    setPdfDialogOpen(true);
  };

  const handleGeneratePdf = async () => {
    if (!selectedBudget) return;
    const client = selectedBudget.clients;
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
      items: (budgetItems || []).map((i: any) => ({
        name: i.name, quantity: i.quantity, unit_price: i.unit_price,
        room_label: i.room_label, material_cost: i.material_cost, labor_cost: i.labor_cost,
      })),
      companyName: companySettings?.company_name,
      companyCnpj: companySettings?.cnpj,
      companyPhone: companySettings?.phone,
      companyEmail: companySettings?.email,
      companyAddress: companySettings?.address,
      contractClauses: activeClauses,
      mode: pdfSimplified ? 'client' : 'internal',
      clientDescription: (selectedBudget as any).client_description || null,
      clientPdfOptions: pdfClientOpts,
    });
    setPdfDialogOpen(false);
  };

  const deliveryDate = selectedBudget
    ? addBusinessDays(new Date(selectedBudget.created_at), deliveryDays)
    : addBusinessDays(new Date(), deliveryDays);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">Orçamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">Pipeline comercial — fluxo guiado em 7 etapas</p>
        </div>
        <Button onClick={() => { setEditingBudget(null); setWizardOpen(true); }} className="gradient-primary shadow-primary border-0">
          <Plus className="h-4 w-4 mr-2" /> Novo Orçamento
        </Button>
      </div>

      {/* WIZARD */}
      <BudgetWizardDialog
        open={wizardOpen}
        onOpenChange={(o) => { setWizardOpen(o); if (!o) setEditingBudget(null); }}
        clients={clients}
        employees={employees}
        materialCatalog={materialCatalog}
        companySettings={companySettings}
        overheadPerProject={overheadPerProject}
        editingBudget={editingBudget}
        onClientCreated={(c) => setClients(prev => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))}
        onSaved={async (savedId) => {
          // If editing an already-approved/in-production budget, regenerate financial entries
          // to reflect new values (avoid stale or duplicated transactions).
          const REGEN_STATUSES = ['approved', 'in_production', 'delivered', 'completed'];
          const { data: fresh } = await supabase
            .from('budgets')
            .select('*, clients(id, name, phone, email, city, cpf_cnpj, address, neighborhood, state, cep, address_number, complement)')
            .eq('id', savedId)
            .maybeSingle();
          if (fresh && REGEN_STATUSES.includes((fresh as any).status)) {
            await generateReceivablesAndCommission(fresh as any);
            toast.success('Lançamentos financeiros atualizados com os novos valores');
          }
          fetchData();
        }}
        onApprove={async (id) => updateBudgetStatus(id, 'approved')}
      />

      {/* Funil de Vendas — Diagnóstico do negócio */}
      <div className="card-premium rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-gold" />
            <div>
              <h3 className="font-display text-sm font-semibold">Funil de Vendas — Diagnóstico</h3>
              <p className="text-[11px] text-muted-foreground">{periodLabel[funnelPeriod]} · {kpis.total} orçamento(s)</p>
            </div>
          </div>
          <Select value={funnelPeriod} onValueChange={(v) => setFunnelPeriod(v as any)}>
            <SelectTrigger className="w-40 h-8 rounded-full bg-muted/40 border-0 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="3m">Últimos 3 meses</SelectItem>
              <SelectItem value="6m">Últimos 6 meses</SelectItem>
              <SelectItem value="year">Este ano</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Cards por estágio */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => setFilterStatus('open')}
            className="text-left rounded-xl border border-warning/20 bg-warning/5 p-3 hover:bg-warning/10 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-warning">Em Aberto</span>
              <Clock className="h-3.5 w-3.5 text-warning" />
            </div>
            <p className="font-display text-2xl font-semibold text-warning leading-tight">{kpis.pending}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{formatBRL(kpis.revenuePending)}</p>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('closed')}
            className="text-left rounded-xl border border-success/20 bg-success/5 p-3 hover:bg-success/10 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-success">Fechados</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            </div>
            <p className="font-display text-2xl font-semibold text-success leading-tight">{kpis.approved + kpis.inProduction}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{formatBRL(kpis.revenueApproved)}</p>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('in_production')}
            className="text-left rounded-xl border border-info/20 bg-info/5 p-3 hover:bg-info/10 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-info">Em Produção</span>
              <Hammer className="h-3.5 w-3.5 text-info" />
            </div>
            <p className="font-display text-2xl font-semibold text-info leading-tight">{kpis.inProduction}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{formatBRL(kpis.revenueInProduction)}</p>
          </button>
          <button
            type="button"
            onClick={() => setFilterStatus('rejected')}
            className="text-left rounded-xl border border-destructive/20 bg-destructive/5 p-3 hover:bg-destructive/10 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive">Recusados</span>
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            </div>
            <p className="font-display text-2xl font-semibold text-destructive leading-tight">{kpis.rejected}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{formatBRL(kpis.revenueLost)}</p>
          </button>
        </div>

        {/* Barra de proporção */}
        <div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="bg-success transition-all" style={{ width: `${kpis.pctApproved}%` }} title={`Ganhos: ${kpis.pctApproved.toFixed(0)}%`} />
            <div className="bg-warning transition-all" style={{ width: `${kpis.pctPending}%` }} title={`Abertos: ${kpis.pctPending.toFixed(0)}%`} />
            <div className="bg-destructive transition-all" style={{ width: `${kpis.pctRejected}%` }} title={`Recusados: ${kpis.pctRejected.toFixed(0)}%`} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[11px] text-muted-foreground">
            <span>Conversão: <span className="font-bold text-success">{kpis.winRate.toFixed(0)}%</span></span>
            <span>Ticket médio: <span className="font-semibold text-foreground tabular-nums">{formatBRL(kpis.ticketMedio)}</span></span>
            <span>Receita total fechada: <span className="font-semibold text-gold tabular-nums">{formatBRL(kpis.revenueApproved)}</span></span>
          </div>
        </div>

        {/* Feedbacks de recusa */}
        {kpis.rejectedList.length > 0 && (
          <div className="rounded-xl bg-muted/30 p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <XCircle className="h-3 w-3 text-destructive" /> Motivos de recusa
            </p>
            <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {kpis.rejectedList.slice(0, 8).map((b) => {
                const reason = extractRejectReason(b.notes);
                return (
                  <li key={b.id} className="text-xs flex items-start gap-2">
                    <span className="font-mono text-muted-foreground shrink-0">{b.code}</span>
                    <span className="text-foreground/80 truncate flex-1">
                      {(b.clients as any)?.name || b.project_name || '—'}
                    </span>
                    <span className={`shrink-0 ${reason ? 'text-foreground' : 'italic text-muted-foreground/70'}`}>
                      {reason || 'sem feedback'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>


      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por código, projeto ou cliente..." className="flex-1 min-w-[220px] max-w-md" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 h-9 rounded-full bg-muted/40 border-0 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="open">Em Aberto (rascunho + pendente)</SelectItem>
            <SelectItem value="closed">Fechados (aprovado + em produção)</SelectItem>
            {Object.entries(statusConfig).map(([key, cfg]) => <SelectItem key={key} value={key}>{cfg.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9 rounded-full border-border/60 bg-muted/40 gap-1.5" onClick={exportToExcel}>
          <FileSpreadsheet className="h-3.5 w-3.5 text-success" /> Excel
        </Button>
        {(search || filterStatus !== 'all') && (
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} resultado(s)</span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Card className="card-premium rounded-2xl overflow-hidden">
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
                    <React.Fragment key={b.id}>
                      <motion.tr variants={itemVariants} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedBudgetId(expandedBudgetId === b.id ? null : b.id)}>
                        <td className="px-4 py-3 text-sm font-mono font-medium">
                          <div className="flex items-center gap-1.5">
                            {expandedBudgetId === b.id ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                            {b.code}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{b.project_name || '—'}</td>
                        <td className="px-4 py-3 text-sm font-medium hidden sm:table-cell">{(b.clients as any)?.name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">{formatBRL(b.final_price)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusConfig[b.status]?.className || ''}`}>
                            {statusConfig[b.status]?.label || b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {(b.status === 'draft' || b.status === 'pending') && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-success" onClick={() => updateBudgetStatus(b.id, 'approved')} title="Aprovar">
                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aprovar
                              </Button>
                            )}
                            {(b.status === 'draft' || b.status === 'pending') && (
                              <button onClick={() => rejectWithReason(b)} className="rounded p-1.5 hover:bg-destructive/10" title="Recusar (com motivo)">
                                <XCircle className="h-4 w-4 text-destructive" />
                              </button>
                            )}
                            {b.status === 'approved' && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-info" onClick={() => sendToProduction(b)} title="Enviar para Produção">
                                <Factory className="h-3.5 w-3.5 mr-1" /> Produzir
                              </Button>
                            )}
                            <button onClick={() => openPdfDialog(b)} className="rounded p-1.5 hover:bg-muted" title="PDF">
                              <Download className="h-4 w-4 text-muted-foreground" />
                            </button>
                            <button onClick={() => sendWhatsApp(b, true)} className="rounded p-1.5 hover:bg-muted" title="WhatsApp resumido">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            </button>
                            <button onClick={() => sendWhatsApp(b)} className="rounded p-1.5 hover:bg-muted" title="WhatsApp completo">
                              <Send className="h-4 w-4 text-muted-foreground" />
                            </button>
                            <button onClick={() => { setEditingBudget(b); setWizardOpen(true); }} className="rounded p-1.5 hover:bg-muted" title="Editar">
                              <Edit className="h-4 w-4 text-muted-foreground" />
                            </button>
                            <button onClick={() => deleteBudget(b.id)} className="rounded p-1.5 hover:bg-destructive/10" title="Excluir">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                      <AnimatePresence>
                        {expandedBudgetId === b.id && (
                          <motion.tr initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}>
                            <td colSpan={6} className="px-4 py-4 bg-muted/20">
                              <Tabs defaultValue="dre" className="w-full">
                                <TabsList className="mb-4">
                                  <TabsTrigger value="dre" className="text-xs gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Saúde Financeira</TabsTrigger>
                                  <TabsTrigger value="milestones" className="text-xs gap-1.5"><Milestone className="h-3.5 w-3.5" /> Marcos de Pagamento</TabsTrigger>
                                </TabsList>
                                <TabsContent value="dre">
                                  <ContractDRE budgetId={b.id} finalPrice={b.final_price} totalCost={b.total_cost} profitMargin={b.profit_margin} />
                                </TabsContent>
                                <TabsContent value="milestones">
                                  <PaymentMilestones budgetId={b.id} finalPrice={b.final_price} />
                                </TabsContent>
                              </Tabs>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PDF Dialog */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Gerar PDF — Orçamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="flex items-center justify-between border border-border rounded-xl p-4">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-2">
                  {pdfSimplified ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {pdfSimplified ? 'PDF Cliente (Simplificado)' : 'PDF Interno (Completo)'}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pdfSimplified ? 'Mostra: Projeto, Ambientes, Valores' : 'Mostra: Itens, custos, margem, contrato'}
                </p>
              </div>
              <Switch checked={pdfSimplified} onCheckedChange={setPdfSimplified} />
            </div>

            <div className="space-y-2">
              <Label>Prazo de Entrega (dias úteis)</Label>
              <Input type="number" value={deliveryDays} onChange={e => setDeliveryDays(Number(e.target.value))} className="max-w-[150px]" />
              <p className="text-xs text-muted-foreground">
                Data prevista: <strong>{deliveryDate.toLocaleDateString('pt-BR')}</strong>
              </p>
            </div>

            {pdfSimplified && (
              <div className="space-y-2 border border-border rounded-xl p-4">
                <Label className="text-sm font-semibold">Blocos exibidos no PDF do cliente</Label>
                <p className="text-[11px] text-muted-foreground">Marque o que o cliente deve ver.</p>
                {[
                  { key: 'showDescription', label: 'Descrição do projeto (texto livre)' },
                  { key: 'showItemsList', label: 'Lista detalhada de itens (sem preços)' },
                  { key: 'showPaymentTerms', label: 'Condições de pagamento' },
                  { key: 'showContractClauses', label: 'Termos e cláusulas' },
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer py-1">
                    <Checkbox
                      checked={(pdfClientOpts as any)[opt.key]}
                      onCheckedChange={(c) => setPdfClientOpts(p => ({ ...p, [opt.key]: c === true }))}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            )}

            {!pdfSimplified && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Settings2 className="h-4 w-4" /> Cláusulas do Contrato
                </Label>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {contractClauses.map((clause, idx) => (
                    <div key={idx} className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                      <Checkbox checked={enabledClauses[idx]} onCheckedChange={(c) => {
                        const ne = [...enabledClauses]; ne[idx] = c === true; setEnabledClauses(ne);
                      }} className="mt-0.5" />
                      <p className={`text-xs flex-1 ${!enabledClauses[idx] ? 'line-through text-muted-foreground' : ''}`}>{clause}</p>
                      <button onClick={() => {
                        setContractClauses(contractClauses.filter((_, i) => i !== idx));
                        setEnabledClauses(enabledClauses.filter((_, i) => i !== idx));
                      }} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Nova cláusula..." value={newClause} onChange={e => setNewClause(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newClause.trim()) { setContractClauses([...contractClauses, newClause.trim()]); setEnabledClauses([...enabledClauses, true]); setNewClause(''); } } }}
                    className="text-xs" />
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    if (!newClause.trim()) return;
                    setContractClauses([...contractClauses, newClause.trim()]);
                    setEnabledClauses([...enabledClauses, true]);
                    setNewClause('');
                  }}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>
            )}

            <Button className="w-full gradient-primary shadow-primary border-0" onClick={handleGeneratePdf}>
              <Download className="h-4 w-4 mr-2" />
              {pdfSimplified ? 'Gerar PDF Cliente' : 'Gerar PDF Interno + Contrato'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
