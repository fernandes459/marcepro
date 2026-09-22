import { formatBRL } from '@/lib/format';

export interface ReceiptPdfData {
  receiptNumber: string;
  clientName?: string | null;
  clientDoc?: string | null;
  budgetCode?: string | null;
  projectName?: string | null;
  installmentLabel?: string | null;
  amount: number;
  date: string; // YYYY-MM-DD
  paymentMethod?: string | null;
  accountName?: string | null;
  notes?: string | null;
  contracted?: number | null;
  received?: number | null;
  remaining?: number | null;
  companyName?: string | null;
  companyDoc?: string | null;
  companyCity?: string | null;
  companyState?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
}

const esc = (s: any) => String(s ?? '').replace(/</g, '&lt;');
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

const UNITS = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
  'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const HUNDREDS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos',
  'setecentos', 'oitocentos', 'novecentos'];

function under1000(n: number): string {
  if (n === 100) return 'cem';
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(HUNDREDS[h]);
  if (r) {
    if (r < 20) parts.push(UNITS[r]);
    else {
      const t = Math.floor(r / 10);
      const u = r % 10;
      parts.push(u ? `${TENS[t]} e ${UNITS[u]}` : TENS[t]);
    }
  }
  return parts.join(' e ');
}

function intToWords(n: number): string {
  if (n === 0) return 'zero';
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  if (millions) parts.push(`${millions === 1 ? 'um milhão' : `${under1000(millions)} milhões`}`);
  if (thousands) parts.push(`${thousands === 1 ? 'mil' : `${under1000(thousands)} mil`}`);
  if (rest) parts.push(under1000(rest));
  return parts.join(' e ');
}

export function valorEmPalavras(value: number): string {
  const total = Math.round(Math.abs(value) * 100);
  const reais = Math.floor(total / 100);
  const centavos = total % 100;
  const p: string[] = [];
  if (reais) p.push(`${intToWords(reais)} ${reais === 1 ? 'real' : 'reais'}`);
  if (centavos) p.push(`${intToWords(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  if (!p.length) return 'zero real';
  return p.join(' e ');
}

function renderReceipt(d: ReceiptPdfData): string {
  const company = esc(d.companyName || 'Marcenaria');
  const cityLine = [d.companyCity, d.companyState].filter(Boolean).join(' / ');
  const contactLine = [d.companyPhone, d.companyEmail].filter(Boolean).join(' · ');
  const rows: [string, string][] = [
    ['Cliente', esc(d.clientName || 'Não informado')],
    ...(d.clientDoc ? [['CPF / CNPJ', esc(d.clientDoc)]] as [string, string][] : []),
    ['Orçamento', esc([d.budgetCode, d.projectName].filter(Boolean).join(' — ') || 'Não vinculado')],
    ...(d.installmentLabel ? [['Referente a', esc(d.installmentLabel)]] as [string, string][] : []),
    ['Data do pagamento', fmtDate(d.date)],
    ['Forma de pagamento', esc(d.paymentMethod || 'Não informada')],
    ...(d.accountName ? [['Conta de destino', esc(d.accountName)]] as [string, string][] : []),
  ];

  const saldoBlock = (d.contracted != null || d.remaining != null) ? `
<h2>Situação do contrato</h2>
<table class="grid">
  <tr><th>Valor contratado</th><th>Total recebido</th><th>Saldo restante</th></tr>
  <tr>
    <td>${formatBRL(d.contracted ?? 0)}</td>
    <td>${formatBRL(d.received ?? 0)}</td>
    <td>${formatBRL(d.remaining ?? 0)}</td>
  </tr>
</table>` : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Recibo ${esc(d.receiptNumber)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #1f2933; margin: 0; font-size: 13px; line-height: 1.6;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 2px solid #b8860b; padding-bottom: 12px; }
  .brand { font-size: 17px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .sub { font-size: 11px; color: #8f9aa5; margin-top: 3px; }
  .doc { text-align: right; }
  .doc .lbl { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #8a6d1f; font-weight: 700; }
  .doc .num { font-size: 12px; color: #5b6672; margin-top: 3px; }
  .amount { margin: 24px 0; border: 1px solid #e3e6ea; border-radius: 14px; padding: 20px 22px; background: #fafbfc; }
  .amount .lbl { font-size: 10.5px; letter-spacing: 2.5px; text-transform: uppercase; color: #8f9aa5; }
  .amount .val { font-size: 32px; font-weight: 700; margin-top: 4px; }
  .amount .words { font-size: 12px; color: #5b6672; font-style: italic; margin-top: 4px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px;
    border-bottom: 1px solid #e3e6ea; padding-bottom: 5px; margin: 24px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  td.k { width: 34%; color: #8f9aa5; padding: 7px 0; }
  td.v { font-weight: 600; padding: 7px 0; }
  table.grid th { text-align: left; background: #f4f5f7; color: #5b6672; font-size: 10.5px;
    text-transform: uppercase; letter-spacing: .8px; padding: 8px 10px; }
  table.grid td { padding: 9px 10px; border-bottom: 1px solid #edeff2; font-weight: 600; }
  .decl { margin-top: 22px; font-size: 12.5px; color: #3c4753; }
  .sign { margin-top: 56px; text-align: center; }
  .sign .line { border-top: 1px solid #1f2933; width: 300px; margin: 0 auto 6px; }
  .sign .name { font-weight: 600; }
  .sign .role { font-size: 11px; color: #8f9aa5; }
  .foot { margin-top: 32px; font-size: 10.5px; color: #8f9aa5; text-align: center; }
  .no-print { position: fixed; top: 12px; right: 12px; padding: 10px 16px; background: #b8860b;
    color: #fff; border: 0; border-radius: 8px; font-size: 13px; cursor: pointer; }
  @media print { .no-print { display: none; } }
</style></head><body>

<div class="head">
  <div>
    <div class="brand">${company}</div>
    ${d.companyDoc ? `<div class="sub">CNPJ ${esc(d.companyDoc)}</div>` : ''}
    ${cityLine ? `<div class="sub">${esc(cityLine)}</div>` : ''}
    ${contactLine ? `<div class="sub">${esc(contactLine)}</div>` : ''}
  </div>
  <div class="doc">
    <div class="lbl">Recibo</div>
    <div class="num">Nº ${esc(d.receiptNumber)}</div>
    <div class="num">${fmtDate(d.date)}</div>
  </div>
</div>

<div class="amount">
  <div class="lbl">Valor recebido</div>
  <div class="val">${formatBRL(d.amount)}</div>
  <div class="words">(${valorEmPalavras(d.amount)})</div>
</div>

<h2>Dados do recebimento</h2>
<table>
  ${rows.map(([k, v]) => `<tr><td class="k">${k}</td><td class="v">${v}</td></tr>`).join('')}
</table>

${saldoBlock}

${d.notes ? `<h2>Observações</h2><p style="margin:0;color:#3c4753">${esc(d.notes)}</p>` : ''}

<p class="decl">
  Declaramos, para os devidos fins, que recebemos de <strong>${esc(d.clientName || 'cliente')}</strong>
  a quantia de <strong>${formatBRL(d.amount)}</strong> (${valorEmPalavras(d.amount)}),
  referente ${d.budgetCode ? `ao orçamento <strong>${esc(d.budgetCode)}</strong>` : 'aos serviços contratados'}${d.projectName ? ` — ${esc(d.projectName)}` : ''},
  dando plena quitação do valor aqui discriminado.
</p>

<div class="sign">
  <div class="line"></div>
  <div class="name">${company}</div>
  <div class="role">Assinatura do recebedor</div>
</div>

<div class="foot">${cityLine ? `${esc(cityLine)}, ` : ''}${fmtDate(d.date)} · Documento gerado eletronicamente</div>

<button class="no-print" onclick="window.print()">Imprimir / Salvar PDF</button>
</body></html>`;
}

export function generateReceiptPdf(data: ReceiptPdfData): void {
  const html = renderReceipt(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.onload = () => URL.revokeObjectURL(url);
  } else {
    const link = document.createElement('a');
    link.href = url;
    link.download = `Recibo_${data.receiptNumber}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
