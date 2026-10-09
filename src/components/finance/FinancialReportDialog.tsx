import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, FileText, Loader2, Presentation, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatBRL } from '@/lib/format';
import { buildReport, type ReportTx } from '@/engines/ReportEngine';
import AIPresentation, { type PresentationText } from './AIPresentation';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transactions: ReportTx[];
  categoryLabel: (c: string) => string;
  clientName: (id: string) => string;
  companyName: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export default function FinancialReportDialog({ open, onOpenChange, transactions, categoryLabel, clientName, companyName }: Props) {
  const now = new Date();
  const [kind, setKind] = useState<'month' | 'year'>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [aiLoading, setAiLoading] = useState(false);
  const [presentation, setPresentation] = useState<PresentationText | null>(null);

  const years = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    transactions.forEach((t) => t.date && set.add(Number(t.date.slice(0, 4))));
    return Array.from(set).filter(Boolean).sort((a, b) => b - a);
  }, [transactions]); // eslint-disable-line react-hooks/exhaustive-deps

  const report = useMemo(
    () => buildReport({ transactions, kind, year, month, categoryLabel, clientName }),
    [transactions, kind, year, month, categoryLabel, clientName],
  );
  const s = report.summary;
  const fileBase = `relatorio-${kind === 'year' ? year : `${year}-${String(month).padStart(2, '0')}`}`;

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const resumo = [
      [`${companyName} — Relatório financeiro`], [report.label], [],
      ['Indicador', 'Valor'],
      ['Entradas recebidas', s.income], ['Saídas pagas', s.expense], ['Resultado', s.profit],
      ['Margem (%)', Number(s.margin.toFixed(2))], ['A receber', s.receivable], ['A pagar', s.payable],
      ['Vencidos (qtd)', s.overdueCount], ['Vencidos (valor)', s.overdueAmount],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'RESUMO');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Mês', 'Entradas', 'Saídas', 'Resultado'],
      ...report.months.map((m) => [m.label, m.income, m.expense, m.result]),
    ]), 'MES A MES');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Categoria de despesa', 'Valor'], ...report.expenseCategories.map((c) => [c.name, c.value]),
      [], ['Categoria de receita', 'Valor'], ...report.incomeCategories.map((c) => [c.name, c.value]),
    ]), 'CATEGORIAS');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Cliente', 'Recebido'], ...report.topClients.map((c) => [c.name, c.value]),
    ]), 'CLIENTES');
    const inPeriod = transactions.filter((t) => t.date && t.date >= report.start && t.date <= report.end && t.status !== 'cancelled');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Data', 'Tipo', 'Categoria', 'Descrição', 'Cliente', 'Status', 'Valor'],
      ...inPeriod.map((t: any) => [t.date, t.type === 'income' ? 'Entrada' : 'Saída', categoryLabel(t.category || ''), t.description || '', t.client_id ? clientName(t.client_id) : '', t.status, Number(t.amount)]),
    ]), 'LANCAMENTOS');
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
  };

  const exportPdf = () => {
    const row = (a: string, b: string, cls = '') => `<tr><td>${esc(a)}</td><td class="r ${cls}">${esc(b)}</td></tr>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${fileBase}</title>
<style>
@page{size:A4;margin:16mm}body{font-family:Georgia,'Times New Roman',serif;color:#222;margin:0}
h1{font-size:26px;margin:0;color:#36454F}h2{font-size:15px;color:#B8860B;text-transform:uppercase;letter-spacing:.12em;margin:26px 0 8px;border-bottom:1px solid #e5d9b8;padding-bottom:4px}
.top{border-bottom:3px solid #B8860B;padding-bottom:12px;margin-bottom:12px}.sub{color:#666;font-size:13px;text-transform:capitalize}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.k{border:1px solid #ddd;border-radius:8px;padding:10px}.k p{margin:0;font-size:11px;color:#666}.k b{font-size:18px;color:#36454F}
table{width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px}td,th{padding:6px 8px;border-bottom:1px solid #eee;text-align:left}th{background:#f6f2e7}.r{text-align:right}.neg{color:#b42318}.pos{color:#157347}
.btn{position:fixed;top:12px;right:12px;padding:8px 14px;background:#B8860B;color:#fff;border:0;border-radius:6px;cursor:pointer}@media print{.btn{display:none}}
</style></head><body>
<button class="btn" onclick="window.print()">Imprimir / Salvar PDF</button>
<div class="top"><h1>${esc(companyName)}</h1><div class="sub">Relatório financeiro ${kind === 'year' ? 'anual' : 'mensal'} · ${esc(report.label)}</div></div>
<div class="kpis">
<div class="k"><p>Entradas recebidas</p><b>${formatBRL(s.income)}</b></div>
<div class="k"><p>Saídas pagas</p><b>${formatBRL(s.expense)}</b></div>
<div class="k"><p>Resultado</p><b class="${s.profit < 0 ? 'neg' : 'pos'}">${formatBRL(s.profit)}</b></div>
<div class="k"><p>Margem</p><b>${s.margin.toFixed(1)}%</b></div>
<div class="k"><p>A receber</p><b>${formatBRL(s.receivable)}</b></div>
<div class="k"><p>A pagar</p><b>${formatBRL(s.payable)}</b></div>
</div>
<h2>${kind === 'year' ? 'Mês a mês' : 'Últimos 6 meses'}</h2>
<table><tr><th>Mês</th><th class="r">Entradas</th><th class="r">Saídas</th><th class="r">Resultado</th></tr>
${report.months.map((m) => `<tr><td>${m.label}</td><td class="r">${formatBRL(m.income)}</td><td class="r">${formatBRL(m.expense)}</td><td class="r ${m.result < 0 ? 'neg' : ''}">${formatBRL(m.result)}</td></tr>`).join('')}
</table>
<h2>Despesas por categoria</h2><table>${report.expenseCategories.map((c) => row(c.name, formatBRL(c.value))).join('') || row('Sem despesas pagas', '-')}</table>
<h2>Receitas por categoria</h2><table>${report.incomeCategories.map((c) => row(c.name, formatBRL(c.value))).join('') || row('Sem entradas recebidas', '-')}</table>
<h2>Principais clientes</h2><table>${report.topClients.map((c) => row(c.name, formatBRL(c.value))).join('') || row('Sem recebimentos de clientes', '-')}</table>
${s.overdueCount ? `<h2>Vencidos</h2><table>${row(`${s.overdueCount} conta(s) vencida(s)`, formatBRL(s.overdueAmount), 'neg')}</table>` : ''}
<p style="margin-top:30px;font-size:10px;color:#999;font-family:Arial">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) { toast.error('Permita pop-ups para gerar o PDF.'); return; }
    w.document.write(html);
    w.document.close();
  };

  const generateAI = async () => {
    setAiLoading(true);
    try {
      const payload = {
        label: report.label, kind: report.kind,
        entradas: s.income, saidas: s.expense, resultado: s.profit, margem_pct: Number(s.margin.toFixed(1)),
        a_receber: s.receivable, a_pagar: s.payable, vencidos_qtd: s.overdueCount, vencidos_valor: s.overdueAmount,
        meses: report.months, despesas_por_categoria: report.expenseCategories.slice(0, 8),
        receitas_por_categoria: report.incomeCategories.slice(0, 8), principais_clientes: report.topClients,
      };
      const { data, error } = await supabase.functions.invoke('ai-financial-presentation', { body: { report: payload, company: companyName } });
      if (error) {
        let msg = error.message;
        try { msg = (await (error as any).context?.json())?.error || msg; } catch { /* */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      setPresentation(data.presentation);
    } catch (e) {
      toast.error((e as Error).message || 'Não foi possível gerar a apresentação.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Relatório financeiro</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={kind} onValueChange={(v: 'month' | 'year') => setKind(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="month">Mensal</SelectItem><SelectItem value="year">Anual</SelectItem></SelectContent>
              </Select>
            </div>
            {kind === 'month' && (
              <div className="space-y-1.5">
                <Label>Mês</Label>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Ano</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-2 text-sm">
            <p className="text-xs text-muted-foreground capitalize">{report.label} · {report.txCount} lançamento(s)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-muted-foreground">Entradas</span><span className="text-right tabular-nums text-success">{formatBRL(s.income)}</span>
              <span className="text-muted-foreground">Saídas</span><span className="text-right tabular-nums text-destructive">{formatBRL(s.expense)}</span>
              <span className="font-semibold">Resultado</span><span className={`text-right tabular-nums font-semibold ${s.profit < 0 ? 'text-destructive' : ''}`}>{formatBRL(s.profit)}</span>
              <span className="text-muted-foreground">A receber</span><span className="text-right tabular-nums">{formatBRL(s.receivable)}</span>
              <span className="text-muted-foreground">A pagar</span><span className="text-right tabular-nums">{formatBRL(s.payable)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={exportPdf}><FileText className="h-4 w-4 mr-2" /> PDF</Button>
            <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 mr-2" /> Excel</Button>
          </div>
          <Button className="gradient-primary border-0 text-primary-foreground" disabled={aiLoading} onClick={generateAI}>
            {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {aiLoading ? 'A IA está montando a apresentação…' : 'Gerar apresentação com IA'}
            {!aiLoading && <Presentation className="h-4 w-4 ml-2" />}
          </Button>
        </DialogContent>
      </Dialog>
      {presentation && (
        <AIPresentation report={report} text={presentation} company={companyName} onClose={() => setPresentation(null)} />
      )}
    </>
  );
}
