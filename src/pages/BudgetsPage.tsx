import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Send, FileText, Loader2, Trash2, Edit, CheckCircle, XCircle,
  Factory, Download, MessageSquare, Settings2, Eye, EyeOff, Wrench, ChevronDown, ChevronUp,
  BarChart3, Milestone, Calculator, Handshake, User, Lock, FileSpreadsheet,
  Clock, CheckCircle2, Hammer, TrendingUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Slider } from '@/components/ui/slider';
// PricingPanel substituído pela barra inferior fixa premium
import { AISuggestPricing } from '@/components/budget/AISuggestPricing';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { SearchInput } from '@/components/SearchInput';
import ModuleConfigurator, { ModuleConfig, ModuleResult } from '@/components/budget/ModuleConfigurator';
import ContractDRE from '@/components/finance/ContractDRE';
import PaymentMilestones from '@/components/finance/PaymentMilestones';

interface BudgetItem { name: string; quantity: number; unitPrice: number; materialCost: number; laborCost: number; roomLabel?: string; unit?: string; }
const UNIT_OPTIONS = ['un', 'm²', 'm', 'kg', 'pç'];
const DEFAULT_PAYMENT_TEXT = '50% de entrada e o restante na entrega da obra';
interface Client {
  id: string; name: string; phone: string; email: string | null; city: string | null;
  cpf_cnpj: string | null; address: string | null; neighborhood: string | null;
  state: string | null; cep: string | null; address_number: string | null; complement: string | null;
}
interface Employee { id: string; name: string; }
interface MaterialCatalogItem {
  id: string;
  name: string;
  unit_cost: number;
  unit: string | null;
  supplier: string | null;
}
interface Budget {
  id: string; code: string; client_id: string | null; project_name: string | null;
  status: string; total_cost: number; profit_margin: number; final_price: number;
  payment_method: string | null; notes: string | null; client_description: string | null; created_at: string;
  complexity_factor: number; finish_type: string | null;
  clients?: Client | null;
}

const COMPLEXITY_OPTIONS = [
  { value: '1.0', label: 'Simples', multiplier: 1.0, description: 'Projeto padrão, sem detalhes complexos' },
  { value: '1.15', label: 'Médio', multiplier: 1.15, description: 'Alguns detalhes customizados' },
  { value: '1.3', label: 'Alto', multiplier: 1.3, description: 'Design elaborado com muitos detalhes' },
  { value: '1.5', label: 'Premium', multiplier: 1.5, description: 'Projeto exclusivo de alta complexidade' },
];

const FINISH_OPTIONS = [
  { value: 'laminado', label: 'Laminado', multiplier: 1.0 },
  { value: 'mdf_cru', label: 'MDF Cru', multiplier: 1.0 },
  { value: 'pintura_pu', label: 'Pintura PU', multiplier: 1.15 },
  { value: 'laca', label: 'Laca', multiplier: 1.25 },
  { value: 'verniz', label: 'Verniz Natural', multiplier: 1.1 },
  { value: 'madeira_macica', label: 'Madeira Maciça', multiplier: 1.4 },
  { value: 'revestimento_natural', label: 'Revestimento Natural', multiplier: 1.35 },
  { value: 'outro', label: 'Outro', multiplier: 1.0 },
];

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
    !simplified && clientData?.email ? `Email: ${clientData.email}` : '',
    !simplified && clientData?.city ? `Cidade: ${clientData.city}` : '',
    '', '── DESCRIÇÃO DO PROJETO ─────────',
    budget.client_description ? budget.client_description : (simplified ? '' : 'Consulte o PDF completo para detalhes técnicos.'),
    '', '── RESUMO ──────────────────────', '',
    `💰 VALOR TOTAL: ${formatBRL(budget.final_price)}`, '',
    budget.payment_method ? `Condições de Pagamento: ${budget.payment_method}` : '',
    '', budget.notes && !simplified ? `Observações Internas: ${budget.notes}` : '',
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
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [materialCatalog, setMaterialCatalog] = useState<MaterialCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
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
  const [pdfSimplified, setPdfSimplified] = useState(false);
  const [expandedBudgetId, setExpandedBudgetId] = useState<string | null>(null);
  const [overheadPerProject, setOverheadPerProject] = useState(0);

const [selectedClientId, setSelectedClientId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [clientDescription, setClientDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [margin, setMargin] = useState(40);
  const [items, setItems] = useState<BudgetItem[]>([{ name: '', quantity: 1, unitPrice: 0, materialCost: 0, laborCost: 0, unit: 'un' }]);
  const [extraTaxes, setExtraTaxes] = useState(0);
  const [extraFreight, setExtraFreight] = useState(0);
  const [extraOther, setExtraOther] = useState(0);
  const [useAdvancedPayment, setUseAdvancedPayment] = useState(false);
  const [downPayment, setDownPayment] = useState(0);
  const [downPaymentMethod, setDownPaymentMethod] = useState('pix');
  const [installments, setInstallments] = useState(1);
  const [installmentMethod, setInstallmentMethod] = useState('credit');
  const [cardFeePercent, setCardFeePercent] = useState(0);
  const [simplePaymentMethod, setSimplePaymentMethod] = useState(DEFAULT_PAYMENT_TEXT);
  const [complexityFactor, setComplexityFactor] = useState('1.0');
  const [finishType, setFinishType] = useState('');
  const [useParametric, setUseParametric] = useState(false);
  const [modules, setModules] = useState<ModuleConfig[]>([{ type: 'armario_inferior', height: 800, width: 600, depth: 550, thickness: 18, shelves: 1, doors: 2 }]);
  const [mdfPricePerM2, setMdfPricePerM2] = useState(85);
  const [edgeTapePricePerM, setEdgeTapePricePerM] = useState(2.5);
  const [moduleResult, setModuleResult] = useState<ModuleResult | null>(null);
  const [discountPct, setDiscountPct] = useState(0);
  const [calcOpen, setCalcOpen] = useState(false);
  const [salespersonId, setSalespersonId] = useState<string>('');
  const [includeOverhead, setIncludeOverhead] = useState(true);

  const fetchData = async () => {
    const [budgetsRes, clientsRes, settingsRes, employeesRes, materialsRes, opCostsRes] = await Promise.all([
      supabase.from('budgets').select('*, clients(id, name, phone, email, city, cpf_cnpj, address, neighborhood, state, cep, address_number, complement)').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('company_settings').select('*').limit(1).maybeSingle(),
      supabase.from('employees').select('id, name').eq('status', 'active').order('name'),
      supabase.from('material_catalog' as any).select('id, name, unit_cost, unit, supplier').order('name'),
      supabase.from('operational_costs').select('monthly_amount, active'),
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
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

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

  const materialSuggestions = useMemo(
    () => materialCatalog.map((material) => ({
      key: material.id,
      label: `${material.name}${material.supplier ? ` · ${material.supplier}` : ''}`,
      value: material.name,
    })),
    [materialCatalog]
  );

  const filtered = budgets.filter(b => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    const clientName = (b.clients as any)?.name || '';
    const q = search.toLowerCase();
    return clientName.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q) ||
      (b.project_name || '').toLowerCase().includes(q);
  });

  const kpis = useMemo(() => {
    const sum = (arr: Budget[]) => arr.reduce((s, b) => s + Number(b.final_price || 0), 0);
    const pending = budgets.filter(b => b.status === 'pending' || b.status === 'draft');
    const approved = budgets.filter(b => b.status === 'approved');
    const inProd = budgets.filter(b => b.status === 'in_production');
    return {
      total: budgets.length,
      pending: pending.length,
      approved: approved.length,
      inProduction: inProd.length,
      revenueApproved: sum(approved) + sum(inProd),
      ticket: budgets.length ? sum(budgets) / budgets.length : 0,
    };
  }, [budgets]);

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
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `orcamentos_${stamp}.xlsx`);
    toast.success(`${filtered.length} orçamento(s) exportado(s)`);
  };

  const totalMaterial = items.reduce((s, i) => s + i.materialCost * i.quantity, 0);
  const totalLabor = items.reduce((s, i) => s + i.laborCost * i.quantity, 0);
  const totalItemsCost = totalMaterial + totalLabor;
  const parametricCost = useParametric && moduleResult ? moduleResult.materialCost + moduleResult.edgeTapeCost : 0;
  const complexityMultiplier = COMPLEXITY_OPTIONS.find(c => c.value === complexityFactor)?.multiplier || 1.0;
  const finishMultiplier = FINISH_OPTIONS.find(f => f.value === finishType)?.multiplier || 1.0;
  const baseCost = totalItemsCost + parametricCost + extraTaxes + extraFreight + extraOther;
  const totalCost = baseCost * complexityMultiplier * finishMultiplier + (includeOverhead ? overheadPerProject : 0);
  const profit = totalCost * (margin / 100);
  const priceBeforeDiscount = totalCost + profit;
  const minMargin = Number(companySettings?.min_margin ?? 20);
  const defaultCommission = Number(companySettings?.default_commission ?? 0);
  const finalPrice = priceBeforeDiscount * (1 - discountPct / 100);
  const realProfit = finalPrice - totalCost;
  const realMarginPct = totalCost > 0 ? (realProfit / totalCost) * 100 : 0;
  const isBelowMin = totalCost > 0 && realMarginPct < minMargin;
  const commissionAmount = finalPrice * (defaultCommission / 100);
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
      if (installmentMethod !== 'credit') text += ` (${installmentMethod === 'pix' ? 'PIX' : installmentMethod})`;
      parts.push(text);
    }
    return parts.join(' + ') || 'A combinar';
  };

  const addItem = () => setItems([...items, { name: '', quantity: 1, unitPrice: 0, materialCost: 0, laborCost: 0, roomLabel: '', unit: 'un' }]);
  const addItemToRoom = (room: string) => setItems([...items, { name: '', quantity: 1, unitPrice: 0, materialCost: 0, laborCost: 0, roomLabel: room, unit: 'un' }]);
  const addNewRoom = () => {
    const existing = new Set(items.map(i => (i.roomLabel || '').trim()).filter(Boolean));
    const suggestions = ['Cozinha', 'Sala', 'Quarto', 'Banheiro', 'Closet', 'Home Office', 'Área de Serviço'];
    const next = suggestions.find(s => !existing.has(s)) || `Ambiente ${existing.size + 1}`;
    setItems([...items, { name: '', quantity: 1, unitPrice: 0, materialCost: 0, laborCost: 0, roomLabel: next, unit: 'un' }]);
  };
  const renameRoom = (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) return;
    setItems(items.map(i => ((i.roomLabel || '').trim() === oldName.trim() ? { ...i, roomLabel: newName } : i)));
  };
  const removeRoom = (room: string) => {
    if (!confirm(`Remover ambiente "${room}" e todos os seus itens?`)) return;
    setItems(items.filter(i => (i.roomLabel || '').trim() !== room.trim()));
  };
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const resolveCatalogMaterial = (value: string) => materialCatalog.find((material) => material.name.trim().toLowerCase() === value.trim().toLowerCase());
  const applyCatalogMaterial = (idx: number, materialName: string) => {
    const material = resolveCatalogMaterial(materialName);
    if (!material) return;
    const updated = [...items];
    updated[idx] = {
      ...updated[idx],
      name: material.name,
      materialCost: Number(material.unit_cost || 0),
      unitPrice: Number(material.unit_cost || 0) + Number(updated[idx].laborCost || 0),
    };
    setItems(updated);
  };
  const updateItem = (idx: number, field: keyof BudgetItem, value: string | number) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    updated[idx].unitPrice = updated[idx].materialCost + updated[idx].laborCost;
    setItems(updated);
  };

const EXTRAS_BLOCK_RE = /\n?<!--BUDGET_META:(.*?)-->\n?/s;
  const buildNotesWithMeta = (raw: string) => {
    const meta = JSON.stringify({
      extraTaxes, extraFreight, extraOther, discountPct,
      useAdvancedPayment, downPayment, downPaymentMethod,
      installments, installmentMethod, cardFeePercent,
      salespersonId: salespersonId || null,
      includeOverhead,
      itemUnits: items.map(i => i.unit || 'un'),
    });
    const cleaned = (raw || '').replace(EXTRAS_BLOCK_RE, '').trim();
    return `${cleaned}\n<!--BUDGET_META:${meta}-->`.trim();
  };

const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedClientId) { toast.error('Selecione um cliente'); return; }
    if (!projectName.trim()) { toast.error('Nome do projeto é obrigatório'); return; }
    if (!salespersonId) { toast.error('Selecione o vendedor responsável'); return; }
    if (isBelowMin) {
      toast.error(`Margem real (${realMarginPct.toFixed(1)}%) abaixo do mínimo configurado (${minMargin}%). Ajuste preço, custo ou desconto.`);
      return;
    }
    setSaving(true);
    const paymentDesc = buildPaymentDescription();
    const notesWithMeta = buildNotesWithMeta(notes);

    if (editingBudgetId) {
      const { error: budgetError } = await supabase.from('budgets').update({
        client_id: selectedClientId,
        project_name: projectName || null,
        client_description: clientDescription || null,
        total_cost: totalCost, profit_margin: margin, final_price: finalPrice,
        payment_method: paymentDesc || null, notes: notesWithMeta,
        complexity_factor: parseFloat(complexityFactor), finish_type: finishType || null,
      } as any).eq('id', editingBudgetId);
      if (budgetError) {
        console.error('Erro ao atualizar orçamento:', budgetError);
        toast.error(`Erro ao atualizar: ${budgetError.message}`);
        setSaving(false);
        return;
      }
      await supabase.from('budget_items').delete().eq('budget_id', editingBudgetId);
      const budgetItems = items.filter(i => i.name.trim()).map(i => ({
        budget_id: editingBudgetId, name: i.name, quantity: i.quantity,
        material_cost: i.materialCost, labor_cost: i.laborCost, unit_price: i.unitPrice,
        room_label: i.roomLabel?.trim() || null,
      }));
      if (budgetItems.length > 0) {
        const { error: itemsError } = await supabase.from('budget_items').insert(budgetItems as any);
        if (itemsError) {
          console.error('Erro ao salvar itens:', itemsError);
          toast.error(`Erro ao salvar itens: ${itemsError.message}`);
          setSaving(false);
          return;
        }
      }
      toast.success('Orçamento atualizado!');
    } else {
      const { data: budgetData, error: budgetError } = await supabase.from('budgets').insert({
        user_id: user.id, client_id: selectedClientId, code: 'TEMP',
        project_name: projectName || null, client_description: clientDescription || null,
        status: 'draft',
        total_cost: totalCost, profit_margin: margin, final_price: finalPrice,
        payment_method: paymentDesc || null, notes: notesWithMeta,
        complexity_factor: parseFloat(complexityFactor), finish_type: finishType || null,
      } as any).select().single();
      if (budgetError || !budgetData) {
        console.error('Erro ao criar orçamento:', budgetError);
        toast.error(`Erro ao criar: ${budgetError?.message || 'desconhecido'}`);
        setSaving(false);
        return;
      }
      const budgetItems = items.filter(i => i.name.trim()).map(i => ({
        budget_id: (budgetData as any).id, name: i.name, quantity: i.quantity,
        material_cost: i.materialCost, labor_cost: i.laborCost, unit_price: i.unitPrice,
        room_label: i.roomLabel?.trim() || null,
      }));
      if (budgetItems.length > 0) {
        const { error: itemsError } = await supabase.from('budget_items').insert(budgetItems as any);
        if (itemsError) {
          console.error('Erro ao salvar itens:', itemsError);
          toast.error(`Erro ao salvar itens: ${itemsError.message}`);
          setSaving(false);
          return;
        }
      }
      toast.success('Orçamento criado com sucesso!');
    }
    setDialogOpen(false); resetForm(); fetchData(); setSaving(false);
  };

const resetForm = () => {
    setSelectedClientId(''); setProjectName(''); setClientDescription(''); setSimplePaymentMethod(DEFAULT_PAYMENT_TEXT); setNotes('');
    setMargin(40); setItems([{ name: '', quantity: 1, unitPrice: 0, materialCost: 0, laborCost: 0, roomLabel: '', unit: 'un' }]);
    setExtraTaxes(0); setExtraFreight(0); setExtraOther(0);
    setUseAdvancedPayment(false); setDownPayment(0); setDownPaymentMethod('pix');
    setInstallments(1); setInstallmentMethod('credit'); setCardFeePercent(0);
    setEditingBudgetId(null); setComplexityFactor('1.0'); setFinishType('');
    setUseParametric(false); setModules([{ type: 'armario_inferior', height: 800, width: 600, depth: 550, thickness: 18, shelves: 1, doors: 2 }]);
    setModuleResult(null); setDiscountPct(0); setCalcOpen(false); setSalespersonId('');
    setIncludeOverhead(true);
  };

const openEditBudget = async (budget: Budget) => {
    // Abre o dialog imediatamente — UX melhor enquanto carrega os itens
    setDialogOpen(true);
    setEditingBudgetId(budget.id);
    setSelectedClientId(budget.client_id || '');
    setProjectName(budget.project_name || '');
    setClientDescription(budget.client_description || '');

    // Extract persisted meta (extras, discount, advanced payment) from notes block
    const rawNotes = budget.notes || '';
    const metaMatch = rawNotes.match(/<!--BUDGET_META:(.*?)-->/s);
    let meta: any = {};
    if (metaMatch) {
      try { meta = JSON.parse(metaMatch[1]); } catch { meta = {}; }
    }
    setNotes(rawNotes.replace(/\n?<!--BUDGET_META:.*?-->\n?/s, '').trim());

    setMargin(budget.profit_margin);
    setExtraTaxes(Number(meta.extraTaxes) || 0);
    setExtraFreight(Number(meta.extraFreight) || 0);
    setExtraOther(Number(meta.extraOther) || 0);
    setDiscountPct(Number(meta.discountPct) || 0);
    setSalespersonId(meta.salespersonId || '');
    setIncludeOverhead(meta.includeOverhead !== false);

    const { data: budgetItems, error: itemsError } = await supabase.from('budget_items').select('*').eq('budget_id', budget.id);
    if (itemsError) {
      console.error('[BudgetsPage] erro ao carregar itens', itemsError);
      toast.error('Erro ao carregar itens do orçamento');
    }
    const itemUnits: string[] = Array.isArray(meta.itemUnits) ? meta.itemUnits : [];
    if (budgetItems && budgetItems.length > 0) {
      setItems(budgetItems.map((i: any, idx: number) => ({
        name: i.name ?? '',
        quantity: Number(i.quantity) || 1,
        unitPrice: Number(i.unit_price) || 0,
        materialCost: Number(i.material_cost) || 0,
        laborCost: Number(i.labor_cost) || 0,
        roomLabel: i.room_label || '',
        unit: itemUnits[idx] || 'un',
      })));
    } else {
      setItems([{ name: '', quantity: 1, unitPrice: 0, materialCost: 0, laborCost: 0, roomLabel: '', unit: 'un' }]);
    }
    // Sempre abre o painel de cálculos ao editar para o usuário ver/ajustar tudo
    setCalcOpen(true);

    if (meta.useAdvancedPayment) {
      setUseAdvancedPayment(true);
      setDownPayment(Number(meta.downPayment) || 0);
      setDownPaymentMethod(meta.downPaymentMethod || 'pix');
      setInstallments(Number(meta.installments) || 1);
      setInstallmentMethod(meta.installmentMethod || 'credit');
      setCardFeePercent(Number(meta.cardFeePercent) || 0);
    } else if (budget.payment_method && budget.payment_method.includes('Entrada:')) {
      setUseAdvancedPayment(true);
    } else {
      setUseAdvancedPayment(false);
      setSimplePaymentMethod(budget.payment_method || DEFAULT_PAYMENT_TEXT);
    }
    setComplexityFactor(String(budget.complexity_factor || '1.0'));
    setFinishType(budget.finish_type || '');
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
    if (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error(`Erro ao atualizar status: ${error.message}`);
      return;
    }
    if (status === 'approved' && budget && user) {
      const client = budget.clients as Client | null;
      const today = new Date().toISOString().slice(0, 10);
      const baseDesc = `${budget.code} — ${client?.name || 'Cliente'}`;

      // Check if payment milestones exist for this budget
      const { data: milestones } = await supabase
        .from('payment_milestones')
        .select('*')
        .eq('budget_id', budget.id)
        .order('sort_order');

      const { data: existingReceivables } = await supabase
        .from('financial_transactions')
        .select('id')
        .eq('budget_id', budget.id)
        .in('category', ['project', 'installment']);

      if (existingReceivables && existingReceivables.length > 0) {
        await supabase
          .from('financial_transactions')
          .delete()
          .in('id', existingReceivables.map((transaction) => transaction.id));
      }

      if (milestones && milestones.length > 0) {
        // Generate receivables from milestones
        const inserts = milestones.map((ms: any, idx: number) => {
          const dueDate = ms.due_date || addBusinessDays(new Date(), 30 * (idx + 1)).toISOString().slice(0, 10);
          return {
            user_id: user.id,
            type: 'income',
            category: 'installment',
            description: `${baseDesc} — ${ms.title} (${ms.percentage}%)`,
            amount: ms.amount,
            date: today,
            status: 'pending',
            due_date: dueDate,
            client_id: budget.client_id,
            budget_id: budget.id,
            order_number: budget.code,
            payment_method: budget.payment_method || null,
            notes: `Marco "${ms.title}" do orçamento ${budget.code}\nValor: ${formatBRL(ms.amount)}\nPercentual: ${ms.percentage}%`,
          };
        });
        await supabase.from('financial_transactions').insert(inserts as any);
      } else {
        // Fallback: parse payment_method text
        const paymentStr = budget.payment_method || '';
        const entradaMatch = paymentStr.match(/Entrada:\s*R\$\s*([\d.,]+)/);
        const downPaymentValue = entradaMatch ? parseFloat(entradaMatch[1].replace(/\./g, '').replace(',', '.')) : 0;
        const remainingValue = budget.final_price - downPaymentValue;
        const parcelasMatch = paymentStr.match(/(\d+)x\s*de/);
        const numInstallments = parcelasMatch ? parseInt(parcelasMatch[1]) : 1;

        if (downPaymentValue > 0) {
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
          const dueDate = addBusinessDays(new Date(), 30);
          await supabase.from('financial_transactions').insert({
            user_id: user.id, type: 'income', category: 'project',
            description: `${baseDesc} (Restante)`,
            amount: remainingValue, date: today, status: 'pending',
            due_date: dueDate.toISOString().slice(0, 10),
            client_id: budget.client_id, budget_id: budget.id,
            order_number: budget.code,
            payment_method: numInstallments > 1 ? `${numInstallments}x cartão` : 'A combinar',
            notes: `Saldo restante do orçamento ${budget.code}`,
          } as any);
        }
        if (downPaymentValue === 0 && remainingValue === 0) {
          await supabase.from('financial_transactions').insert({
            user_id: user.id, type: 'income', category: 'project',
            description: baseDesc, amount: budget.final_price, date: today,
            status: 'pending', client_id: budget.client_id, budget_id: budget.id,
            order_number: budget.code, payment_method: paymentStr || null,
            notes: `Orçamento aprovado: ${budget.code}\nValor total: ${formatBRL(budget.final_price)}`,
          } as any);
        }
      }
      toast.info('Contas a receber geradas automaticamente');

      // Comissão automática para o vendedor responsável
      try {
        const rawNotes = budget.notes || '';
        const metaMatch = rawNotes.match(/<!--BUDGET_META:(.*?)-->/s);
        let meta: any = {};
        if (metaMatch) { try { meta = JSON.parse(metaMatch[1]); } catch { /* noop */ } }
        const sellerId = meta.salespersonId as string | null | undefined;
        if (sellerId) {
          // Evita duplicidade caso o orçamento seja re-aprovado
          const { data: existing } = await supabase
            .from('financial_transactions')
            .select('id')
            .eq('budget_id', budget.id)
            .eq('category', 'commission')
            .limit(1);
          if (!existing || existing.length === 0) {
            const { data: bItems } = await supabase
              .from('budget_items')
              .select('labor_cost, quantity')
              .eq('budget_id', budget.id);
            const laborTotal = (bItems || []).reduce(
              (s: number, i: any) => s + Number(i.labor_cost || 0) * Number(i.quantity || 1),
              0,
            );
            const profit = Number(budget.final_price) - Number(budget.total_cost);
            const commissionBase = laborTotal + Math.max(0, profit);
            const commissionPct = Number(companySettings?.default_commission ?? 10) || 10;
            const commissionAmt = +(commissionBase * (commissionPct / 100)).toFixed(2);
            const seller = employees.find((e) => e.id === sellerId);
            const sellerName = seller?.name || 'Vendedor';
            if (commissionAmt > 0) {
              const dueDate = addBusinessDays(new Date(), 30).toISOString().slice(0, 10);
              await supabase.from('financial_transactions').insert({
                user_id: user.id,
                type: 'expense',
                category: 'commission',
                subcategory: sellerName,
                description: `Comissão ${sellerName} — ${baseDesc}`,
                amount: commissionAmt,
                date: today,
                due_date: dueDate,
                status: 'pending',
                client_id: budget.client_id,
                budget_id: budget.id,
                order_number: budget.code,
                notes: `Ordem de comissão gerada na aprovação do orçamento ${budget.code}.\nVendedor: ${sellerName}\nBase: M.O. (${formatBRL(laborTotal)}) + Margem (${formatBRL(Math.max(0, profit))}) = ${formatBRL(commissionBase)}\nPercentual: ${commissionPct}%\nLiberar pagamento após entrega.`,
              } as any);
              toast.info(`Comissão de ${formatBRL(commissionAmt)} criada para ${sellerName}`);
            }
          }
        }
      } catch (commErr) {
        // eslint-disable-next-line no-console
        console.error('[commission]', commErr);
      }
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
    setPdfSimplified(false);
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
      items: (budgetItems || []).map((i: any) => ({
        name: i.name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        room_label: i.room_label,
        material_cost: i.material_cost,
        labor_cost: i.labor_cost,
      })),
      companyName: companySettings?.company_name,
      companyCnpj: companySettings?.cnpj,
      companyPhone: companySettings?.phone,
      companyEmail: companySettings?.email,
      companyAddress: companySettings?.address,
      contractClauses: activeClauses,
      mode: pdfSimplified ? 'client' : 'internal',
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

  const deliveryDate = selectedBudget ? addBusinessDays(new Date(selectedBudget.created_at), deliveryDays) : addBusinessDays(new Date(), deliveryDays);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">Orçamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">Pipeline comercial — do rascunho à produção</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary shadow-primary border-0"><Plus className="h-4 w-4 mr-2" /> Novo Orçamento</Button>
          </DialogTrigger>
          <DialogContent className="h-[100dvh] w-[100dvw] max-w-none rounded-none border-0 p-0 sm:h-[100dvh] sm:w-[100dvw] sm:max-w-none">
            <form onSubmit={handleCreate} className="flex h-full flex-col overflow-hidden bg-background">
              <DialogHeader className="border-b border-border px-4 py-3 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle className="font-display text-lg sm:text-xl">{editingBudgetId ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle>
                    <p className="mt-1 text-xs text-muted-foreground">Tela cheia para orçamento técnico, negociação e recebíveis.</p>
                  </div>
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-right">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Preço final</p>
                    <p className="font-display text-sm font-semibold">{formatBRL(finalPrice)}</p>
                  </div>
                </div>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pb-44">
                <div className="mx-auto max-w-4xl px-4 py-5 space-y-5 sm:px-6">

                  {/* HEADER: Cliente / Vendedor / Projeto */}
                  <section className="card-premium rounded-2xl p-4 sm:p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Cliente *</Label>
                        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                          <SelectTrigger className="h-11"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                          <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                        </Select>
                        {selectedClientId && (() => {
                          const c = clients.find(x => x.id === selectedClientId);
                          if (!c) return null;
                          const addr = [c.address, c.address_number].filter(Boolean).join(', ') || c.city || '';
                          return (
                            <p className="text-[11px] text-muted-foreground leading-snug">
                              {c.phone}{addr ? ` · ${addr}` : ''}
                            </p>
                          );
                        })()}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Vendedor *</Label>
                        {employees.length === 0 ? (
                          <div className="h-11 rounded-md border border-dashed border-border px-3 flex items-center text-[11px] text-muted-foreground">
                            Cadastre em Configurações
                          </div>
                        ) : (
                          <Select value={salespersonId} onValueChange={setSalespersonId}>
                            <SelectTrigger className="h-11"><SelectValue placeholder="Selecionar vendedor" /></SelectTrigger>
                            <SelectContent>{employees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}</SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Nome do Projeto *</Label>
                        <Input className="h-11" placeholder="Ex: Cozinha Planejada" value={projectName} onChange={(e) => setProjectName(e.target.value)} required />
                      </div>
                    </div>
                  </section>

                  {/* CONTROLES MINIMAIS: Custo Operacional + Complexidade + Acabamento */}
                  <section className="card-premium rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <Label className="text-sm font-semibold">Incluir Custo Operacional</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {includeOverhead
                            ? `Adiciona ${formatBRL(overheadPerProject)} por projeto (overhead da empresa)`
                            : 'Custo operacional desconsiderado neste orçamento'}
                        </p>
                      </div>
                      <Switch checked={includeOverhead} onCheckedChange={setIncludeOverhead} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60">
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Complexidade</Label>
                        <Select value={complexityFactor} onValueChange={setComplexityFactor}>
                          <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COMPLEXITY_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label} {opt.multiplier > 1 ? `(+${((opt.multiplier - 1) * 100).toFixed(0)}%)` : ''}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Acabamento</Label>
                        <Select value={finishType} onValueChange={setFinishType}>
                          <SelectTrigger className="h-10 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                          <SelectContent>
                            {FINISH_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label} {opt.multiplier > 1 ? `(+${((opt.multiplier - 1) * 100).toFixed(0)}%)` : ''}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </section>

                  {/* PROJETO POR AMBIENTE */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Ambientes do Projeto</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Adicione materiais agrupados por ambiente. Cada um terá total separado.</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={addNewRoom} className="h-9 rounded-full">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Ambiente
                      </Button>
                    </div>

                    {(() => {
                      // Agrupa por ambiente preservando ordem de aparição
                      const groups = new Map<string, { items: BudgetItem[]; indices: number[] }>();
                      items.forEach((it, idx) => {
                        const key = (it.roomLabel || '').trim() || 'Geral';
                        if (!groups.has(key)) groups.set(key, { items: [], indices: [] });
                        groups.get(key)!.items.push(it);
                        groups.get(key)!.indices.push(idx);
                      });
                      return Array.from(groups.entries()).map(([roomName, group]) => {
                        const subtotalCost = group.items.reduce((s, i) => s + (i.materialCost + i.laborCost) * i.quantity, 0);
                        const subtotalSale = group.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
                        return (
                          <div key={roomName} className="card-premium rounded-2xl overflow-hidden">
                            {/* Header do ambiente */}
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/20">
                              <Input
                                defaultValue={roomName}
                                onBlur={(e) => renameRoom(roomName, e.target.value)}
                                className="h-9 max-w-[220px] font-display text-base font-semibold border-0 bg-transparent px-2 focus-visible:bg-background focus-visible:ring-1"
                                placeholder="Nome do ambiente"
                              />
                              <div className="ml-auto text-right">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">Total</p>
                                <p className="font-display text-sm font-semibold text-gold leading-tight">{formatBRL(subtotalSale || subtotalCost)}</p>
                              </div>
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeRoom(roomName)} className="h-8 w-8 p-0 text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            {/* Itens do ambiente */}
                            <div className="p-3 space-y-2">
                              {group.items.map((item, localIdx) => {
                                const idx = group.indices[localIdx];
                                const itemSubtotal = (item.materialCost + item.laborCost) * item.quantity;
                                return (
                                  <div key={idx} className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2">
                                    <div className="flex items-start gap-2">
                                      <div className="flex-1">
                                        <Input
                                          list={`mat-sug-${idx}`}
                                          placeholder="Nome do material"
                                          value={item.name}
                                          onChange={(e) => updateItem(idx, 'name', e.target.value)}
                                          onBlur={(e) => applyCatalogMaterial(idx, e.target.value)}
                                          className="text-sm h-9"
                                        />
                                        <datalist id={`mat-sug-${idx}`}>
                                          {materialSuggestions.map(s => <option key={`${idx}-${s.key}`} value={s.value} label={s.label} />)}
                                        </datalist>
                                      </div>
                                      <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(idx)} className="h-9 w-9 p-0 text-destructive shrink-0">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      <div>
                                        <label className="text-[10px] text-muted-foreground mb-0.5 block">Qtd</label>
                                        <Input type="number" inputMode="decimal" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} className="h-9 text-sm" />
                                      </div>
                                      <div>
                                        <label className="text-[10px] text-muted-foreground mb-0.5 block">Unidade</label>
                                        <Select value={item.unit || 'un'} onValueChange={(v) => updateItem(idx, 'unit', v)}>
                                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                                          <SelectContent>{UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <label className="text-[10px] text-muted-foreground mb-0.5 block">Material (R$)</label>
                                        <CurrencyInput value={item.materialCost} onChange={(v) => updateItem(idx, 'materialCost', v)} placeholder="0,00" />
                                      </div>
                                      <div>
                                        <label className="text-[10px] text-muted-foreground mb-0.5 block">M.O. (R$)</label>
                                        <CurrencyInput value={item.laborCost} onChange={(v) => updateItem(idx, 'laborCost', v)} placeholder="0,00" />
                                      </div>
                                    </div>
                                    {itemSubtotal > 0 && (
                                      <div className="flex justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1.5">
                                        <span>Custo unitário: {formatBRL(item.materialCost + item.laborCost)} / {item.unit || 'un'}</span>
                                        <span>Subtotal: <span className="font-semibold text-foreground">{formatBRL(itemSubtotal)}</span></span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              <Button type="button" variant="ghost" size="sm" onClick={() => addItemToRoom(roomName === 'Geral' ? '' : roomName)} className="w-full h-9 border border-dashed border-border/60 text-muted-foreground hover:text-foreground">
                                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item em {roomName}
                              </Button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </section>

                  {/* AVANÇADO (colapsável): Engenharia + Custos extras + Negociação + Pagamento + Notas */}
                  <Collapsible open={calcOpen} onOpenChange={setCalcOpen}>
                    <CollapsibleTrigger asChild>
                      <button type="button" className="w-full flex items-center justify-between rounded-2xl border border-border/60 px-4 py-3 hover:bg-muted/30 transition-colors text-sm">
                        <span className="flex items-center gap-2 font-semibold">
                          <Settings2 className="h-4 w-4 text-primary" /> Opções Avançadas
                          <span className="text-[10px] text-muted-foreground font-normal">Engenharia, custos extras, negociação, pagamento</span>
                        </span>
                        {calcOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 mt-3">

                      {/* Motor de Engenharia */}
                      <div className="card-premium rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold flex items-center gap-2"><Wrench className="h-4 w-4 text-primary" /> Motor de Engenharia</Label>
                          <Switch checked={useParametric} onCheckedChange={setUseParametric} />
                        </div>
                        {useParametric && (
                          <ModuleConfigurator
                            modules={modules}
                            onModulesChange={setModules}
                            mdfPricePerM2={mdfPricePerM2}
                            edgeTapePricePerM={edgeTapePricePerM}
                            onMdfPriceChange={setMdfPricePerM2}
                            onEdgeTapePriceChange={setEdgeTapePricePerM}
                            onResultChange={setModuleResult}
                          />
                        )}
                      </div>

                      {/* Custos extras */}
                      <div className="card-premium rounded-2xl p-4 space-y-3">
                        <Label className="text-sm font-semibold">Custos Adicionais</Label>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">Taxas</label>
                            <CurrencyInput value={extraTaxes} onChange={setExtraTaxes} placeholder="0,00" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">Frete</label>
                            <CurrencyInput value={extraFreight} onChange={setExtraFreight} placeholder="0,00" />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground mb-1 block">Outros</label>
                            <CurrencyInput value={extraOther} onChange={setExtraOther} placeholder="0,00" />
                          </div>
                        </div>
                      </div>

                      {/* Negociação */}
                      <div className="card-premium rounded-2xl p-4 space-y-3">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <Handshake className="h-4 w-4 text-primary" /> Desconto Negociado
                        </Label>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Desconto sobre preço de tabela</span>
                            <span className="font-semibold">{discountPct.toFixed(1)}%</span>
                          </div>
                          <Slider value={[discountPct]} onValueChange={(v) => setDiscountPct(v[0])} min={0} max={30} step={0.5} />
                          {discountPct > 0 && (
                            <p className="text-[11px] text-muted-foreground">
                              Economia para o cliente: <span className="text-destructive font-semibold">-{formatBRL(priceBeforeDiscount - finalPrice)}</span>
                            </p>
                          )}
                        </div>
                        <div className="pt-2 border-t border-border/60">
                          <AISuggestPricing
                            totalCost={totalCost}
                            defaultMargin={Number(companySettings?.default_margin ?? 40)}
                            minMargin={minMargin}
                            projectName={projectName}
                            finishType={finishType}
                            complexity={complexityFactor}
                            rooms={Array.from(new Set(items.map(i => i.roomLabel).filter(Boolean) as string[]))}
                            onApply={(price) => {
                              if (totalCost <= 0) return;
                              const targetPriceBeforeDiscount = price / (1 - discountPct / 100);
                              const newMargin = Math.max(0, ((targetPriceBeforeDiscount - totalCost) / totalCost) * 100);
                              setMargin(Number(newMargin.toFixed(1)));
                            }}
                          />
                        </div>
                      </div>

                      {/* Pagamento (Entrada + Saldo) */}
                      <div className="card-premium rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold">Condições de Pagamento</Label>
                          <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground">Avançado</Label>
                            <Switch checked={useAdvancedPayment} onCheckedChange={setUseAdvancedPayment} />
                          </div>
                        </div>
                        {!useAdvancedPayment ? (
                          <Textarea
                            value={simplePaymentMethod}
                            onChange={(e) => setSimplePaymentMethod(e.target.value)}
                            placeholder="Ex: 50% de entrada e o restante na entrega"
                            className="min-h-[60px] text-sm"
                          />
                        ) : (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5"><Label className="text-xs">Entrada (R$)</Label><CurrencyInput value={downPayment} onChange={setDownPayment} /></div>
                              <div className="space-y-1.5"><Label className="text-xs">Método entrada</Label>
                                <Select value={downPaymentMethod} onValueChange={setDownPaymentMethod}>
                                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="pix">PIX</SelectItem>
                                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                    <SelectItem value="transferencia">Transferência</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5"><Label className="text-xs">Parcelas</Label>
                                <Select value={String(installments)} onValueChange={v => setInstallments(Number(v))}>
                                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                  <SelectContent>{Array.from({length: 18}, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>{n}x</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5"><Label className="text-xs">Método saldo</Label>
                                <Select value={installmentMethod} onValueChange={(v) => { setInstallmentMethod(v); if (v !== 'credit') setCardFeePercent(0); }}>
                                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="credit">Cartão Crédito</SelectItem>
                                    <SelectItem value="debit">Cartão Débito</SelectItem>
                                    <SelectItem value="boleto">Boleto</SelectItem>
                                    <SelectItem value="pix">PIX</SelectItem>
                                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            {installmentMethod === 'credit' && (
                              <div className="space-y-1.5">
                                <Label className="text-xs">Taxa do Cartão (%)</Label>
                                <Input type="number" step="0.1" value={cardFeePercent || ''} onChange={e => setCardFeePercent(Number(e.target.value))} placeholder="Ex: 5.5" className="h-10" />
                              </div>
                            )}
                            <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-sm">
                              {downPayment > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Entrada</span><span className="font-medium">{formatBRL(downPayment)}</span></div>}
                              <div className="flex justify-between"><span className="text-muted-foreground">Saldo</span><span className="font-medium">{formatBRL(remaining)}</span></div>
                              {installmentMethod === 'credit' && cardFeePercent > 0 && (
                                <div className="flex justify-between"><span className="text-muted-foreground">+ Taxa cartão</span><span className="text-destructive font-medium">{formatBRL(cardFeeAmount)}</span></div>
                              )}
                              <div className="flex justify-between border-t border-border/60 pt-1"><span className="font-semibold">{installments}x de</span><span className="font-bold text-gold">{formatBRL(installmentValue)}</span></div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Descrição cliente + observações */}
                      <div className="card-premium rounded-2xl p-4 space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-sm font-semibold">Descrição para o Cliente</Label>
                          <Textarea placeholder="Aparece no PDF do cliente..." value={clientDescription} onChange={(e) => setClientDescription(e.target.value)} className="min-h-[70px] text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-sm font-semibold">Observações Internas</Label>
                          <Textarea placeholder="Notas internas (não aparecem para o cliente)..." value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[60px] text-sm" />
                        </div>
                      </div>

                    </CollapsibleContent>
                  </Collapsible>

                  <datalist id="room-label-suggestions">
                    {Array.from(new Set(items.map(i => i.roomLabel).filter(Boolean) as string[])).map(r => <option key={r} value={r} />)}
                    <option value="Cozinha" /><option value="Sala" /><option value="Quarto" />
                    <option value="Banheiro" /><option value="Closet" /><option value="Home Office" /><option value="Área de Serviço" />
                  </datalist>
                </div>
              </div>

              {/* BARRA INFERIOR FIXA — Custo / Lucro / Margem / Preço Final + Slider + Ação */}
              <div className="border-t border-border bg-background/95 backdrop-blur-md shadow-premium">
                <div className="mx-auto max-w-4xl px-4 py-3 sm:px-6 space-y-2.5">
                  {/* Linha 1: 4 indicadores + status */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Custo total</p>
                      <p className="font-display text-base sm:text-lg font-semibold">{formatBRL(totalCost)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Lucro</p>
                      <p className={`font-display text-base sm:text-lg font-semibold ${isBelowMin ? 'text-destructive' : 'text-success'}`}>{formatBRL(realProfit)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Margem</p>
                      <p className={`font-display text-base sm:text-lg font-semibold ${isBelowMin ? 'text-destructive' : 'text-foreground'}`}>{realMarginPct.toFixed(1)}%</p>
                    </div>
                    <div className="text-right sm:text-left">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Preço final</p>
                      <p className="font-display text-xl sm:text-2xl font-bold text-gold leading-tight">{formatBRL(finalPrice)}</p>
                    </div>
                  </div>

                  {/* Linha 2: slider de margem (sempre visível) */}
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">Margem alvo</span>
                    <Slider value={[margin]} onValueChange={(v) => setMargin(v[0])} min={0} max={150} step={1} className="flex-1" />
                    <span className="text-xs font-semibold tabular-nums w-12 text-right">{margin.toFixed(0)}%</span>
                  </div>

                  {/* Linha 3: ações */}
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      className={`flex-1 h-11 border-0 ${isBelowMin ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'gradient-primary shadow-primary'}`}
                      disabled={saving || isBelowMin}
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      {isBelowMin ? <Lock className="h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                      {isBelowMin ? `Margem mín. ${minMargin}%` : editingBudgetId ? 'Salvar Alterações' : 'Salvar Orçamento'}
                    </Button>
                    {editingBudgetId && (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 border-success/40 text-success hover:bg-success/10"
                        disabled={saving || isBelowMin}
                        onClick={async () => {
                          // Salva primeiro, depois aprova
                          const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                          await handleCreate(fakeEvent);
                          if (editingBudgetId) await updateBudgetStatus(editingBudgetId, 'approved');
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-1.5" /> Aprovar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs Premium */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: kpis.total, icon: FileText, tone: 'text-foreground' },
          { label: 'Pendentes', value: kpis.pending, icon: Clock, tone: 'text-warning' },
          { label: 'Aprovados', value: kpis.approved, icon: CheckCircle2, tone: 'text-success' },
          { label: 'Em Produção', value: kpis.inProduction, icon: Hammer, tone: 'text-info' },
          { label: 'Faturamento Aprovado', value: formatBRL(kpis.revenueApproved), icon: TrendingUp, tone: 'text-gold', wide: true },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className={`card-premium rounded-2xl p-4 ${k.wide ? 'col-span-2 md:col-span-3 lg:col-span-1' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{k.label}</span>
                <Icon className={`h-4 w-4 ${k.tone}`} />
              </div>
              <p className={`font-display text-2xl font-semibold ${k.tone}`}>{k.value}</p>
            </div>
          );
        })}
      </div>

      {/* Barra de filtros minimalista */}
      <div className="flex flex-wrap gap-2 items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por código, projeto ou cliente..." className="flex-1 min-w-[220px] max-w-md" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 h-9 rounded-full bg-muted/40 border-0 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
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
                      <motion.tr variants={itemVariants} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => setExpandedBudgetId(expandedBudgetId === b.id ? null : b.id)}>
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
                              <button onClick={() => updateBudgetStatus(b.id, 'rejected')} className="rounded p-1.5 hover:bg-destructive/10 transition-colors" title="Rejeitar">
                                <XCircle className="h-4 w-4 text-destructive" />
                              </button>
                            )}
                            {b.status === 'approved' && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-info" onClick={() => sendToProduction(b)} title="Enviar para Produção">
                                <Factory className="h-3.5 w-3.5 mr-1" /> Produzir
                              </Button>
                            )}
                            <button onClick={() => openPdfDialog(b)} className="rounded p-1.5 hover:bg-muted transition-colors" title="PDF Completo">
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
                      {/* Expandable detail: DRE + Payment Milestones */}
                      <AnimatePresence>
                        {expandedBudgetId === b.id && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <td colSpan={6} className="px-4 py-4 bg-muted/20">
                              <Tabs defaultValue="dre" className="w-full">
                                <TabsList className="mb-4">
                                  <TabsTrigger value="dre" className="text-xs gap-1.5">
                                    <BarChart3 className="h-3.5 w-3.5" /> Saúde Financeira
                                  </TabsTrigger>
                                  <TabsTrigger value="milestones" className="text-xs gap-1.5">
                                    <Milestone className="h-3.5 w-3.5" /> Marcos de Pagamento
                                  </TabsTrigger>
                                </TabsList>
                                <TabsContent value="dre">
                                  <ContractDRE
                                    budgetId={b.id}
                                    finalPrice={b.final_price}
                                    totalCost={b.total_cost}
                                    profitMargin={b.profit_margin}
                                  />
                                </TabsContent>
                                <TabsContent value="milestones">
                                  <PaymentMilestones
                                    budgetId={b.id}
                                    finalPrice={b.final_price}
                                  />
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

      {/* PDF / Contract Dialog */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Gerar PDF — Orçamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Modo de PDF */}
            <div className="flex items-center justify-between border border-border rounded-xl p-4">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-2">
                  {pdfSimplified ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {pdfSimplified ? 'Modo Simplificado (Cliente)' : 'Modo Completo (Interno)'}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {pdfSimplified
                    ? 'Mostra apenas: Projeto, Cliente, Valor Total e Condições'
                    : 'Mostra todos os detalhes: itens, custos, cláusulas'}
                </p>
              </div>
              <Switch checked={pdfSimplified} onCheckedChange={setPdfSimplified} />
            </div>

            <div className="space-y-2">
              <Label>Prazo de Entrega (dias úteis)</Label>
              <Input type="number" value={deliveryDays} onChange={e => setDeliveryDays(Number(e.target.value))} className="max-w-[150px]" />
              <p className="text-xs text-muted-foreground">
                Data prevista de entrega: <strong>{deliveryDate.toLocaleDateString('pt-BR')}</strong>
              </p>
            </div>

            {!pdfSimplified && (
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
            )}

            <Button className="w-full gradient-primary shadow-primary border-0" onClick={handleGeneratePdf}>
              <Download className="h-4 w-4 mr-2" />
              {pdfSimplified ? 'Gerar PDF Simplificado' : 'Gerar PDF Completo + Contrato'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
