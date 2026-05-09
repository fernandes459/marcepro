import React, { useEffect, useMemo, useState } from 'react';
import {
  User, Briefcase, Layers, Package, DollarSign, Percent, FileCheck2,
  Plus, Trash2, ChevronLeft, ChevronRight, Loader2, Save, FileText, Wrench,
  CheckCircle, Lock, Download, Settings2, Handshake,
} from 'lucide-react';
import Decimal from 'decimal.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatBRL } from '@/lib/format';
import { CurrencyInput } from '@/components/CurrencyInput';
import ClientPicker from './ClientPicker';
import ModuleConfigurator, { ModuleConfig, ModuleResult } from './ModuleConfigurator';
import { AISuggestPricing } from './AISuggestPricing';

// ----------- TYPES -----------
export interface Client {
  id: string; name: string; phone: string; email: string | null; city: string | null;
  cpf_cnpj: string | null; address: string | null; neighborhood: string | null;
  state: string | null; cep: string | null; address_number: string | null; complement: string | null;
}
export interface Employee { id: string; name: string; }
export interface MaterialCatalogItem {
  id: string; name: string; unit_cost: number; unit: string | null; supplier: string | null;
}
export interface BudgetItem {
  name: string; quantity: number; unitPrice: number; materialCost: number;
  laborCost: number; roomLabel: string; unit: string;
}
export interface Budget {
  id: string; code: string; client_id: string | null; project_name: string | null;
  status: string; total_cost: number; profit_margin: number; final_price: number;
  payment_method: string | null; notes: string | null; client_description: string | null; created_at: string;
  complexity_factor: number; finish_type: string | null;
  seller_id?: string | null; project_type?: string | null; budget_mode?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  employees: Employee[];
  materialCatalog: MaterialCatalogItem[];
  companySettings: any;
  overheadPerProject: number;
  editingBudget: Budget | null;
  onClientCreated: (c: Client) => void;
  onSaved: (budgetId: string) => void;
  onApprove?: (budgetId: string) => Promise<void> | void;
}

const DEFAULT_PAYMENT_TEXT = '50% de entrada e o restante na entrega da obra';
const UNIT_OPTIONS = ['un', 'm²', 'm', 'kg', 'pç'];

const COMPLEXITY_OPTIONS = [
  { value: '1.0', label: 'Simples', multiplier: 1.0 },
  { value: '1.15', label: 'Médio', multiplier: 1.15 },
  { value: '1.3', label: 'Alto', multiplier: 1.3 },
  { value: '1.5', label: 'Premium', multiplier: 1.5 },
];
const FINISH_OPTIONS = [
  { value: 'branco', label: 'Branco', multiplier: 1.0 },
  { value: 'amadeirado', label: 'Amadeirado', multiplier: 1.1 },
  { value: 'laminado', label: 'Laminado', multiplier: 1.0 },
  { value: 'pintura_pu', label: 'Pintura PU', multiplier: 1.15 },
  { value: 'laca', label: 'Laca', multiplier: 1.25 },
  { value: 'verniz', label: 'Verniz Natural', multiplier: 1.1 },
  { value: 'madeira_macica', label: 'Madeira Maciça', multiplier: 1.4 },
  { value: 'outro', label: 'Outro', multiplier: 1.0 },
];

const PROJECT_TYPES = [
  'Cozinha', 'Dormitório', 'Closet', 'Sala', 'Home Office',
  'Banheiro', 'Área de Serviço', 'Comercial', 'Corporativo', 'Outro',
];

const TAB_ORDER = ['cliente', 'projeto', 'ambientes', 'modulos', 'operacional', 'precificacao', 'resumo'] as const;
type TabKey = typeof TAB_ORDER[number];

const META_RE = /\n?<!--BUDGET_META:(.*?)-->\n?/s;

export default function BudgetWizardDialog({
  open, onOpenChange, clients, employees, materialCatalog, companySettings,
  overheadPerProject, editingBudget, onClientCreated, onSaved, onApprove,
}: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>('cliente');
  const [saving, setSaving] = useState(false);

  // Tab 1: Cliente
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientNotes, setClientNotes] = useState('');

  // Tab 2: Projeto
  const [projectName, setProjectName] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [projectType, setProjectType] = useState('');
  const [budgetMode, setBudgetMode] = useState<'completo' | 'rapido'>('completo');
  const [projectDate, setProjectDate] = useState(new Date().toISOString().slice(0, 10));
  const [projectNotes, setProjectNotes] = useState('');

  // Tab 3: Ambientes (lista de strings)
  const [environments, setEnvironments] = useState<string[]>(['Cozinha']);
  const [newEnvName, setNewEnvName] = useState('');

  // Tab 4: Módulos / Itens por ambiente
  const [items, setItems] = useState<BudgetItem[]>([]);
  // Engenharia (modo completo)
  const [useParametric, setUseParametric] = useState(false);
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [moduleResult, setModuleResult] = useState<ModuleResult | null>(null);
  const [mdfPricePerM2, setMdfPricePerM2] = useState(85);
  const [edgeTapePricePerM, setEdgeTapePricePerM] = useState(2.5);

  // Tab 5: Custos Operacionais
  const [includeOverhead, setIncludeOverhead] = useState(true);
  const [extraTaxes, setExtraTaxes] = useState(0);
  const [extraFreight, setExtraFreight] = useState(0);
  const [extraOther, setExtraOther] = useState(0);
  const [productionDays, setProductionDays] = useState(0);
  const [commissionPctOverride, setCommissionPctOverride] = useState<number | null>(null);
  // Pagamento parcelado explícito (Tab 6)
  type PaymentInstallment = {
    title: string; amount: number; due_date: string; method: string;
  };
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentInstallment[]>([]);

  // Tab 6: Precificação
  const [margin, setMargin] = useState(40);
  const [discountPct, setDiscountPct] = useState(0);
  const [complexityFactor, setComplexityFactor] = useState('1.0');
  const [finishType, setFinishType] = useState('branco');
  // Pagamento
  const [useAdvancedPayment, setUseAdvancedPayment] = useState(false);
  const [simplePaymentMethod, setSimplePaymentMethod] = useState(DEFAULT_PAYMENT_TEXT);
  const [downPayment, setDownPayment] = useState(0);
  const [downPaymentMethod, setDownPaymentMethod] = useState('pix');
  const [installments, setInstallments] = useState(1);
  const [installmentMethod, setInstallmentMethod] = useState('credit');
  const [cardFeePercent, setCardFeePercent] = useState(0);
  const [clientDescription, setClientDescription] = useState('');

  // Reset / Load on open
  useEffect(() => {
    if (!open) return;
    if (editingBudget) {
      loadFromBudget(editingBudget);
    } else {
      resetAll();
    }
    setTab('cliente');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingBudget?.id]);

  // auto card fee from settings
  useEffect(() => {
    if (installmentMethod === 'credit' && companySettings) {
      const fees = (companySettings as any).card_fees || {};
      const autoFee = fees[String(installments)];
      if (autoFee !== undefined && autoFee !== null) setCardFeePercent(Number(autoFee));
    } else if (installmentMethod !== 'credit') {
      setCardFeePercent(0);
    }
  }, [installments, installmentMethod, companySettings]);

  function resetAll() {
    setSelectedClientId(''); setClientNotes('');
    setProjectName(''); setSellerId(''); setProjectType(''); setBudgetMode('completo');
    setProjectDate(new Date().toISOString().slice(0, 10)); setProjectNotes('');
    setEnvironments(['Cozinha']); setNewEnvName('');
    setItems([]);
    setUseParametric(false); setModules([]); setModuleResult(null);
    setIncludeOverhead(true); setExtraTaxes(0); setExtraFreight(0); setExtraOther(0);
    setProductionDays(0); setCommissionPctOverride(null); setPaymentSchedule([]);
    setMargin(Number(companySettings?.default_margin ?? 40));
    setDiscountPct(0); setComplexityFactor('1.0'); setFinishType('branco');
    setUseAdvancedPayment(false); setSimplePaymentMethod(DEFAULT_PAYMENT_TEXT);
    setDownPayment(0); setInstallments(1); setInstallmentMethod('credit'); setCardFeePercent(0);
    setClientDescription('');
  }

  async function loadFromBudget(b: Budget) {
    setSelectedClientId(b.client_id || '');
    setProjectName(b.project_name || '');
    setSellerId(b.seller_id || '');
    setProjectType(b.project_type || '');
    setBudgetMode((b.budget_mode as any) || 'completo');
    setComplexityFactor(String(b.complexity_factor || '1.0'));
    setFinishType(b.finish_type || 'branco');
    setMargin(Number(b.profit_margin) || 40);
    setClientDescription(b.client_description || '');

    const rawNotes = b.notes || '';
    const metaMatch = rawNotes.match(META_RE);
    let meta: any = {};
    if (metaMatch) { try { meta = JSON.parse(metaMatch[1]); } catch { /* noop */ } }
    setProjectNotes(rawNotes.replace(META_RE, '').trim());
    setExtraTaxes(Number(meta.extraTaxes) || 0);
    setExtraFreight(Number(meta.extraFreight) || 0);
    setExtraOther(Number(meta.extraOther) || 0);
    setDiscountPct(Number(meta.discountPct) || 0);
    setIncludeOverhead(meta.includeOverhead !== false);
    setClientNotes(meta.clientNotes || '');
    if (meta.projectDate) setProjectDate(meta.projectDate);
    if (meta.useParametric) setUseParametric(true); else setUseParametric(false);
    if (Array.isArray(meta.modules)) setModules(meta.modules);
    if (typeof meta.mdfPricePerM2 === 'number') setMdfPricePerM2(meta.mdfPricePerM2);
    if (typeof meta.edgeTapePricePerM === 'number') setEdgeTapePricePerM(meta.edgeTapePricePerM);
    if (meta.useAdvancedPayment) {
      setUseAdvancedPayment(true);
      setDownPayment(Number(meta.downPayment) || 0);
      setDownPaymentMethod(meta.downPaymentMethod || 'pix');
      setInstallments(Number(meta.installments) || 1);
      setInstallmentMethod(meta.installmentMethod || 'credit');
      setCardFeePercent(Number(meta.cardFeePercent) || 0);
    } else {
      setUseAdvancedPayment(false);
      setSimplePaymentMethod(b.payment_method || DEFAULT_PAYMENT_TEXT);
    }
    if (Array.isArray(meta.environments) && meta.environments.length > 0) {
      setEnvironments(meta.environments);
    }
    if (meta.clientDescription && !b.client_description) setClientDescription(meta.clientDescription);

    const { data: bItems } = await supabase
      .from('budget_items').select('*').eq('budget_id', b.id);
    const itemUnits: string[] = Array.isArray(meta.itemUnits) ? meta.itemUnits : [];
    const loaded: BudgetItem[] = (bItems || []).map((i: any, idx: number) => ({
      name: i.name ?? '',
      quantity: Number(i.quantity) || 1,
      unitPrice: Number(i.unit_price) || 0,
      materialCost: Number(i.material_cost) || 0,
      laborCost: Number(i.labor_cost) || 0,
      roomLabel: i.room_label || 'Geral',
      unit: itemUnits[idx] || 'un',
    }));
    setItems(loaded);
    if (loaded.length && (!Array.isArray(meta.environments) || meta.environments.length === 0)) {
      setEnvironments(Array.from(new Set(loaded.map(i => i.roomLabel || 'Geral'))));
    }
  }

  // ========= CALCULATIONS (decimal.js) =========
  const calc = useMemo(() => {
    const D = (n: number | string) => new Decimal(n || 0);
    let totalMaterial = D(0), totalLabor = D(0);
    items.forEach(i => {
      totalMaterial = totalMaterial.plus(D(i.materialCost).times(i.quantity));
      totalLabor = totalLabor.plus(D(i.laborCost).times(i.quantity));
    });
    const itemsCost = totalMaterial.plus(totalLabor);
    const parametricCost = useParametric && moduleResult
      ? D(moduleResult.materialCost).plus(moduleResult.edgeTapeCost).plus(moduleResult.hardwareCost ?? 0)
      : D(0);
    const baseCost = itemsCost.plus(parametricCost).plus(extraTaxes).plus(extraFreight).plus(extraOther);
    const cMul = D(COMPLEXITY_OPTIONS.find(c => c.value === complexityFactor)?.multiplier || 1);
    const fMul = D(FINISH_OPTIONS.find(f => f.value === finishType)?.multiplier || 1);
    const overhead = includeOverhead ? D(overheadPerProject) : D(0);
    const totalCost = baseCost.times(cMul).times(fMul).plus(overhead);
    const profit = totalCost.times(D(margin).div(100));
    const priceBeforeDiscount = totalCost.plus(profit);
    const finalPrice = priceBeforeDiscount.times(D(1).minus(D(discountPct).div(100)));
    const realProfit = finalPrice.minus(totalCost);
    const realMarginPct = totalCost.gt(0) ? realProfit.div(totalCost).times(100) : D(0);
    const minMargin = Number(companySettings?.min_margin ?? 20);
    return {
      totalMaterial: totalMaterial.toNumber(),
      totalLabor: totalLabor.toNumber(),
      itemsCost: itemsCost.toNumber(),
      parametricCost: parametricCost.toNumber(),
      baseCost: baseCost.toNumber(),
      overhead: overhead.toNumber(),
      totalCost: totalCost.toNumber(),
      profit: profit.toNumber(),
      priceBeforeDiscount: priceBeforeDiscount.toNumber(),
      finalPrice: finalPrice.toNumber(),
      realProfit: realProfit.toNumber(),
      realMarginPct: realMarginPct.toNumber(),
      minMargin,
      isBelowMin: totalCost.gt(0) && realMarginPct.lt(minMargin),
    };
  }, [items, useParametric, moduleResult, extraTaxes, extraFreight, extraOther,
      complexityFactor, finishType, includeOverhead, overheadPerProject,
      margin, discountPct, companySettings]);

  // payment per environment (rateado)
  const envSubtotals = useMemo(() => {
    const map = new Map<string, number>();
    environments.forEach(e => map.set(e, 0));
    items.forEach(i => {
      const k = i.roomLabel || 'Geral';
      map.set(k, (map.get(k) || 0) + i.unitPrice * i.quantity);
    });
    const raw = Array.from(map.entries());
    const totalRaw = raw.reduce((s, [, v]) => s + v, 0);
    return raw.map(([env, v]) => ({
      env,
      subtotal: v,
      finalShare: totalRaw > 0 ? (v / totalRaw) * calc.finalPrice : (calc.finalPrice / Math.max(1, raw.length)),
    }));
  }, [items, environments, calc.finalPrice]);

  const remaining = calc.finalPrice - downPayment;
  const cardFeeAmount = remaining * (cardFeePercent / 100);
  const totalWithFee = remaining + (installmentMethod === 'credit' ? cardFeeAmount : 0);
  const installmentValue = installments > 0 ? totalWithFee / installments : 0;

  // ========= ITEM HELPERS =========
  function addItem(env: string) {
    setItems(prev => [...prev, {
      name: '', quantity: 1, unitPrice: 0, materialCost: 0, laborCost: 0,
      roomLabel: env, unit: 'un',
    }]);
  }
  function updateItem(idx: number, field: keyof BudgetItem, value: string | number) {
    setItems(prev => {
      const next = [...prev];
      (next[idx] as any)[field] = value;
      next[idx].unitPrice = Number(next[idx].materialCost || 0) + Number(next[idx].laborCost || 0);
      return next;
    });
  }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }
  function applyCatalog(idx: number, name: string) {
    const m = materialCatalog.find(x => x.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (!m) return;
    setItems(prev => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        name: m.name,
        materialCost: Number(m.unit_cost) || 0,
        unitPrice: Number(m.unit_cost || 0) + Number(next[idx].laborCost || 0),
      };
      return next;
    });
  }

  // ========= ENV HELPERS =========
  function addEnvironment() {
    const v = newEnvName.trim();
    if (!v) return;
    if (environments.includes(v)) { toast.error('Ambiente já existe'); return; }
    setEnvironments(prev => [...prev, v]);
    setNewEnvName('');
  }
  function removeEnvironment(name: string) {
    if (!confirm(`Remover ambiente "${name}" e todos os seus itens?`)) return;
    setEnvironments(prev => prev.filter(e => e !== name));
    setItems(prev => prev.filter(i => i.roomLabel !== name));
  }
  function renameEnvironment(oldName: string, newName: string) {
    if (!newName.trim() || newName === oldName) return;
    if (environments.includes(newName)) { toast.error('Já existe ambiente com esse nome'); return; }
    setEnvironments(prev => prev.map(e => e === oldName ? newName : e));
    setItems(prev => prev.map(i => i.roomLabel === oldName ? { ...i, roomLabel: newName } : i));
  }

  // ========= NAV =========
  const tabIdx = TAB_ORDER.indexOf(tab);
  function nextTab() { if (tabIdx < TAB_ORDER.length - 1) setTab(TAB_ORDER[tabIdx + 1]); }
  function prevTab() { if (tabIdx > 0) setTab(TAB_ORDER[tabIdx - 1]); }

  function buildPaymentDescription() {
    if (!useAdvancedPayment) return simplePaymentMethod;
    const parts: string[] = [];
    if (downPayment > 0) parts.push(`Entrada: ${formatBRL(downPayment)} (${downPaymentMethod === 'pix' ? 'PIX' : downPaymentMethod})`);
    if (remaining > 0 && installments > 0) {
      let text = `${installments}x de ${formatBRL(installmentValue)}`;
      if (installmentMethod === 'credit') text += ' no cartão';
      else text += ` (${installmentMethod === 'pix' ? 'PIX' : installmentMethod})`;
      parts.push(text);
    }
    return parts.join(' + ') || 'A combinar';
  }

  function buildNotesWithMeta() {
    const meta = {
      extraTaxes, extraFreight, extraOther, discountPct,
      useAdvancedPayment, downPayment, downPaymentMethod,
      installments, installmentMethod, cardFeePercent,
      includeOverhead, environments, clientDescription,
      clientNotes, projectDate,
      useParametric, modules, mdfPricePerM2, edgeTapePricePerM,
      itemUnits: items.map(i => i.unit || 'un'),
      salespersonId: sellerId || null,
    };
    const cleaned = (projectNotes || '').replace(META_RE, '').trim();
    return `${cleaned}\n<!--BUDGET_META:${JSON.stringify(meta)}-->`.trim();
  }

  // ========= VALIDATION PER TAB =========
  function validateUntil(target: TabKey): string | null {
    if (!selectedClientId) return 'Selecione um cliente na aba Cliente';
    if (TAB_ORDER.indexOf(target) >= 1) {
      if (!projectName.trim()) return 'Informe o nome do projeto';
      if (!sellerId) return 'Selecione o vendedor responsável';
    }
    if (TAB_ORDER.indexOf(target) >= 2 && environments.length === 0) {
      return 'Adicione ao menos um ambiente';
    }
    return null;
  }

  // ========= SAVE =========
  async function handleSave(approveAfter = false) {
    if (!user) return;
    const err = validateUntil('resumo');
    if (err) { toast.error(err); return; }
    if (calc.isBelowMin) {
      toast.error(`Margem real (${calc.realMarginPct.toFixed(1)}%) abaixo do mínimo (${calc.minMargin}%).`);
      return;
    }
    setSaving(true);
    const paymentDesc = buildPaymentDescription();
    const notesWithMeta = buildNotesWithMeta();

    let budgetId = editingBudget?.id || null;

    const payload: any = {
      client_id: selectedClientId,
      project_name: projectName || null,
      client_description: clientDescription || null,
      total_cost: calc.totalCost,
      profit_margin: margin,
      final_price: calc.finalPrice,
      payment_method: paymentDesc || null,
      notes: notesWithMeta,
      complexity_factor: parseFloat(complexityFactor) || 1.0,
      finish_type: finishType || null,
      seller_id: sellerId || null,
      project_type: projectType || null,
      budget_mode: budgetMode,
    };

    if (editingBudget) {
      const { error } = await supabase.from('budgets').update(payload).eq('id', editingBudget.id);
      if (error) { toast.error(`Erro ao atualizar: ${error.message}`); setSaving(false); return; }
      await supabase.from('budget_items').delete().eq('budget_id', editingBudget.id);
    } else {
      const { data, error } = await supabase.from('budgets')
        .insert({ ...payload, user_id: user.id, code: 'TEMP', status: 'draft' })
        .select().single();
      if (error || !data) { toast.error(`Erro ao criar: ${error?.message}`); setSaving(false); return; }
      budgetId = (data as any).id;
    }

    const insertable = items
      .filter(i => i.name.trim())
      .map(i => ({
        budget_id: budgetId,
        name: i.name,
        quantity: i.quantity,
        material_cost: i.materialCost,
        labor_cost: i.laborCost,
        unit_price: i.unitPrice,
        room_label: i.roomLabel?.trim() || null,
      }));
    if (insertable.length > 0) {
      const { error: iErr } = await supabase.from('budget_items').insert(insertable as any);
      if (iErr) { toast.error(`Erro nos itens: ${iErr.message}`); setSaving(false); return; }
    }

    toast.success(editingBudget ? 'Orçamento atualizado!' : 'Orçamento criado!');
    if (approveAfter && budgetId && onApprove) await onApprove(budgetId);
    onSaved(budgetId!);
    setSaving(false);
    onOpenChange(false);
  }

  const selectedClient = clients.find(c => c.id === selectedClientId) || null;
  const selectedSeller = employees.find(e => e.id === sellerId);

  // ========= RENDER =========
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[100dvh] w-[100dvw] max-w-none rounded-none border-0 p-0 gap-0 grid-rows-[auto_1fr_auto] flex flex-col overflow-hidden sm:rounded-none">
        <div className="flex h-full min-h-0 flex-col bg-background">
          <DialogHeader className="border-b border-border px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="font-display text-lg sm:text-xl">
                  {editingBudget ? `Editar Orçamento ${editingBudget.code}` : 'Novo Orçamento'}
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Etapa {tabIdx + 1} de {TAB_ORDER.length} · {budgetMode === 'completo' ? 'Modo Completo (Engenharia)' : 'Modo Rápido'}
                </p>
              </div>
              <Badge variant="outline" className="hidden sm:inline-flex text-[10px] uppercase tracking-wider">
                {TAB_LABELS[tab]}
              </Badge>
            </div>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="flex-1 flex flex-col overflow-hidden min-h-0">
            {/* Tabs nav: scroll horizontal em mobile */}
            <div className="border-b border-border bg-muted/20 overflow-x-auto shrink-0">
              <TabsList className="w-max bg-transparent h-auto p-1 gap-1">
                {TAB_ORDER.map((k, idx) => {
                  const Icon = TAB_ICONS[k];
                  return (
                    <TabsTrigger
                      key={k}
                      value={k}
                      className="data-[state=active]:bg-background data-[state=active]:shadow-sm h-9 px-3 text-xs gap-1.5 whitespace-nowrap"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{idx + 1}. {TAB_LABELS[k]}</span>
                      <span className="sm:hidden">{TAB_LABELS[k]}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
              <div className="mx-auto max-w-4xl px-4 py-5 sm:px-6 space-y-5">

                {/* ============ TAB 1: CLIENTE ============ */}
                <TabsContent value="cliente" className="mt-0 space-y-4">
                  <SectionTitle icon={User} title="Dados do Cliente" subtitle="Selecione um cliente existente ou cadastre um novo" />
                  <div className="card-premium rounded-2xl p-4 sm:p-5 space-y-4">
                    <ClientPicker
                      clients={clients as any}
                      selectedId={selectedClientId}
                      onSelect={setSelectedClientId}
                      onClientCreated={(c) => { onClientCreated(c as any); setSelectedClientId(c.id); }}
                    />
                    {selectedClient && (
                      <div className="rounded-lg bg-muted/30 p-3 space-y-1 text-sm">
                        <div className="font-medium">{selectedClient.name}</div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {selectedClient.phone && <div>📱 {selectedClient.phone}</div>}
                          {selectedClient.cpf_cnpj && <div>CPF/CNPJ: {selectedClient.cpf_cnpj}</div>}
                          {(selectedClient.address || selectedClient.city) && (
                            <div>
                              {[selectedClient.address, selectedClient.address_number].filter(Boolean).join(', ')}
                              {selectedClient.neighborhood ? ` · ${selectedClient.neighborhood}` : ''}
                              {selectedClient.city ? ` · ${selectedClient.city}/${selectedClient.state || ''}` : ''}
                              {selectedClient.cep ? ` · CEP ${selectedClient.cep}` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Observações sobre o cliente</Label>
                      <Textarea
                        value={clientNotes}
                        onChange={(e) => setClientNotes(e.target.value)}
                        placeholder="Preferências, contatos adicionais, restrições..."
                        className="min-h-[80px] text-sm"
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* ============ TAB 2: PROJETO ============ */}
                <TabsContent value="projeto" className="mt-0 space-y-4">
                  <SectionTitle icon={Briefcase} title="Dados do Projeto" subtitle="Identificação e responsáveis" />
                  <div className="card-premium rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nome do Projeto *</Label>
                        <Input className="h-11" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Ex: Cozinha Planejada Apartamento 502" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Vendedor *</Label>
                        {employees.length === 0 ? (
                          <div className="h-11 rounded-md border border-dashed border-border px-3 flex items-center text-xs text-muted-foreground">
                            Cadastre vendedores em Gestão / Equipe
                          </div>
                        ) : (
                          <Select value={sellerId} onValueChange={setSellerId}>
                            <SelectTrigger className="h-11"><SelectValue placeholder="Selecionar vendedor" /></SelectTrigger>
                            <SelectContent>
                              {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo de Projeto</Label>
                        <Select value={projectType} onValueChange={setProjectType}>
                          <SelectTrigger className="h-11"><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
                          <SelectContent>{PROJECT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Data</Label>
                        <Input type="date" className="h-11" value={projectDate} onChange={(e) => setProjectDate(e.target.value)} />
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
                      <Label className="text-sm font-semibold">Tipo de Orçamento</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setBudgetMode('completo')}
                          className={`rounded-xl border p-3 text-left transition-all ${budgetMode === 'completo' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/60 hover:border-border'}`}
                        >
                          <div className="flex items-center gap-2 font-medium text-sm">
                            <Wrench className="h-4 w-4 text-primary" /> Completo (Engenharia)
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Inclui motor de engenharia com módulos 3D, MDF, fitas e ferragens.
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBudgetMode('rapido')}
                          className={`rounded-xl border p-3 text-left transition-all ${budgetMode === 'rapido' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/60 hover:border-border'}`}
                        >
                          <div className="flex items-center gap-2 font-medium text-sm">
                            <Package className="h-4 w-4 text-primary" /> Rápido (Simplificado)
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Apenas itens com nome, quantidade e preço. Sem engenharia.
                          </p>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Observações do Projeto</Label>
                      <Textarea
                        value={projectNotes}
                        onChange={(e) => setProjectNotes(e.target.value)}
                        placeholder="Anotações internas sobre o projeto..."
                        className="min-h-[80px] text-sm"
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* ============ TAB 3: AMBIENTES ============ */}
                <TabsContent value="ambientes" className="mt-0 space-y-4">
                  <SectionTitle icon={Layers} title="Ambientes" subtitle="Defina os ambientes do projeto (cozinha, sala, quarto...)" />
                  <div className="card-premium rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex gap-2">
                      <Input
                        value={newEnvName}
                        onChange={(e) => setNewEnvName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEnvironment(); } }}
                        placeholder="Nome do ambiente (ex: Cozinha)"
                        className="h-11"
                      />
                      <Button type="button" onClick={addEnvironment} className="h-11">
                        <Plus className="h-4 w-4 mr-1" /> Adicionar
                      </Button>
                    </div>

                    {environments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Nenhum ambiente cadastrado. Adicione pelo menos um para continuar.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {environments.map((env) => {
                          const count = items.filter(i => i.roomLabel === env).length;
                          return (
                            <div key={env} className="rounded-xl border border-border/60 bg-muted/10 p-3 flex items-center gap-2">
                              <Layers className="h-4 w-4 text-primary shrink-0" />
                              <Input
                                defaultValue={env}
                                onBlur={(e) => renameEnvironment(env, e.target.value)}
                                className="h-9 border-0 bg-transparent px-1 font-medium focus-visible:bg-background focus-visible:ring-1"
                              />
                              <Badge variant="secondary" className="text-[10px] shrink-0">{count} item(ns)</Badge>
                              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive shrink-0" onClick={() => removeEnvironment(env)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="text-[11px] text-muted-foreground">
                      💡 Os módulos e medidas serão adicionados na próxima aba, agrupados por ambiente.
                    </div>
                  </div>
                </TabsContent>

                {/* ============ TAB 4: MÓDULOS E MEDIDAS ============ */}
                <TabsContent value="modulos" className="mt-0 space-y-4">
                  <SectionTitle icon={Package} title="Módulos e Medidas" subtitle="Adicione os móveis de cada ambiente" />

                  {environments.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm card-premium rounded-2xl">
                      Crie ambientes na aba anterior primeiro.
                    </div>
                  )}

                  {environments.map((env) => {
                    const envItems = items
                      .map((it, idx) => ({ it, idx }))
                      .filter(({ it }) => it.roomLabel === env);
                    const subtotal = envItems.reduce((s, { it }) => s + it.unitPrice * it.quantity, 0);
                    return (
                      <div key={env} className="card-premium rounded-2xl overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/20">
                          <Layers className="h-4 w-4 text-primary" />
                          <h4 className="font-display font-semibold">{env}</h4>
                          <Badge variant="secondary" className="text-[10px] ml-auto">{envItems.length} módulo(s)</Badge>
                          <span className="text-sm font-semibold text-gold tabular-nums">{formatBRL(subtotal)}</span>
                        </div>
                        <div className="p-3 space-y-2">
                          {envItems.length === 0 && (
                            <div className="text-center text-xs text-muted-foreground py-3">Nenhum módulo neste ambiente</div>
                          )}
                          {envItems.map(({ it, idx }) => (
                            <ItemRow
                              key={idx}
                              item={it}
                              materialCatalog={materialCatalog}
                              onChange={(field, value) => updateItem(idx, field, value)}
                              onCatalog={(name) => applyCatalog(idx, name)}
                              onRemove={() => removeItem(idx)}
                            />
                          ))}
                          <Button type="button" variant="ghost" size="sm" onClick={() => addItem(env)} className="w-full h-9 border border-dashed border-border/60">
                            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar módulo em {env}
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {budgetMode === 'completo' && environments.length > 0 && (
                    <div className="card-premium rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-primary" /> Motor de Engenharia (3D)
                        </Label>
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
                  )}
                </TabsContent>

                {/* ============ TAB 5: CUSTOS OPERACIONAIS ============ */}
                <TabsContent value="operacional" className="mt-0 space-y-4">
                  <SectionTitle icon={DollarSign} title="Custos Operacionais" subtitle="Rateio do overhead da empresa e custos extras" />
                  <div className="card-premium rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <Label className="text-sm font-semibold">Incluir Custo Operacional</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {includeOverhead
                            ? `Adiciona ${formatBRL(overheadPerProject)} por projeto (overhead da empresa)`
                            : 'Custo operacional desconsiderado neste orçamento'}
                        </p>
                        {includeOverhead && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Calculado em Configurações: soma de aluguel, energia, salários, transporte etc, dividido pela média de projetos/mês.
                          </p>
                        )}
                      </div>
                      <Switch checked={includeOverhead} onCheckedChange={setIncludeOverhead} />
                    </div>

                    <div className="border-t border-border/60 pt-4 space-y-3">
                      <Label className="text-sm font-semibold">Custos Adicionais do Projeto</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground">Taxas / Impostos</Label>
                          <CurrencyInput value={extraTaxes} onChange={setExtraTaxes} placeholder="0,00" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground">Frete / Transporte</Label>
                          <CurrencyInput value={extraFreight} onChange={setExtraFreight} placeholder="0,00" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[11px] text-muted-foreground">Outros</Label>
                          <CurrencyInput value={extraOther} onChange={setExtraOther} placeholder="0,00" />
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* ============ TAB 6: MARGEM E PRECIFICAÇÃO ============ */}
                <TabsContent value="precificacao" className="mt-0 space-y-4">
                  <SectionTitle icon={Percent} title="Margem e Precificação" subtitle="Defina margem, acabamento, complexidade e condições de pagamento" />

                  <div className="card-premium rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Complexidade</Label>
                        <Select value={complexityFactor} onValueChange={setComplexityFactor}>
                          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COMPLEXITY_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label} {o.multiplier > 1 ? `(+${((o.multiplier - 1) * 100).toFixed(0)}%)` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Acabamento</Label>
                        <Select value={finishType} onValueChange={setFinishType}>
                          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FINISH_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label} {o.multiplier > 1 ? `(+${((o.multiplier - 1) * 100).toFixed(0)}%)` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="border-t border-border/60 pt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <Label className="text-sm font-semibold">Margem de Lucro</Label>
                        <span className="font-semibold tabular-nums">{margin.toFixed(0)}%</span>
                      </div>
                      <Slider value={[margin]} onValueChange={(v) => setMargin(v[0])} min={0} max={150} step={1} />
                    </div>

                    <div className="border-t border-border/60 pt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <Handshake className="h-4 w-4 text-primary" /> Desconto
                        </Label>
                        <span className="font-semibold tabular-nums">{discountPct.toFixed(1)}%</span>
                      </div>
                      <Slider value={[discountPct]} onValueChange={(v) => setDiscountPct(v[0])} min={0} max={30} step={0.5} />
                      {discountPct > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Economia: <span className="text-destructive font-semibold">-{formatBRL(calc.priceBeforeDiscount - calc.finalPrice)}</span>
                        </p>
                      )}
                    </div>

                    <div className="border-t border-border/60 pt-4">
                      <AISuggestPricing
                        totalCost={calc.totalCost}
                        defaultMargin={Number(companySettings?.default_margin ?? 40)}
                        minMargin={calc.minMargin}
                        projectName={projectName}
                        finishType={finishType}
                        complexity={complexityFactor}
                        rooms={environments}
                        onApply={(price) => {
                          if (calc.totalCost <= 0) return;
                          const target = price / (1 - discountPct / 100);
                          const newMargin = Math.max(0, ((target - calc.totalCost) / calc.totalCost) * 100);
                          setMargin(Number(newMargin.toFixed(1)));
                        }}
                      />
                    </div>
                  </div>

                  {/* Pagamento */}
                  <div className="card-premium rounded-2xl p-4 sm:p-5 space-y-3">
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
                              <SelectContent>{Array.from({ length: 18 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>{n}x</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5"><Label className="text-xs">Método saldo</Label>
                            <Select value={installmentMethod} onValueChange={setInstallmentMethod}>
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
                            <Input type="number" step="0.1" value={cardFeePercent || ''} onChange={e => setCardFeePercent(Number(e.target.value))} className="h-10" />
                          </div>
                        )}
                        <div className="rounded-lg bg-muted/40 p-3 space-y-1 text-sm">
                          {downPayment > 0 && <Row label="Entrada" value={formatBRL(downPayment)} />}
                          <Row label="Saldo" value={formatBRL(remaining)} />
                          {installmentMethod === 'credit' && cardFeePercent > 0 && (
                            <Row label="+ Taxa cartão" value={formatBRL(cardFeeAmount)} valueClass="text-destructive" />
                          )}
                          <div className="flex justify-between border-t border-border/60 pt-1 font-semibold">
                            <span>{installments}x de</span>
                            <span className="text-gold">{formatBRL(installmentValue)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="card-premium rounded-2xl p-4 sm:p-5 space-y-1.5">
                    <Label className="text-sm font-semibold">Descrição para o Cliente (PDF)</Label>
                    <Textarea
                      value={clientDescription}
                      onChange={(e) => setClientDescription(e.target.value)}
                      placeholder="Texto que aparecerá no PDF do cliente..."
                      className="min-h-[70px] text-sm"
                    />
                  </div>
                </TabsContent>

                {/* ============ TAB 7: RESUMO FINAL ============ */}
                <TabsContent value="resumo" className="mt-0 space-y-4">
                  <SectionTitle icon={FileCheck2} title="Resumo Final" subtitle="Confira tudo antes de salvar e gerar PDFs" />

                  {/* Cliente + Projeto */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="card-premium rounded-2xl p-4">
                      <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Cliente</h4>
                      <p className="font-semibold">{selectedClient?.name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{selectedClient?.phone || ''}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedClient ? [selectedClient.city, selectedClient.state].filter(Boolean).join(' / ') : ''}
                      </p>
                    </div>
                    <div className="card-premium rounded-2xl p-4">
                      <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Projeto</h4>
                      <p className="font-semibold">{projectName || '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {projectType || '—'} · {budgetMode === 'completo' ? 'Completo' : 'Rápido'}
                      </p>
                      <p className="text-xs text-muted-foreground">Vendedor: {selectedSeller?.name || '—'}</p>
                    </div>
                  </div>

                  {/* Ambientes com valores */}
                  <div className="card-premium rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/60 bg-muted/20">
                      <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground">Ambientes</h4>
                    </div>
                    <div className="divide-y divide-border/60">
                      {envSubtotals.map(({ env, finalShare, subtotal }) => (
                        <div key={env} className="flex items-center justify-between px-4 py-3">
                          <div>
                            <p className="font-medium">{env}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {items.filter(i => i.roomLabel === env).length} módulo(s) · custo {formatBRL(subtotal)}
                            </p>
                          </div>
                          <p className="font-semibold text-gold tabular-nums">{formatBRL(finalShare)}</p>
                        </div>
                      ))}
                      {envSubtotals.length === 0 && (
                        <div className="px-4 py-3 text-center text-sm text-muted-foreground">Nenhum ambiente adicionado</div>
                      )}
                    </div>
                  </div>

                  {/* Lista materiais */}
                  <div className="card-premium rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
                      <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground">Lista Completa de Materiais</h4>
                      <Badge variant="secondary" className="text-[10px]">{items.length} item(ns)</Badge>
                    </div>
                    {items.length === 0 ? (
                      <div className="px-4 py-3 text-center text-sm text-muted-foreground">Nenhum material lançado</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/10 text-xs">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">Ambiente</th>
                              <th className="text-left px-3 py-2 font-medium">Material</th>
                              <th className="text-right px-3 py-2 font-medium">Qtd</th>
                              <th className="text-right px-3 py-2 font-medium">Unit.</th>
                              <th className="text-right px-3 py-2 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((it, i) => (
                              <tr key={i} className="border-t border-border/40">
                                <td className="px-3 py-2 text-xs text-muted-foreground">{it.roomLabel}</td>
                                <td className="px-3 py-2">{it.name || '—'}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{it.quantity} {it.unit}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{formatBRL(it.unitPrice)}</td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium">{formatBRL(it.unitPrice * it.quantity)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Plano de corte resumido (se engenharia ativa) */}
                  {useParametric && moduleResult && (
                    <div className="card-premium rounded-2xl p-4 space-y-2">
                      <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground">Plano de Corte (estimativa)</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <Stat label="Área total" value={`${moduleResult.totalAreaM2.toFixed(2)} m²`} />
                        <Stat label="Área c/ perda" value={`${moduleResult.totalAreaWithWaste.toFixed(2)} m²`} />
                        <Stat label="Fita de borda" value={`${moduleResult.totalEdgeTapeM.toFixed(1)} m`} />
                        <Stat label="Peso est." value={`${moduleResult.totalWeightKg.toFixed(1)} kg`} />
                      </div>
                    </div>
                  )}

                  {/* Totais financeiros */}
                  <div className="card-premium rounded-2xl p-4 sm:p-5 space-y-2">
                    <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Resumo Financeiro</h4>
                    <Row label="Custo materiais" value={formatBRL(calc.totalMaterial)} />
                    <Row label="Custo mão-de-obra" value={formatBRL(calc.totalLabor)} />
                    {calc.parametricCost > 0 && <Row label="Engenharia (MDF + ferragens)" value={formatBRL(calc.parametricCost)} />}
                    {(extraTaxes + extraFreight + extraOther) > 0 && <Row label="Custos extras" value={formatBRL(extraTaxes + extraFreight + extraOther)} />}
                    {calc.overhead > 0 && <Row label="Overhead operacional" value={formatBRL(calc.overhead)} />}
                    <div className="border-t border-border/60 pt-2 mt-2 space-y-1">
                      <Row label="Custo Total" value={formatBRL(calc.totalCost)} valueClass="font-semibold" />
                      <Row label="Margem" value={`${calc.realMarginPct.toFixed(1)}%`} valueClass={calc.isBelowMin ? 'text-destructive font-semibold' : 'font-semibold'} />
                      <Row label="Lucro" value={formatBRL(calc.realProfit)} valueClass={calc.isBelowMin ? 'text-destructive font-semibold' : 'text-success font-semibold'} />
                    </div>
                    <div className="border-t border-border/60 pt-3 mt-3 flex items-end justify-between">
                      <span className="text-sm uppercase tracking-wider text-muted-foreground">Preço Final</span>
                      <span className="font-display text-3xl font-bold text-gold tabular-nums">{formatBRL(calc.finalPrice)}</span>
                    </div>
                    {calc.isBelowMin && (
                      <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                        <Lock className="h-3.5 w-3.5" /> Margem abaixo do mínimo configurado ({calc.minMargin}%).
                      </p>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      onClick={() => handleSave(false)}
                      disabled={saving || calc.isBelowMin}
                      className="h-12 gradient-primary shadow-primary border-0"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      {editingBudget ? 'Salvar Alterações' : 'Salvar Orçamento'}
                    </Button>
                    {editingBudget && onApprove && (
                      <Button
                        onClick={() => handleSave(true)}
                        disabled={saving || calc.isBelowMin}
                        variant="outline"
                        className="h-12 border-success/40 text-success hover:bg-success/10"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" /> Salvar e Aprovar
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Após salvar, gere PDFs (Cliente / Interno) pela lista de orçamentos.
                  </p>
                </TabsContent>

              </div>
            </div>
          </Tabs>

          {/* FOOTER NAVIGATION */}
          <div className="border-t border-border bg-background px-4 py-3 sm:px-6">
            <div className="mx-auto max-w-4xl flex items-center justify-between gap-3">
              <Button type="button" variant="outline" onClick={prevTab} disabled={tabIdx === 0} className="h-10">
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <div className="flex gap-1">
                {TAB_ORDER.map((k, i) => (
                  <div
                    key={k}
                    className={`h-1.5 w-6 rounded-full transition-colors ${i <= tabIdx ? 'bg-primary' : 'bg-border'}`}
                  />
                ))}
              </div>
              {tabIdx < TAB_ORDER.length - 1 ? (
                <Button type="button" onClick={nextTab} className="h-10 gradient-primary border-0">
                  Avançar <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={() => handleSave(false)}
                  disabled={saving || calc.isBelowMin}
                  className="h-10 gradient-primary border-0"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Salvar
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const TAB_LABELS: Record<TabKey, string> = {
  cliente: 'Cliente',
  projeto: 'Projeto',
  ambientes: 'Ambientes',
  modulos: 'Módulos e Medidas',
  operacional: 'Custos Operacionais',
  precificacao: 'Margem e Precificação',
  resumo: 'Resumo Final',
};
const TAB_ICONS: Record<TabKey, any> = {
  cliente: User, projeto: Briefcase, ambientes: Layers, modulos: Package,
  operacional: DollarSign, precificacao: Percent, resumo: FileCheck2,
};

function SectionTitle({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-xl bg-primary/10 p-2.5"><Icon className="h-5 w-5 text-primary" /></div>
      <div>
        <h3 className="font-display text-lg font-semibold leading-tight">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function Row({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function ItemRow({
  item, materialCatalog, onChange, onCatalog, onRemove,
}: {
  item: BudgetItem;
  materialCatalog: MaterialCatalogItem[];
  onChange: (field: keyof BudgetItem, value: string | number) => void;
  onCatalog: (name: string) => void;
  onRemove: () => void;
}) {
  const subtotal = (item.materialCost + item.laborCost) * item.quantity;
  const listId = useMemo(() => `mat-${Math.random().toString(36).slice(2, 9)}`, []);
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <Input
            list={listId}
            placeholder="Nome do módulo / material"
            value={item.name}
            onChange={(e) => onChange('name', e.target.value)}
            onBlur={(e) => onCatalog(e.target.value)}
            className="text-sm h-9"
          />
          <datalist id={listId}>
            {materialCatalog.map(m => (
              <option key={m.id} value={m.name}>{m.supplier ? `${m.supplier} · ${formatBRL(m.unit_cost)}` : formatBRL(m.unit_cost)}</option>
            ))}
          </datalist>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive shrink-0" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Qtd</label>
          <Input type="number" inputMode="decimal" value={item.quantity}
            onChange={(e) => onChange('quantity', Number(e.target.value))} className="h-9 text-sm" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Unidade</label>
          <Select value={item.unit || 'un'} onValueChange={(v) => onChange('unit', v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Material (R$)</label>
          <CurrencyInput value={item.materialCost} onChange={(v) => onChange('materialCost', v)} placeholder="0,00" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-0.5 block">M.O. (R$)</label>
          <CurrencyInput value={item.laborCost} onChange={(v) => onChange('laborCost', v)} placeholder="0,00" />
        </div>
      </div>
      {subtotal > 0 && (
        <div className="flex justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-1.5">
          <span>Unit.: {formatBRL(item.materialCost + item.laborCost)} / {item.unit}</span>
          <span>Subtotal: <span className="font-semibold text-foreground">{formatBRL(subtotal)}</span></span>
        </div>
      )}
    </div>
  );
}
