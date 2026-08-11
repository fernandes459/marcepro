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

interface Socio { nome: string; percentual: number }
interface FileIn { name: string; mime: string; data: string; size: number }

const EMPRESAS = ['FW Planejados', 'PlanejadoSousa'];
const PADROES = ['Econômico', 'Médio padrão', 'Alto padrão', 'Luxo'];
const MATERIAIS = ['MDF', 'MDP', 'Compensado', 'Madeira Maciça', 'Outro'];

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
  const [approving, setApproving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
  const [socios, setSocios] = useState<Socio[]>([{ nome: '', percentual: 50 }, { nome: '', percentual: 50 }]);
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<FileIn[]>([]);

  const isFW = empresa === 'FW Planejados';
  const somaSocios = useMemo(() => socios.reduce((s, x) => s + n(x.percentual), 0), [socios]);

  /** Valor de venda derivado da margem desejada (fallback quando a IA não retorna). */
  const vendaOf = (r: any) =>
    n(r?.resultado_financeiro?.valor_venda) ||
    n(r?.recomendacao_comercial?.preco_recomendado) ||
    n(r?.custos?.total) * (1 + n(margemDesejada) / 100);

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

  const analyze = async () => {
    if (missing.length) { toast.error(`Informe: ${missing.join(', ')}`); return; }
    if (!files.length && !notes.trim()) { toast.error('Anexe o projeto (PDF/imagem) ou descreva as medidas.'); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-orcamentista-pro', {
        body: {
          answers: {
            empresa, cliente,
            margemDesejada: n(margemDesejada), prazoDias: n(prazoDias),
            custoDiarioEquipe: n(custoDiario), funcionarios: n(funcionarios),
            cidade, estado, padrao, material,
            socios: isFW ? socios.filter(s => s.nome.trim()) : [],
          },
          notes,
          files: files.map(f => ({ name: f.name, mime: f.mime, data: f.data })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      toast.success('Orçamento analisado pela IA');
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Falha ao analisar o projeto');
    } finally {
      setLoading(false);
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
        <div class="kpi"><span>Material</span><b>${formatBRL(n(r.custos?.material))}</b></div>
        <div class="kpi"><span>Operacional</span><b>${formatBRL(n(r.custos?.operacional))}</b></div>
        ${isFW ? `<div class="kpi"><span>Estrutura (10%)</span><b>${formatBRL(n(r.custos?.estrutura_marcenaria))}</b></div>` : ''}
        <div class="kpi"><span>Custo total</span><b>${formatBRL(n(r.custos?.total))}</b></div>
        <div class="kpi"><span>Venda</span><b>${formatBRL(vendaOf(r))}</b></div>
        <div class="kpi"><span>Lucro líquido</span><b>${formatBRL(n(r.resultado_financeiro?.lucro_liquido))}</b></div>
        <div class="kpi"><span>Margem</span><b>${n(r.resultado_financeiro?.margem_pct).toFixed(1)}%</b></div>
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
    if (!result) return;
    const r = result;
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['RESUMO'], ['Empresa', empresa], ['Cliente', cliente], ['Projeto', r.resumo_executivo?.empresa ? cliente : cliente],
      ['Cidade', `${cidade}/${estado}`], ['Data', new Date().toLocaleDateString('pt-BR')],
      ['Prazo (dias)', n(prazoDias)], ['Padrão', padrao], ['Material', material],
      ['Área total (m²)', n(r.levantamento_tecnico?.area_total_m2)], ['Chapas', n(r.levantamento_tecnico?.chapas)],
    ]), 'RESUMO');

    const mats = (r.materiais || []) as any[];
    const matsAoa: any[][] = [['Descrição', 'Quantidade', 'Unidade', 'Valor Unitário', 'Valor Total']];
    mats.forEach((m, i) => matsAoa.push([m.descricao, n(m.quantidade), m.unidade, n(m.valor_unitario), { f: `B${i + 2}*D${i + 2}` }]));
    matsAoa.push(['TOTAL', '', '', '', { f: `SUM(E2:E${mats.length + 1})` }]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matsAoa), 'MATERIAIS');

    const ferr = (r.ferragens || []) as any[];
    const ferrAoa: any[][] = [['Item', 'Quantidade', 'Valor Unitário', 'Valor Total']];
    ferr.forEach((f, i) => ferrAoa.push([f.item, n(f.quantidade), n(f.valor_unitario), { f: `B${i + 2}*C${i + 2}` }]));
    ferrAoa.push(['TOTAL', '', '', { f: `SUM(D2:D${ferr.length + 1})` }]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ferrAoa), 'FERRAGENS');

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Funcionários', 'Dias', 'Custo Diário', 'Total Equipe', '% s/ Materiais (7%)', 'Total Operacional'],
      [n(funcionarios), n(prazoDias), n(custoDiario), { f: 'B2*C2' }, { f: "MATERIAIS!E" + (mats.length + 2) + "*0.07" }, { f: 'D2+E2' }],
    ]), 'OPERACIONAL');

    const totalMatRef = `MATERIAIS!E${mats.length + 2}`;
    const totalFerrRef = `FERRAGENS!D${ferr.length + 2}`;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['FINANCEIRO'],
      ['Material', { f: `${totalMatRef}+${totalFerrRef}` }],
      ['Estrutura Marcenaria (10%)', isFW ? { f: 'B2*0.1' } : 0],
      ['Operacional', { f: 'OPERACIONAL!F2' }],
      ['Custo Total', { f: 'B2+B3+B4' }],
      ['Valor de Venda', vendaOf(r)],
      ['Lucro Bruto', { f: 'B6-B5' }],
      ['Impostos', n(r.resultado_financeiro?.impostos)],
      ['Lucro Líquido', { f: 'B7-B8' }],
      ['Margem %', { f: 'IF(B6=0,0,B9/B6)' }],
    ]), 'FINANCEIRO');

    if (isFW) {
      const ss = (r.divisao_socios || []).length ? r.divisao_socios : socios.map(s => ({ nome: s.nome, participacao_pct: s.percentual }));
      const aoa: any[][] = [['Nome do Sócio', 'Participação %', 'Valor Recebido']];
      ss.forEach((s: any, i: number) => aoa.push([s.nome, n(s.participacao_pct) / 100, { f: `FINANCEIRO!$B$9*B${i + 2}` }]));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'SOCIOS');
    }

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['FORMAÇÃO DE PREÇO'],
      ['Material × 1', { f: 'FINANCEIRO!B2' }],
      ['Material × 2', { f: 'FINANCEIRO!B2*2' }],
      ['Material × 3', { f: 'FINANCEIRO!B2*3' }],
      ['Área (m²)', n(r.levantamento_tecnico?.area_total_m2)],
      ['Valor por m²', { f: 'IF(B5=0,0,FINANCEIRO!B6/B5)' }],
      ['Preço mínimo', n(r.recomendacao_comercial?.preco_minimo)],
      ['Preço ideal', n(r.recomendacao_comercial?.preco_ideal)],
      ['Preço premium', n(r.recomendacao_comercial?.preco_premium)],
      ['Preço recomendado', n(r.recomendacao_comercial?.preco_recomendado)],
    ]), 'FORMACAO_PRECO');

    XLSX.writeFile(wb, `orcamento-${cliente.replace(/\s+/g, '-').toLowerCase() || 'projeto'}.xlsx`);
    toast.success('Planilha gerada com fórmulas editáveis');
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

          <Button onClick={analyze} disabled={loading} className="w-full gradient-primary shadow-primary border-0 gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {loading ? 'Analisando projeto...' : 'Analisar e gerar orçamento'}
          </Button>
          {missing.length > 0 && <p className="text-[11px] text-muted-foreground">Faltam: {missing.join(', ')}.</p>}

          {result && (
            <div className="space-y-4 pt-2 border-t">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ['Custo total', n(result.custos?.total)],
                  ['Venda', vendaOf(result)],
                  ['Lucro líquido', n(result.resultado_financeiro?.lucro_liquido)],
                  ['Recomendado', n(result.recomendacao_comercial?.preco_recomendado)],
                ].map(([label, v]) => (
                  <Card key={String(label)}><CardContent className="p-3">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="font-display text-lg font-bold">{formatBRL(Number(v))}</p>
                  </CardContent></Card>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Sugestões de preço</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {([
                    ['Mínimo', n(result.recomendacao_comercial?.preco_minimo), 'border-warning/40'],
                    ['Ideal', n(result.recomendacao_comercial?.preco_ideal) || vendaOf(result), 'border-primary/60 ring-2 ring-primary/20'],
                    ['Premium', n(result.recomendacao_comercial?.preco_premium), 'border-success/40'],
                  ] as [string, number, string][]).map(([label, value, tone]) => {
                    const custo = n(result.custos?.total);
                    const margem = custo > 0 ? ((value - custo) / custo) * 100 : 0;
                    const active = selectedPrice === value && value > 0;
                    return (
                      <Card key={label} className={`border-2 ${tone} ${active ? 'bg-primary/5' : ''}`}>
                        <CardContent className="p-3 space-y-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
                          <p className="font-display text-xl font-bold">{formatBRL(value)}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Lucro {formatBRL(value - custo)} · Margem {margem.toFixed(1)}%
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
