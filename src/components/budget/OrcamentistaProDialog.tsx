import React, { useMemo, useRef, useState } from 'react';
import {
  Brain, Loader2, Upload, X, FileText, FileSpreadsheet, Sparkles, Plus, Trash2, CheckCircle2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatBRL } from '@/lib/format';
import { computeCosts, vendaForMargin, type CostBreakdown } from '@/lib/orcamento-costs';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Socio { nome: string; percentual: number }
interface FileIn { name: string; mime: string; data: string; size: number }
interface AIQuestion { id: string; pergunta: string; opcoes: string[]; sugerido?: string; permite_outro?: boolean }

const EMPRESAS = ['FW Planejados', 'PlanejadoSousa'];
const PADROES = ['Econômico', 'Médio padrão', 'Alto padrão', 'Luxo'];
const MATERIAIS = ['MDF', 'MDP', 'Compensado', 'Madeira Maciça', 'Outro'];

/** Especificações técnicas rápidas — clique para selecionar. */
const SPEC_GROUPS: { key: string; label: string; options: string[] }[] = [
  { key: 'Espessura da caixa', label: 'Espessura da caixa', options: ['15mm', '18mm', '25mm'] },
  { key: 'Espessura das portas', label: 'Espessura das portas', options: ['15mm', '18mm', '25mm'] },
  { key: 'Espessura do fundo', label: 'Espessura do fundo', options: ['3mm', '6mm', '15mm', '18mm'] },
  { key: 'Espessura das prateleiras', label: 'Prateleiras', options: ['15mm', '18mm', '25mm'] },
  { key: 'Fita de borda', label: 'Fita de borda', options: ['0,45mm', '1mm', '2mm', 'Sem fita'] },
  { key: 'Corrediças', label: 'Corrediças', options: ['Roldana', 'Telescópica', 'Soft-close', 'Oculta soft-close'] },
  { key: 'Dobradiças', label: 'Dobradiças', options: ['Comum', 'Soft-close', 'Importada premium'] },
  { key: 'Puxadores', label: 'Puxadores', options: ['Perfil embutido', 'Alumínio', 'Cava usinada', 'Sem puxador'] },
  { key: 'Acabamento', label: 'Acabamento', options: ['MDF TX', 'Laca fosca', 'Laca brilho', 'Lâmina natural'] },
  { key: 'Iluminação LED', label: 'Iluminação LED', options: ['Não', 'Fita LED simples', 'LED com sensor'] },
  { key: 'Vidros/Espelhos', label: 'Vidros / Espelhos', options: ['Não', 'Espelho', 'Vidro reflecta', 'Vidro comum'] },
  { key: 'Instalação inclusa', label: 'Instalação', options: ['Inclusa', 'Não inclusa'] },
];


const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function OrcamentistaProDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [precoManual, setPrecoManual] = useState('');
  const [approving, setApproving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);

  const [empresa, setEmpresa] = useState('FW Planejados');
  const [cliente, setCliente] = useState('');
  const [margemDesejada, setMargemDesejada] = useState('30');
  const [prazoDias, setPrazoDias] = useState('');
  const [custoDiario, setCustoDiario] = useState('');
  const [funcionarios, setFuncionarios] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [padrao, setPadrao] = useState('Alto padrão');
  const [material, setMaterial] = useState('MDF');
  const [comissao, setComissao] = useState('0');
  const [montador, setMontador] = useState('0');
  const [impostos, setImpostos] = useState('0');
  const [frete, setFrete] = useState('0');
  const [perda, setPerda] = useState('15');
  const [socios, setSocios] = useState<Socio[]>([{ nome: '', percentual: 50 }, { nome: '', percentual: 50 }]);
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<FileIn[]>([]);

  // Especificações técnicas rápidas (chips clicáveis)
  const [specs, setSpecs] = useState<Record<string, string>>({});
  const setSpec = (k: string, v: string) => setSpecs(p => ({ ...p, [k]: p[k] === v ? '' : v }));

  // Perguntas geradas pela IA
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [answersQ, setAnswersQ] = useState<Record<string, string>>({});
  const [asking, setAsking] = useState(false);

  const isFW = empresa === 'FW Planejados';
  const somaSocios = useMemo(() => socios.reduce((s, x) => s + n(x.percentual), 0), [socios]);


  /** Somatórios dos itens devolvidos pela IA (fonte da verdade dos materiais). */
  const sumList = (arr: any[] | undefined, qty: string, unit: string, total: string) =>
    (arr || []).reduce((s, i) => s + (n(i?.[total]) || n(i?.[qty]) * n(i?.[unit])), 0);

  /**
   * Composição de custos calculada localmente (decimal.js) — a IA sugere quantidades,
   * mas quem fecha os números é o motor: comissões, montador, impostos e frete SEMPRE entram.
   */
  const costs: CostBreakdown | null = useMemo(() => {
    if (!result) return null;
    const mat = sumList(result.materiais, 'quantidade', 'valor_unitario', 'valor_total')
      || n(result.custos?.material);
    const fer = sumList(result.ferragens, 'quantidade', 'valor_unitario', 'valor_total');
    return computeCosts({
      material: mat,
      ferragens: fer,
      estruturaPct: isFW ? 10 : 0,
      custoDiario: n(custoDiario),
      dias: n(prazoDias),
      overheadPct: 7,
      frete: n(frete),
      comissaoPct: n(comissao),
      montadorPct: n(montador),
      impostosPct: n(impostos),
      margemPct: n(margemDesejada),
    });
  }, [result, isFW, custoDiario, prazoDias, frete, comissao, montador, impostos, margemDesejada]);

  const varPct = n(comissao) + n(montador) + n(impostos);

  /** Faixas de preço recalculadas com a mesma engine (mínimo 15%, ideal, premium +20 p.p.). */
  const tiers = useMemo(() => {
    if (!costs) return { minimo: 0, ideal: 0, premium: 0 };
    return {
      minimo: vendaForMargin(costs.custoDireto, 15, varPct),
      ideal: costs.venda,
      premium: vendaForMargin(costs.custoDireto, n(margemDesejada) + 20, varPct),
    };
  }, [costs, varPct, margemDesejada]);

  /** Valor de venda oficial = engine local (mantém coerência com o Excel e o PDF). */
  const vendaOf = (r: any) =>
    costs?.venda ||
    n(r?.resultado_financeiro?.valor_venda) ||
    n(r?.custos?.total) * (1 + n(margemDesejada) / 100);

  /** Preço que será usado na aprovação: manual > faixa selecionada > ideal calculado. */
  const precoFinal = n(precoManual) || selectedPrice || (result ? vendaOf(result) : 0);

  /** Edita um item (material/ferragem) recalculando o total e, em cascata, todo o custo. */
  const updateItem = (list: 'materiais' | 'ferragens', idx: number, field: string, value: string) => {
    setResult((prev: any) => {
      if (!prev) return prev;
      const arr = [...(prev[list] || [])];
      const item = { ...arr[idx] };
      item[field] = field === 'descricao' || field === 'item' || field === 'unidade' ? value : n(value);
      item.valor_total = n(item.quantidade) * n(item.valor_unitario);
      arr[idx] = item;
      return { ...prev, [list]: arr };
    });
  };

  const removeItem = (list: 'materiais' | 'ferragens', idx: number) => {
    setResult((prev: any) => prev
      ? { ...prev, [list]: (prev[list] || []).filter((_: any, i: number) => i !== idx) }
      : prev);
  };

  const addItem = (list: 'materiais' | 'ferragens') => {
    setResult((prev: any) => {
      if (!prev) return prev;
      const novo = list === 'materiais'
        ? { descricao: '', quantidade: 1, unidade: 'un', valor_unitario: 0, valor_total: 0 }
        : { item: '', quantidade: 1, valor_unitario: 0, valor_total: 0 };
      return { ...prev, [list]: [...(prev[list] || []), novo] };
    });
  };

  /** Reimporta a planilha editada: materiais, ferragens e parâmetros voltam para o app. */
  const importXlsx = async (file: File | undefined) => {
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const grid = (name: string): any[][] =>
        wb.Sheets[name] ? XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true }) as any[][] : [];

      const mats = grid('MATERIAIS').slice(2)
        .filter(r => r?.[0] && !String(r[0]).startsWith('SUBTOTAL'))
        .map(r => ({
          descricao: String(r[0]), quantidade: n(r[1]), unidade: String(r[2] || 'un'),
          valor_unitario: n(r[3]), valor_total: n(r[1]) * n(r[3]),
        }));
      const ferr = grid('FERRAGENS').slice(2)
        .filter(r => r?.[0] && !String(r[0]).startsWith('SUBTOTAL'))
        .map(r => ({
          item: String(r[0]), quantidade: n(r[1]),
          valor_unitario: n(r[2]), valor_total: n(r[1]) * n(r[2]),
        }));

      const custos = grid('CUSTOS');
      const par = (row: number) => n(custos[row - 1]?.[1]);
      const asPct = (v: number) => (v > 0 && v <= 1 ? v * 100 : v);
      if (custos.length) {
        if (par(3)) setMargemDesejada(String(asPct(par(3))));
        setComissao(String(asPct(par(4))));
        setMontador(String(asPct(par(5))));
        setImpostos(String(asPct(par(6))));
        if (par(9)) setCustoDiario(String(par(9)));
        if (par(10)) setPrazoDias(String(par(10)));
        setFrete(String(par(11)));
      }

      if (!mats.length && !ferr.length && !custos.length) {
        toast.error('Planilha sem as abas MATERIAIS / FERRAGENS / CUSTOS.');
        return;
      }

      setResult((prev: any) => ({
        ...(prev || {}),
        materiais: mats.length ? mats : prev?.materiais || [],
        ferragens: ferr.length ? ferr : prev?.ferragens || [],
      }));
      setSelectedPrice(0);
      setPrecoManual('');
      toast.success('Planilha importada — preço recalculado com os valores editados');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível ler a planilha.');
    }
  };


  const missing = useMemo(() => {
    const m: string[] = [];
    if (!cliente.trim()) m.push('nome do cliente');
    if (!n(margemDesejada)) m.push('margem de lucro desejada');
    if (!n(prazoDias)) m.push('prazo de produção');
    if (!n(custoDiario)) m.push('custo diário da equipe');
    if (!n(funcionarios)) m.push('nº de funcionários');
    if (!cidade.trim()) m.push('cidade');
    if (!estado.trim()) m.push('estado');
    if (isFW && somaSocios !== 100) m.push('participação dos sócios (deve somar 100%)');
    return m;
  }, [cliente, margemDesejada, prazoDias, custoDiario, funcionarios, cidade, estado, isFW, somaSocios]);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const accepted: FileIn[] = [];
    for (const f of Array.from(list)) {
      if (f.size > 15 * 1024 * 1024) { toast.error(`${f.name}: máximo 15MB`); continue; }
      accepted.push({ name: f.name, mime: f.type || 'application/pdf', data: await fileToBase64(f), size: f.size });
    }
    setFiles(prev => [...prev, ...accepted].slice(0, 6));
  };

  const buildBody = async (mode: 'orcamento' | 'perguntas') => {
    const { data: promptRow } = await supabase
      .from('ai_prompts' as any)
      .select('content')
      .eq('key', 'orcamentista_pro')
      .maybeSingle();
    const stored = ((promptRow as any)?.content as string) || '';
    const [customPrompt, extraRules] = stored.split('\n<<<REGRAS_EXTRAS>>>\n');

    const cleanSpecs = Object.fromEntries(Object.entries(specs).filter(([, v]) => v));
    const clarifications = questions
      .filter(q => answersQ[q.id])
      .map(q => ({ pergunta: q.pergunta, resposta: answersQ[q.id] }));

    return {
      mode,
      answers: {
        empresa, cliente,
        margemDesejada: n(margemDesejada), prazoDias: n(prazoDias),
        custoDiarioEquipe: n(custoDiario), funcionarios: n(funcionarios),
        cidade, estado, padrao, material,
        comissaoVendedor: n(comissao), montadorPct: n(montador), impostosPct: n(impostos),
        freteInstalacao: n(frete), perdaTecnicaPct: n(perda),
        socios: isFW ? socios.filter(s => s.nome.trim()) : [],
      },
      specs: cleanSpecs,
      clarifications,
      notes,
      files: files.map(f => ({ name: f.name, mime: f.mime, data: f.data })),
      customPrompt: (customPrompt || '').trim() || undefined,
      extraRules: (extraRules || '').trim() || undefined,
    };
  };

  const readError = async (error: any) => {
    let detail = '';
    try {
      const ctx: any = error?.context;
      if (ctx && typeof ctx.json === 'function') detail = (await ctx.clone().json())?.error || '';
    } catch { /* ignore */ }
    return detail || error?.message || 'Falha na IA';
  };

  const askQuestions = async () => {
    if (!files.length && !notes.trim()) { toast.error('Anexe o projeto ou descreva as medidas primeiro.'); return; }
    setAsking(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-orcamentista-pro', {
        body: await buildBody('perguntas'),
      });
      if (error) throw new Error(await readError(error));
      if (data?.error) throw new Error(data.error);
      const qs: AIQuestion[] = (data?.perguntas || []).filter((q: any) => q?.pergunta && q?.opcoes?.length);
      if (!qs.length) { toast.info('A IA não encontrou dúvidas — pode gerar o orçamento.'); return; }
      setQuestions(qs);
      setAnswersQ(prev => {
        const next = { ...prev };
        qs.forEach(q => { if (!next[q.id] && q.sugerido) next[q.id] = q.sugerido; });
        return next;
      });
      toast.success(`${qs.length} perguntas geradas — selecione as opções`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao gerar perguntas');
    } finally {
      setAsking(false);
    }
  };

  const analyze = async () => {
    if (missing.length) { toast.error(`Informe: ${missing.join(', ')}`); return; }
    if (!files.length && !notes.trim()) { toast.error('Anexe o projeto (PDF/imagem) ou descreva as medidas.'); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-orcamentista-pro', {
        body: await buildBody('orcamento'),
      });

      if (error) {
        // Lê o corpo real da resposta (invoke devolve mensagem genérica em não-2xx)
        let detail = '';
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.clone().json();
            detail = body?.error || '';
          }
        } catch { /* ignore */ }
        throw new Error(detail || error.message || 'Falha ao analisar o projeto');
      }
      if (data?.error) throw new Error(data.error);

      setResult(data);
      setSelectedPrice(0); // 0 = usa o preço ideal calculado pela engine local
      toast.success('Orçamento analisado pela IA');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Falha ao analisar o projeto');
    } finally {
      setLoading(false);
    }
  };

  /* ---------- aprovar e criar orçamento (entra em "Em Aberto") ---------- */

  const approveBudget = async () => {
    if (!result) return;
    const preco = precoFinal;
    if (preco <= 0) { toast.error('Selecione um preço válido.'); return; }
    setApproving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error('Sessão expirada. Faça login novamente.');

      // Cliente: reaproveita se já existir pelo nome
      let clientId: string | null = null;
      const { data: found } = await supabase
        .from('clients').select('id').ilike('name', cliente.trim()).limit(1).maybeSingle();
      if (found?.id) clientId = found.id;
      else {
        const { data: created } = await supabase
          .from('clients')
          .insert({ user_id: user.id, name: cliente.trim(), phone: '', city: cidade || null, state: estado || null })
          .select('id').single();
        clientId = created?.id ?? null;
      }

      const custo = costs?.custoTotal || n(result.custos?.total);
      const margem = custo > 0 ? ((preco - custo) / custo) * 100 : 0;

      // Rateio do preço entre os ambientes (por área) para o PDF do cliente sair preenchido
      const ambientesArr = (result.ambientes || []) as any[];
      const ambienteNomes = ambientesArr.map((a: any) => a?.nome).filter(Boolean);
      const areaTotal = ambientesArr.reduce((s, a) => s + n(a.area_m2), 0);
      const valorAmbiente = (a: any) =>
        areaTotal > 0 ? (n(a.area_m2) / areaTotal) * preco : preco / Math.max(1, ambientesArr.length);


      const { data: budget, error } = await supabase.from('budgets').insert({
        user_id: user.id,
        code: 'TEMP',
        status: 'pending',
        client_id: clientId,
        project_name: ambienteNomes.length
          ? `Projeto de ${ambienteNomes.join(' + ')}`
          : `${padrao} · ${material} — ${cliente.trim()}`,
        client_description: result.resumo_executivo?.material || material,
        total_cost: custo,
        profit_margin: Number(margem.toFixed(2)),
        final_price: preco,
        finish_type: padrao,
        source: 'Orçamentista IA',
        notes: (result.recomendacao_comercial?.justificativa || '').slice(0, 1000),
      } as any).select('id').single();
      if (error || !budget) throw new Error(error?.message || 'Falha ao criar orçamento');

      const itens = [
        ...ambientesArr.map((a: any) => ({
          name: a.descricao || a.nome || 'Ambiente', quantity: 1,
          material_cost: 0, labor_cost: 0,
          unit_price: Number(valorAmbiente(a).toFixed(2)),
          room_label: a.nome || 'Projeto',
        })),
        ...(result.materiais || []).map((m: any) => ({
          name: m.descricao || 'Material', quantity: Math.max(1, Math.round(n(m.quantidade)) || 1),
          material_cost: n(m.valor_unitario), labor_cost: 0, unit_price: n(m.valor_unitario), room_label: null,
        })),
        ...(result.ferragens || []).map((f: any) => ({
          name: f.item || 'Ferragem', quantity: Math.max(1, Math.round(n(f.quantidade)) || 1),
          material_cost: n(f.valor_unitario), labor_cost: 0, unit_price: n(f.valor_unitario), room_label: 'Ferragens',
        })),
      ].filter(i => i.name.trim());

      if (itens.length) {
        await supabase.from('budget_items').insert(itens.map(i => ({ ...i, budget_id: budget.id })) as any);
      }

      toast.success('Orçamento criado e enviado para o pipeline "Em Aberto"');
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Falha ao aprovar orçamento');
    } finally {
      setApproving(false);
    }
  };



  /* ---------- exportações ---------- */

  const exportPdf = () => {
    if (!result) return;
    const r = result;
    const rows = (arr: any[], cols: string[]) =>
      (arr || []).map(i => `<tr>${cols.map(c => `<td>${
        typeof i[c] === 'number' && /valor|total|unitario/.test(c) ? formatBRL(i[c]) : (i[c] ?? '—')
      }</td>`).join('')}</tr>`).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Orçamento ${cliente}</title>
    <style>
      *{box-sizing:border-box} body{font-family:Georgia,serif;color:#2b2b2b;margin:0;padding:0}
      .capa{height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:#36454F;color:#fff;page-break-after:always}
      .capa h1{font-size:42px;margin:0;letter-spacing:2px}
      .capa .gold{color:#B8860B;font-size:16px;letter-spacing:6px;text-transform:uppercase;margin-bottom:24px}
      .capa p{margin:4px 0;font-size:16px}
      .page{padding:40px 48px}
      h2{color:#36454F;border-bottom:2px solid #B8860B;padding-bottom:6px;font-size:18px;margin-top:28px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
      th{background:#36454F;color:#fff;text-align:left;padding:6px 8px}
      td{border-bottom:1px solid #e3e3e3;padding:6px 8px}
      .kpis{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px}
      .kpi{border:1px solid #ddd;border-left:4px solid #B8860B;padding:10px 14px;min-width:150px}
      .kpi span{display:block;font-size:10px;text-transform:uppercase;color:#777}
      .kpi b{font-size:16px}
      .obs{font-size:11px;color:#666;margin-top:20px}
      @media print{.no-print{display:none}}
    </style></head><body>
    <div class="capa">
      <div class="gold">${empresa}</div>
      <h1>ORÇAMENTO DE MARCENARIA</h1>
      <p><b>Cliente:</b> ${cliente}</p>
      <p><b>Local:</b> ${cidade}/${estado}</p>
      <p><b>Padrão:</b> ${padrao} · <b>Material:</b> ${material}</p>
      <p><b>Prazo:</b> ${prazoDias} dias</p>
      <p>${new Date().toLocaleDateString('pt-BR')}</p>
    </div>
    <div class="page">
      <h2>Resumo Executivo</h2>
      <div class="kpis">
        <div class="kpi"><span>Material + ferragens</span><b>${formatBRL((costs?.material || 0) + (costs?.ferragens || 0))}</b></div>
        <div class="kpi"><span>Mão de obra + overhead</span><b>${formatBRL((costs?.maoObra || 0) + (costs?.overhead || 0))}</b></div>
        ${isFW ? `<div class="kpi"><span>Estrutura (10%)</span><b>${formatBRL(costs?.estrutura || 0)}</b></div>` : ''}
        <div class="kpi"><span>Comissão vendedor</span><b>${formatBRL(costs?.comissao || 0)}</b></div>
        <div class="kpi"><span>Montagem/instalação</span><b>${formatBRL(costs?.montador || 0)}</b></div>
        <div class="kpi"><span>Impostos</span><b>${formatBRL(costs?.impostos || 0)}</b></div>
        <div class="kpi"><span>Custo total</span><b>${formatBRL(costs?.custoTotal || 0)}</b></div>
        <div class="kpi"><span>Venda</span><b>${formatBRL(vendaOf(r))}</b></div>
        <div class="kpi"><span>Lucro líquido</span><b>${formatBRL(costs?.lucroLiquido || 0)}</b></div>
        <div class="kpi"><span>Margem s/ venda</span><b>${(costs?.margemSobreVenda || 0).toFixed(1)}%</b></div>
      </div>

      <h2>Levantamento Técnico</h2>
      <table><tbody>
        <tr><td>Área total</td><td>${n(r.levantamento_tecnico?.area_total_m2).toFixed(2)} m²</td></tr>
        <tr><td>Chapas</td><td>${n(r.levantamento_tecnico?.chapas)}</td></tr>
        <tr><td>Aproveitamento</td><td>${n(r.levantamento_tecnico?.aproveitamento_pct)}%</td></tr>
        <tr><td>Perda técnica</td><td>${n(r.levantamento_tecnico?.perda_tecnica_pct)}%</td></tr>
        <tr><td>Portas / Gavetas / Prateleiras / Divisórias</td><td>${n(r.levantamento_tecnico?.portas)} / ${n(r.levantamento_tecnico?.gavetas)} / ${n(r.levantamento_tecnico?.prateleiras)} / ${n(r.levantamento_tecnico?.divisorias)}</td></tr>
        <tr><td>Complexidade</td><td>${r.levantamento_tecnico?.complexidade ?? '—'}</td></tr>
      </tbody></table>

      <h2>Materiais</h2>
      <table><thead><tr><th>Descrição</th><th>Qtd</th><th>Un.</th><th>Vlr Unit.</th><th>Total</th></tr></thead>
      <tbody>${rows(r.materiais, ['descricao', 'quantidade', 'unidade', 'valor_unitario', 'valor_total'])}</tbody></table>

      <h2>Ferragens e Acessórios</h2>
      <table><thead><tr><th>Item</th><th>Qtd</th><th>Vlr Unit.</th><th>Total</th></tr></thead>
      <tbody>${rows(r.ferragens, ['item', 'quantidade', 'valor_unitario', 'valor_total'])}</tbody></table>

      <h2>Custo Operacional</h2>
      <table><tbody>
        <tr><td>Funcionários</td><td>${n(r.operacional?.funcionarios) || funcionarios}</td></tr>
        <tr><td>Dias</td><td>${n(r.operacional?.dias) || prazoDias}</td></tr>
        <tr><td>Custo diário</td><td>${formatBRL(n(r.operacional?.custo_diario) || n(custoDiario))}</td></tr>
        <tr><td>7% sobre materiais</td><td>${formatBRL(n(r.operacional?.percentual_materiais))}</td></tr>
        <tr><td><b>Total operacional</b></td><td><b>${formatBRL(n(r.operacional?.total))}</b></td></tr>
      </tbody></table>

      <h2>Simulação de Venda</h2>
      <table><tbody>
        <tr><td>Material × 1</td><td>${formatBRL(n(r.simulacao_venda?.material_1x))}</td></tr>
        <tr><td>Material × 2</td><td>${formatBRL(n(r.simulacao_venda?.material_2x))}</td></tr>
        <tr><td>Material × 3</td><td>${formatBRL(n(r.simulacao_venda?.material_3x))}</td></tr>
        <tr><td>Valor por m²</td><td>${formatBRL(n(r.analise_m2?.valor_por_m2))} (${r.analise_m2?.faixa_referencia ?? '—'})</td></tr>
        <tr><td>Método mais rentável</td><td>${r.analise_m2?.metodo_mais_rentavel ?? '—'}</td></tr>
      </tbody></table>

      ${isFW && (r.divisao_socios || []).length ? `<h2>Divisão dos Sócios</h2>
      <table><thead><tr><th>Sócio</th><th>Participação</th><th>Valor</th></tr></thead>
      <tbody>${(r.divisao_socios || []).map((s: any) => `<tr><td>${s.nome}</td><td>${n(s.participacao_pct)}%</td><td>${formatBRL(n(s.valor))}</td></tr>`).join('')}</tbody></table>` : ''}

      <h2>Recomendação Comercial</h2>
      <table><tbody>
        <tr><td>Preço mínimo</td><td>${formatBRL(n(r.recomendacao_comercial?.preco_minimo))}</td></tr>
        <tr><td>Preço ideal</td><td>${formatBRL(n(r.recomendacao_comercial?.preco_ideal))}</td></tr>
        <tr><td>Preço premium</td><td>${formatBRL(n(r.recomendacao_comercial?.preco_premium))}</td></tr>
        <tr><td><b>Recomendado p/ fechamento</b></td><td><b>${formatBRL(n(r.recomendacao_comercial?.preco_recomendado))}</b></td></tr>
      </tbody></table>
      <p class="obs">${r.recomendacao_comercial?.justificativa ?? ''}</p>
      <p class="obs">${(r.observacoes_tecnicas || []).join(' · ')}</p>
      <p class="obs">Valores estimados com base em preços médios de mercado.</p>
    </div>
    <script>window.onload=()=>window.print()</script>
    </body></html>`;

    const w = window.open('', '_blank');
    if (!w) { toast.error('Permita pop-ups para gerar o PDF'); return; }
    w.document.write(html);
    w.document.close();
  };

  const exportXlsx = () => {
    if (!result || !costs) return;
    const r = result;
    const wb = XLSX.utils.book_new();

    const BRL = 'R$ #,##0.00';
    const PCT = '0.0%';
    const NUM = '#,##0.00';

    /** Cria a aba aplicando larguras, formatos por coluna e formatos por célula. */
    const sheet = (
      name: string,
      aoa: any[][],
      opts: { widths: number[]; formats?: Record<string, string>; cells?: Record<string, string>; merges?: string[] },
    ) => {
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = opts.widths.map((w) => ({ wch: w }));
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      Object.entries(opts.formats || {}).forEach(([col, fmt]) => {
        const c = XLSX.utils.decode_col(col);
        for (let row = range.s.r; row <= range.e.r; row++) {
          const cell = ws[XLSX.utils.encode_cell({ r: row, c })];
          if (cell && (cell.t === 'n' || cell.f)) cell.z = fmt;
        }
      });
      Object.entries(opts.cells || {}).forEach(([ref, fmt]) => { if (ws[ref]) ws[ref].z = fmt; });
      if (opts.merges) ws['!merges'] = opts.merges.map((m) => XLSX.utils.decode_range(m));
      XLSX.utils.book_append_sheet(wb, ws, name);
      return ws;
    };

    const lt = r.levantamento_tecnico || {};
    const ambientes = (r.ambientes || []) as any[];
    const area = n(lt.area_total_m2);

    /* ---------- 1. MATERIAIS ---------- */
    const mats = (r.materiais || []) as any[];
    const matsAoa: any[][] = [
      ['MATERIAIS — CHAPAS E INSUMOS'],
      ['Descrição', 'Qtd', 'Unid.', 'Valor Unit. (R$)', 'Valor Total (R$)'],
      ...mats.map((m, i) => [m.descricao, n(m.quantidade), m.unidade || 'un', n(m.valor_unitario), { f: `B${i + 3}*D${i + 3}`, t: 'n' }]),
      [],
      ['SUBTOTAL MATERIAIS', '', '', '', { f: `SUM(E3:E${mats.length + 2})`, t: 'n' }],
    ];
    const matTotalRow = mats.length + 4;
    sheet('MATERIAIS', matsAoa, { widths: [56, 8, 10, 18, 18], formats: { D: BRL, E: BRL, B: NUM }, merges: ['A1:E1'] });

    /* ---------- 2. FERRAGENS ---------- */
    const ferr = (r.ferragens || []) as any[];
    const ferrAoa: any[][] = [
      ['FERRAGENS E ACESSÓRIOS'],
      ['Item', 'Qtd', 'Valor Unit. (R$)', 'Valor Total (R$)'],
      ...ferr.map((f, i) => [f.item, n(f.quantidade), n(f.valor_unitario), { f: `B${i + 3}*C${i + 3}`, t: 'n' }]),
      [],
      ['SUBTOTAL FERRAGENS', '', '', { f: `SUM(D3:D${ferr.length + 2})`, t: 'n' }],
    ];
    const ferrTotalRow = ferr.length + 4;
    sheet('FERRAGENS', ferrAoa, { widths: [56, 8, 18, 18], formats: { C: BRL, D: BRL, B: NUM }, merges: ['A1:D1'] });

    const MAT = `MATERIAIS!E${matTotalRow}`;
    const FER = `FERRAGENS!D${ferrTotalRow}`;

    /* ---------- 3. CUSTOS (motor de cálculo, tudo editável) ---------- */
    // Parâmetros: B3 margem, B4 comissão, B5 montador, B6 impostos, B7 estrutura, B8 overhead,
    // B9 custo diário, B10 dias, B11 frete. Custos: B14..B20. Variáveis: B23..B26. B28 total, B30 venda.
    const VARS = '(CUSTOS!$B$4+CUSTOS!$B$5+CUSTOS!$B$6)';
    const pctOf = (row: number) => ({ f: `IF($B$28=0,0,B${row}/$B$28)`, t: 'n' } as any);
    const bar = (row: number) => ({ f: `REPT("|",ROUND(C${row}*60,0))` } as any);

    sheet('CUSTOS', [
      ['COMPOSIÇÃO DE CUSTOS — MOTOR DE CÁLCULO'],
      ['PARÂMETROS EDITÁVEIS (altere e a planilha recalcula tudo)'],
      ['Margem de lucro desejada', n(margemDesejada) / 100],
      ['Comissão do vendedor', n(comissao) / 100],
      ['Comissão do montador / instalação', n(montador) / 100],
      ['Impostos sobre a venda', n(impostos) / 100],
      ['Estrutura de marcenaria (s/ material)', isFW ? 0.1 : 0],
      ['Overhead operacional (s/ material)', 0.07],
      ['Custo diário da equipe (R$)', n(custoDiario)],
      ['Dias de produção', n(prazoDias)],
      ['Frete / instalação (R$)', n(frete)],
      [],
      ['CUSTOS DIRETOS', 'Valor (R$)', '% do custo', 'Peso'],
      ['Material (chapas e insumos)', { f: MAT, t: 'n' }, pctOf(14), bar(14)],
      ['Ferragens e acessórios', { f: FER, t: 'n' }, pctOf(15), bar(15)],
      ['Estrutura de marcenaria', { f: '(B14+B15)*B7', t: 'n' }, pctOf(16), bar(16)],
      ['Mão de obra (dias × custo diário)', { f: 'B9*B10', t: 'n' }, pctOf(17), bar(17)],
      ['Overhead operacional', { f: '(B14+B15)*B8', t: 'n' }, pctOf(18), bar(18)],
      ['Frete / instalação', { f: 'B11', t: 'n' }, pctOf(19), bar(19)],
      ['SUBTOTAL CUSTO DIRETO', { f: 'SUM(B14:B19)', t: 'n' }, pctOf(20)],
      [],
      ['CUSTOS VARIÁVEIS (incidem sobre a venda)', 'Valor (R$)', '% do custo', 'Peso'],
      ['Comissão do vendedor', { f: 'B30*B4', t: 'n' }, pctOf(23), bar(23)],
      ['Comissão do montador / instalação', { f: 'B30*B5', t: 'n' }, pctOf(24), bar(24)],
      ['Impostos', { f: 'B30*B6', t: 'n' }, pctOf(25), bar(25)],
      ['SUBTOTAL VARIÁVEIS', { f: 'SUM(B23:B25)', t: 'n' }, pctOf(26)],
      [],
      ['CUSTO TOTAL DO PROJETO', { f: 'B20+B26', t: 'n' }],
      [],
      ['PREÇO DE VENDA', { f: `B20*(1+B3)/(1-${VARS})`, t: 'n' }],
      ['LUCRO LÍQUIDO', { f: 'B30-B28', t: 'n' }],
      ['Margem sobre a venda', { f: 'IF(B30=0,0,B31/B30)', t: 'n' }],
      ['Margem sobre o custo', { f: 'IF(B28=0,0,B31/B28)', t: 'n' }],
      [],
      ['Conferência', { f: 'IF(ROUND(B30-B28-B31,2)=0,"OK — números fechados","⚠ revisar")' }],
    ], {
      widths: [42, 20, 14, 26],
      formats: { B: BRL, C: PCT },
      cells: { B3: PCT, B4: PCT, B5: PCT, B6: PCT, B7: PCT, B8: PCT, B10: NUM, B32: PCT, B33: PCT },
      merges: ['A1:D1', 'A2:D2'],
    });

    /* ---------- 4. PREÇOS ---------- */
    const priceRow = (label: string, margem: string, row: number) => [
      label,
      { f: `CUSTOS!$B$20*(1+${margem})/(1-${VARS})`, t: 'n' },
      { f: `B${row}-CUSTOS!$B$20-B${row}*${VARS}`, t: 'n' },
      { f: `IF(B${row}=0,0,C${row}/B${row})`, t: 'n' },
      { f: `IF(${area}=0,"—",B${row}/${area})`, t: 'n' },
    ];
    sheet('PRECOS', [
      ['FAIXAS DE PREÇO — ESCOLHA COMERCIAL'],
      ['Faixa', 'Preço (R$)', 'Lucro líquido (R$)', 'Margem s/ venda', 'R$ / m²'],
      priceRow('Mínimo aceitável (15%)', '0.15', 3),
      priceRow('Ideal (margem desejada)', 'CUSTOS!$B$3', 4),
      priceRow('Premium (margem + 20 p.p.)', 'CUSTOS!$B$3+0.2', 5),
      [],
      ['COMPARATIVO POR MULTIPLICADOR DE MATERIAL'],
      ['Material × 1,0', { f: `${MAT}+${FER}`, t: 'n' }],
      ['Material × 2,0', { f: `2*(${MAT}+${FER})`, t: 'n' }],
      ['Material × 3,0', { f: `3*(${MAT}+${FER})`, t: 'n' }],
      [],
      ['Área total do projeto (m²)', area],
      ['Faixa de mercado', r.analise_m2?.faixa_referencia || '—'],
      ['Método mais rentável', r.analise_m2?.metodo_mais_rentavel || '—'],
      [],
      ['Justificativa da IA', r.recomendacao_comercial?.justificativa || '—'],
      ['Alerta', { f: 'IF(B3<CUSTOS!$B$28,"⚠ preço mínimo abaixo do custo total","Todas as faixas cobrem o custo total")' }],
    ], {
      widths: [40, 20, 22, 18, 16],
      formats: { B: BRL, C: BRL, D: PCT, E: BRL },
      cells: { B13: NUM },
      merges: ['A1:E1', 'A7:E7'],
    });

    /* ---------- 5. RESUMO (capa executiva) ---------- */
    sheet('RESUMO', [
      [`ORÇAMENTO — ${empresa.toUpperCase()}`],
      [],
      ['Cliente', cliente],
      ['Projeto', ambientes.map((a) => a.nome).filter(Boolean).join(' + ') || '—'],
      ['Cidade / UF', `${cidade} / ${estado}`],
      ['Data', new Date().toLocaleDateString('pt-BR')],
      ['Padrão / Material', `${padrao} · ${material}`],
      ['Prazo de produção (dias)', n(prazoDias)],
      ['Funcionários no projeto', n(funcionarios)],
      [],
      ['INDICADORES', 'Valor'],
      ['Custo direto', { f: 'CUSTOS!B20', t: 'n' }],
      ['Custos variáveis (comissões + impostos)', { f: 'CUSTOS!B26', t: 'n' }],
      ['Custo total', { f: 'CUSTOS!B28', t: 'n' }],
      ['Preço de venda', { f: 'CUSTOS!B30', t: 'n' }],
      ['Lucro líquido', { f: 'CUSTOS!B31', t: 'n' }],
      ['Margem sobre a venda', { f: 'CUSTOS!B32', t: 'n' }],
      [],
      ['LEVANTAMENTO TÉCNICO', 'Valor'],
      ['Área total (m²)', area],
      ['Chapas estimadas', n(lt.chapas)],
      ['Perda técnica', n(lt.perda_tecnica_pct) / 100],
      ['Portas / Gavetas / Prateleiras', `${n(lt.portas)} / ${n(lt.gavetas)} / ${n(lt.prateleiras)}`],
      ['Complexidade', lt.complexidade || '—'],
      [],
      ['AMBIENTES', 'Medidas', 'Área (m²)', 'Descrição'],
      ...ambientes.map((a) => [a.nome, a.medidas, n(a.area_m2), a.descricao]),
      [],
      ['Observações', lt.observacoes || 'Valores estimados com base em preços médios de mercado.'],
    ], {
      widths: [42, 30, 14, 60],
      formats: {},
      cells: {
        B12: BRL, B13: BRL, B14: BRL, B15: BRL, B16: BRL, B17: PCT,
        B20: NUM, B22: PCT,
      },
      merges: ['A1:D1'],
    });

    /* ---------- 6. SÓCIOS ---------- */
    if (isFW) {
      const ss = (r.divisao_socios || []).length
        ? r.divisao_socios
        : socios.map((s) => ({ nome: s.nome, participacao_pct: s.percentual }));
      sheet('SOCIOS', [
        ['DIVISÃO DE SÓCIOS — SOBRE O LUCRO LÍQUIDO'],
        ['Sócio', 'Participação', 'Valor (R$)'],
        ...ss.map((s: any, i: number) => [s.nome || `Sócio ${i + 1}`, n(s.participacao_pct) / 100, { f: `CUSTOS!$B$31*B${i + 3}`, t: 'n' }]),
        [],
        ['TOTAL DISTRIBUÍDO', { f: `SUM(B3:B${ss.length + 2})`, t: 'n' }, { f: `SUM(C3:C${ss.length + 2})`, t: 'n' }],
      ], { widths: [32, 16, 20], formats: { B: PCT, C: BRL }, merges: ['A1:C1'] });
    }

    XLSX.writeFile(wb, `Orcamento_${(cliente || 'projeto').replace(/\s+/g, '_')}_${empresa.replace(/\s+/g, '')}.xlsx`);
    toast.success('Planilha gerada com todos os custos e fórmulas editáveis');
  };


  /* ---------- UI ---------- */

  const field = (label: string, node: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {node}
    </div>
  );

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2 border-primary/40 text-primary">
        <Brain className="h-4 w-4" /> Orçamentista IA
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Orçamentista Pro Marcenaria AI
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            {field('Empresa', (
              <Select value={empresa} onValueChange={setEmpresa}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EMPRESAS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            ))}
            {field('Cliente', <Input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nome do cliente" />)}
            {field('Margem de lucro desejada (%)', <Input inputMode="decimal" value={margemDesejada} onChange={e => setMargemDesejada(e.target.value)} placeholder="30" />)}
            {field('Prazo de produção (dias)', <Input inputMode="numeric" value={prazoDias} onChange={e => setPrazoDias(e.target.value)} placeholder="30" />)}
            {field('Custo operacional diário da equipe (R$)', <Input inputMode="decimal" value={custoDiario} onChange={e => setCustoDiario(e.target.value)} placeholder="450" />)}
            {field('Funcionários no projeto', <Input inputMode="numeric" value={funcionarios} onChange={e => setFuncionarios(e.target.value)} placeholder="3" />)}
            {field('Cidade', <Input value={cidade} onChange={e => setCidade(e.target.value)} placeholder="São Paulo" />)}
            {field('Estado', <Input value={estado} onChange={e => setEstado(e.target.value)} placeholder="SP" maxLength={2} />)}
            {field('Padrão do projeto', (
              <Select value={padrao} onValueChange={setPadrao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PADROES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            ))}
            {field('Material', (
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MATERIAIS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            ))}
            {field('Comissão do vendedor (%)', <Input inputMode="decimal" value={comissao} onChange={e => setComissao(e.target.value)} placeholder="5" />)}
            {field('Comissão do montador / instalador (%)', <Input inputMode="decimal" value={montador} onChange={e => setMontador(e.target.value)} placeholder="8" />)}
            {field('Impostos sobre a venda (%)', <Input inputMode="decimal" value={impostos} onChange={e => setImpostos(e.target.value)} placeholder="6" />)}
            {field('Frete / instalação (R$)', <Input inputMode="decimal" value={frete} onChange={e => setFrete(e.target.value)} placeholder="800" />)}
            {field('Perda técnica de chapas (%)', <Input inputMode="decimal" value={perda} onChange={e => setPerda(e.target.value)} placeholder="15" />)}
          </div>

          {/* Especificações técnicas — chips clicáveis */}
          <div className="rounded-lg border p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Especificações técnicas (clique para definir — quanto mais preencher, mais preciso o cálculo)
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {SPEC_GROUPS.map(g => (
                <div key={g.key} className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">{g.label}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {g.options.map(o => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setSpec(g.key, o)}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          specs[g.key] === o
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>


          {isFW && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Divisão societária — FW Planejados</p>
                <span className={`text-xs ${somaSocios === 100 ? 'text-success' : 'text-destructive'}`}>Total {somaSocios}%</span>
              </div>
              {socios.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input className="flex-1" placeholder={`Sócio ${i + 1}`} value={s.nome}
                    onChange={e => setSocios(p => p.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} />
                  <Input className="w-24" inputMode="decimal" placeholder="%" value={s.percentual}
                    onChange={e => setSocios(p => p.map((x, j) => j === i ? { ...x, percentual: Number(e.target.value) || 0 } : x))} />
                  <Button variant="ghost" size="icon" onClick={() => setSocios(p => p.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setSocios(p => [...p, { nome: '', percentual: 0 }])} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Adicionar sócio
              </Button>
            </div>
          )}

          {field('Medidas, cores e observações (opcional se anexar projeto)', (
            <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Cozinha 3,20 x 2,60m, MDF Branco TX 18mm, portas em laca fosca, 6 gavetas com corrediça telescópica..." />
          ))}

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Projeto (PDF, planta, render ou foto com medidas)</Label>
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              className="cursor-pointer rounded-lg border-2 border-dashed border-border/60 p-6 text-center hover:border-primary/50 transition-colors"
            >
              <Upload className="h-5 w-5 mx-auto text-muted-foreground" />
              <p className="text-xs text-muted-foreground mt-2">Clique ou arraste até 6 arquivos (PDF / JPG / PNG · máx. 15MB cada)</p>
            </div>
            <input ref={inputRef} type="file" multiple accept="application/pdf,image/*" className="hidden"
              onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs">
                    <FileText className="h-3 w-3" /> {f.name}
                    <button onClick={() => setFiles(p => p.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <Button variant="outline" onClick={askQuestions} disabled={asking || loading} className="w-full gap-2 border-primary/40 text-primary">
            {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {asking ? 'A IA está analisando o projeto...' : 'Perguntar à IA o que falta definir'}
          </Button>

          {questions.length > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Perguntas da IA — escolha as opções</p>
                <span className="text-[11px] text-muted-foreground">
                  {Object.values(answersQ).filter(Boolean).length}/{questions.length} respondidas
                </span>
              </div>
              {questions.map(q => (
                <div key={q.id} className="space-y-1.5">
                  <p className="text-xs font-medium">{q.pergunta}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {q.opcoes.map(o => (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setAnswersQ(p => ({ ...p, [q.id]: p[q.id] === o ? '' : o }))}
                        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                          answersQ[q.id] === o
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background hover:border-primary/50'
                        }`}
                      >
                        {o}{q.sugerido === o ? ' ★' : ''}
                      </button>
                    ))}
                  </div>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Outra resposta (opcional)"
                    value={q.opcoes.includes(answersQ[q.id]) ? '' : (answersQ[q.id] || '')}
                    onChange={e => setAnswersQ(p => ({ ...p, [q.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}

          <Button onClick={analyze} disabled={loading} className="w-full gradient-primary shadow-primary border-0 gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {loading ? 'Analisando projeto...' : 'Analisar e gerar orçamento'}
          </Button>

          {missing.length > 0 && <p className="text-[11px] text-muted-foreground">Faltam: {missing.join(', ')}.</p>}

          {result && (
            <div className="space-y-4 pt-2 border-t">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ['Custo total', costs?.custoTotal || 0],
                  ['Preço de venda', costs?.venda || 0],
                  ['Lucro líquido', costs?.lucroLiquido || 0],
                  ['Margem s/ venda', costs?.margemSobreVenda || 0, true],
                ].map(([label, v, isPct]) => (
                  <Card key={String(label)}><CardContent className="p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{String(label)}</p>
                    <p className="font-display text-lg font-bold">
                      {isPct ? `${Number(v).toFixed(1)}%` : formatBRL(Number(v))}
                    </p>
                  </CardContent></Card>
                ))}
              </div>

              {costs && (
                <div className="grid gap-3 lg:grid-cols-2">
                  {/* Composição do custo */}
                  <Card><CardContent className="p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Composição do custo</p>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          layout="vertical"
                          data={[
                            { nome: 'Material', valor: costs.material },
                            { nome: 'Ferragens', valor: costs.ferragens },
                            ...(isFW ? [{ nome: 'Estrutura 10%', valor: costs.estrutura }] : []),
                            { nome: 'Mão de obra', valor: costs.maoObra },
                            { nome: 'Overhead 7%', valor: costs.overhead },
                            { nome: 'Frete/instal.', valor: costs.frete },
                            { nome: 'Comissão vend.', valor: costs.comissao },
                            { nome: 'Montador', valor: costs.montador },
                            { nome: 'Impostos', valor: costs.impostos },
                          ].filter(d => d.valor > 0)}
                          margin={{ left: 8, right: 16 }}
                        >
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="nome" width={92} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                          <Bar dataKey="valor" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent></Card>

                  {/* Onde está o dinheiro */}
                  <Card><CardContent className="p-3 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Onde está o dinheiro da venda</p>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { nome: 'Custo direto', valor: costs.custoDireto },
                              { nome: 'Comissões + impostos', valor: costs.variaveis },
                              { nome: 'Lucro líquido', valor: Math.max(0, costs.lucroLiquido) },
                            ].filter(d => d.valor > 0)}
                            dataKey="valor" nameKey="nome" innerRadius={45} outerRadius={80} paddingAngle={2}
                          >
                            {['hsl(var(--muted-foreground))', 'hsl(var(--destructive))', 'hsl(var(--primary))']
                              .map((c, i) => <Cell key={i} fill={c} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                      <div><p className="text-muted-foreground">Custo direto</p><p className="font-semibold">{formatBRL(costs.custoDireto)}</p></div>
                      <div><p className="text-muted-foreground">Comissões + impostos</p><p className="font-semibold">{formatBRL(costs.variaveis)}</p></div>
                      <div><p className="text-muted-foreground">Lucro</p><p className="font-semibold">{formatBRL(costs.lucroLiquido)}</p></div>
                    </div>
                  </CardContent></Card>
                </div>
              )}

              {costs && (
                <Card><CardContent className="p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Detalhamento de custos</p>
                  <div className="divide-y text-xs">
                    {[
                      ['Material (chapas e insumos)', costs.material],
                      ['Ferragens e acessórios', costs.ferragens],
                      ...(isFW ? [['Estrutura de marcenaria (10%)', costs.estrutura] as [string, number]] : []),
                      ['Mão de obra (dias × custo diário)', costs.maoObra],
                      ['Overhead operacional (7%)', costs.overhead],
                      ['Frete / instalação', costs.frete],
                      [`Comissão do vendedor (${n(comissao)}%)`, costs.comissao],
                      [`Comissão do montador (${n(montador)}%)`, costs.montador],
                      [`Impostos (${n(impostos)}%)`, costs.impostos],
                      ['CUSTO TOTAL', costs.custoTotal],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="flex items-center justify-between py-1.5">
                        <span className={String(label).startsWith('CUSTO') ? 'font-semibold' : 'text-muted-foreground'}>{String(label)}</span>
                        <span className={String(label).startsWith('CUSTO') ? 'font-semibold' : ''}>{formatBRL(Number(value))}</span>
                      </div>
                    ))}
                  </div>
                </CardContent></Card>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Sugestões de preço</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {([
                    ['Mínimo', tiers.minimo, 'border-warning/40'],
                    ['Ideal', tiers.ideal, 'border-primary/60 ring-2 ring-primary/20'],
                    ['Premium', tiers.premium, 'border-success/40'],
                  ] as [string, number, string][]).map(([label, value, tone]) => {
                    const custoDir = costs?.custoDireto || 0;
                    const lucro = value - custoDir - value * (varPct / 100);
                    const margem = value > 0 ? (lucro / value) * 100 : 0;
                    const active = (selectedPrice || tiers.ideal) === value && value > 0;
                    return (
                      <Card key={label} className={`border-2 ${tone} ${active ? 'bg-primary/5' : ''}`}>
                        <CardContent className="p-3 space-y-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                          <p className="font-display text-xl font-bold">{formatBRL(value)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Lucro {formatBRL(lucro)} · Margem {margem.toFixed(1)}%
                          </p>
                          <Button size="sm" variant={active ? 'default' : 'outline'} className="w-full"
                            onClick={() => setSelectedPrice(value)}>
                            {active ? 'Selecionado' : 'Selecionar'}
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                {result.recomendacao_comercial?.justificativa && (
                  <p className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    {result.recomendacao_comercial.justificativa}
                  </p>
                )}
                <Button onClick={approveBudget} disabled={approving} className="w-full gap-2 gradient-primary shadow-primary border-0">
                  {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Aprovar orçamento ({formatBRL(selectedPrice || vendaOf(result))}) e enviar para Em Aberto
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={exportPdf} className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> PDF profissional
                </Button>
                <Button variant="outline" size="sm" onClick={exportXlsx} className="gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Planilha Excel editável
                </Button>
              </div>

              <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg border bg-muted/20 p-4 text-sm">
                <ReactMarkdown>{result.relatorio_markdown || 'Relatório indisponível.'}</ReactMarkdown>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
