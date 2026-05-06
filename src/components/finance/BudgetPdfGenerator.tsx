import { formatBRL } from '@/lib/format';

export interface BudgetPdfItem {
  name: string;
  quantity: number;
  unit_price: number;
  room_label?: string | null;
  material_cost?: number;
  labor_cost?: number;
}

export interface BudgetPdfData {
  code: string;
  projectName: string | null;
  finalPrice: number;
  totalCost: number;
  profitMargin: number;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string;
  deliveryDays: number;
  client: {
    name: string;
    phone: string;
    email: string | null;
    cpf_cnpj: string | null;
    address: string | null;
    address_number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    cep: string | null;
  } | null;
  items: BudgetPdfItem[];
  companyName?: string;
  companyCnpj?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  contractClauses: string[];
  /** Texto livre que aparece no PDF do cliente (descrição do projeto). */
  clientDescription?: string | null;
  /** 'client' = limpo estilo Apple (sem custos);  'internal' = completo c/ custos. */
  mode?: 'client' | 'internal';
  /** Configuração de blocos opcionais no PDF do cliente. */
  clientPdfOptions?: {
    showDescription?: boolean;
    showItemsList?: boolean;
    showPaymentTerms?: boolean;
    showContractClauses?: boolean;
  };
  /** legacy: mantém compat */
  simplified?: boolean;
}

function addBusinessDays(startDate: Date, numDays: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < numDays) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

function groupByRoom(items: BudgetPdfItem[]) {
  const map = new Map<string, BudgetPdfItem[]>();
  for (const it of items) {
    const key = (it.room_label || 'Geral').trim() || 'Geral';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  return Array.from(map.entries());
}

/* ===========================================================
   MODO CLIENTE — Estilo Apple, minimalista, muito espaço em branco.
   Mostra apenas: ambientes + valor por ambiente + total + condições.
   =========================================================== */
function renderClientPdf(data: BudgetPdfData): string {
  const grouped = groupByRoom(data.items);
  const deliveryDate = addBusinessDays(new Date(data.createdAt), data.deliveryDays);

  // Calcula subtotal "bruto" de cada ambiente e escala proporcionalmente ao preço final,
  // para que a soma dos ambientes seja exatamente igual ao Investimento Total exibido.
  const roomSubtotals = grouped.map(([room, list]) => ({
    room,
    raw: list.reduce((s, i) => s + i.unit_price * i.quantity, 0),
  }));
  const rawTotal = roomSubtotals.reduce((s, r) => s + r.raw, 0);
  const scaled = roomSubtotals.map((r, idx) => {
    if (rawTotal <= 0) {
      // distribui igualmente se não houver base
      return { ...r, value: data.finalPrice / Math.max(1, roomSubtotals.length) };
    }
    return { ...r, value: (r.raw / rawTotal) * data.finalPrice };
  });
  // Ajuste de arredondamento: força a soma a bater com finalPrice no último item
  const sumScaled = scaled.reduce((s, r) => s + r.value, 0);
  if (scaled.length > 0) {
    scaled[scaled.length - 1].value += data.finalPrice - sumScaled;
  }

  const roomsHtml = scaled
    .map(({ room, value }) => `
        <div class="room">
          <div class="room-head">
            <div class="room-name">${room}</div>
            <div class="room-value">${formatBRL(value)}</div>
          </div>
        </div>`)
    .join('');

  const addressLine = data.client
    ? [data.client.city, data.client.state].filter(Boolean).join(' / ')
    : '';

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Orçamento ${data.code}</title>
<style>
  @page { size: A4; margin: 22mm 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Inter, sans-serif;
    color: #1d1d1f; margin: 0; padding: 24px;
    -webkit-font-smoothing: antialiased; letter-spacing: -0.01em;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page { max-width: 720px; margin: 0 auto; }
  .brand { font-size: 13px; color: #86868b; letter-spacing: 0.4px; text-transform: uppercase; }
  .hero { margin: 48px 0 64px; }
  .hero h1 { font-size: 56px; font-weight: 600; margin: 8px 0 12px; line-height: 1.05; letter-spacing: -0.02em; }
  .hero p { font-size: 19px; color: #515154; margin: 0; max-width: 560px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px 48px; margin: 56px 0; }
  .meta-label { font-size: 11px; color: #86868b; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 4px; }
  .meta-value { font-size: 17px; color: #1d1d1f; font-weight: 500; }
  .section-title { font-size: 13px; color: #86868b; text-transform: uppercase; letter-spacing: 0.8px; margin: 64px 0 16px; }
  .room { padding: 22px 0; border-bottom: 1px solid #f2f2f4; }
  .room:last-child { border-bottom: none; }
  .room-head { display: flex; justify-content: space-between; align-items: baseline; }
  .room-name { font-size: 22px; font-weight: 500; }
  .room-value { font-size: 22px; font-weight: 500; color: #1d1d1f; }
  .room-sub { font-size: 13px; color: #86868b; margin-top: 6px; line-height: 1.5; }
  .total-card {
    margin: 64px 0 40px; padding: 40px 32px; background: #f5f5f7; border-radius: 24px;
    text-align: center;
  }
  .total-card .label { font-size: 13px; color: #86868b; text-transform: uppercase; letter-spacing: 0.8px; }
  .total-card .value { font-size: 56px; font-weight: 600; margin-top: 6px; letter-spacing: -0.02em; }
  .pay { font-size: 16px; color: #515154; line-height: 1.6; max-width: 580px; }
  .footer { margin-top: 80px; padding-top: 24px; border-top: 1px solid #f2f2f4; text-align: center; font-size: 12px; color: #86868b; }
  .signature-area { margin-top: 80px; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; }
  .sig { border-top: 1px solid #1d1d1f; padding-top: 8px; font-size: 12px; color: #86868b; text-align: center; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
  .no-print {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
    background: #1d1d1f; color: #fff; padding: 14px 28px; border-radius: 980px;
    border: none; font-size: 15px; font-weight: 500; cursor: pointer;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18); z-index: 9999;
  }
</style></head><body>
<div class="page">
  <div class="brand">${data.companyName || 'Marcenaria'}</div>

  <div class="hero">
    <h1>${data.projectName || 'Seu projeto'}</h1>
    <p>Proposta exclusiva preparada para ${data.client?.name || 'você'}.</p>
  </div>

  <div class="meta-grid">
    <div>
      <div class="meta-label">Cliente</div>
      <div class="meta-value">${data.client?.name || '—'}</div>
    </div>
    <div>
      <div class="meta-label">Cidade</div>
      <div class="meta-value">${addressLine || '—'}</div>
    </div>
    <div>
      <div class="meta-label">Proposta</div>
      <div class="meta-value">${data.code}</div>
    </div>
    <div>
      <div class="meta-label">Entrega prevista</div>
      <div class="meta-value">${deliveryDate.toLocaleDateString('pt-BR')} <span style="color:#86868b;font-weight:400">(${data.deliveryDays} dias úteis)</span></div>
    </div>
  </div>

  <div class="section-title">O que está incluso</div>
  ${roomsHtml || '<div class="room"><div class="room-head"><div class="room-name">Projeto</div><div class="room-value">' + formatBRL(data.finalPrice) + '</div></div></div>'}

  <div class="total-card">
    <div class="label">Investimento total</div>
    <div class="value">${formatBRL(data.finalPrice)}</div>
  </div>

  ${data.paymentMethod ? `
    <div class="section-title">Condições de pagamento</div>
    <div class="pay">${data.paymentMethod.replace(/\s*\(taxa[^)]*\)/gi, '').replace(/\s*taxa[^.+]*/gi, '').trim()}</div>
  ` : ''}

  ${data.contractClauses.length ? `
    <div class="section-title">Termos e condições</div>
    <ul style="padding-left:0;list-style:none;font-size:14px;color:#515154;line-height:1.7;">
      ${data.contractClauses.map((c, i) => `<li style="margin:10px 0;"><strong style="color:#1d1d1f;">${i + 1}.</strong> ${c}</li>`).join('')}
    </ul>
  ` : ''}

  <div class="signature-area">
    <div class="sig">${data.companyName || 'Contratada'}</div>
    <div class="sig">${data.client?.name || 'Cliente'}</div>
  </div>

  <div class="footer">
    ${data.companyName || 'Marcenaria'}${data.companyPhone ? ` · ${data.companyPhone}` : ''}${data.companyEmail ? ` · ${data.companyEmail}` : ''}<br/>
    Documento gerado em ${new Date().toLocaleDateString('pt-BR')}.
  </div>
</div>
<button class="no-print" onclick="window.print()">Imprimir / Salvar PDF</button>
</body></html>`;
}

/* ===========================================================
   MODO INTERNO — Completo, com custos, margem e contrato.
   Visual também limpo, mas técnico.
   =========================================================== */
function renderInternalPdf(data: BudgetPdfData): string {
  const grouped = groupByRoom(data.items);
  const deliveryDate = addBusinessDays(new Date(data.createdAt), data.deliveryDays);

  const tablesHtml = grouped
    .map(([room, list]) => {
      const rows = list
        .map(
          (i, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${i.name}</td>
            <td class="num">${i.quantity}</td>
            <td class="num">${formatBRL(i.unit_price)}</td>
            <td class="num strong">${formatBRL(i.unit_price * i.quantity)}</td>
          </tr>`,
        )
        .join('');
      const subtotal = list.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      return `
        <h3 class="room-title">${room}</h3>
        <table>
          <thead><tr><th>#</th><th>Descrição</th><th class="num">Qtd</th><th class="num">Unitário</th><th class="num">Total</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="4" class="num">Subtotal ${room}</td><td class="num strong">${formatBRL(subtotal)}</td></tr></tfoot>
        </table>`;
    })
    .join('');

  const profit = data.finalPrice - data.totalCost;

  const clausesHtml = data.contractClauses
    .map((c, i) => `<li><strong>${i + 1}.</strong> ${c}</li>`)
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Orçamento Interno ${data.code}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Inter, sans-serif;
    color: #1d1d1f; margin: 0; padding: 16px; font-size: 12px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  h1, h2, h3 { letter-spacing: -0.01em; }
  .header { display: flex; justify-content: space-between; align-items: flex-end;
    border-bottom: 1px solid #d2d2d7; padding-bottom: 12px; margin-bottom: 20px; }
  .brand { font-size: 18px; font-weight: 600; }
  .doc { text-align: right; font-size: 11px; color: #6e6e73; }
  .doc strong { font-size: 14px; color: #1d1d1f; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 12px 0 24px; }
  .card { border: 1px solid #d2d2d7; border-radius: 12px; padding: 12px 16px; }
  .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #86868b; }
  .value { font-size: 14px; font-weight: 500; margin-top: 2px; }
  .room-title { margin: 24px 0 8px; font-size: 14px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; background: #f5f5f7; padding: 8px 10px; font-weight: 600; color: #515154; }
  td { padding: 7px 10px; border-bottom: 1px solid #f2f2f4; }
  td.num, th.num { text-align: right; }
  .strong { font-weight: 600; }
  tfoot td { background: #fafafc; font-weight: 600; }
  .totals { margin-top: 24px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .totals .card { text-align: center; }
  .totals .value { font-size: 18px; }
  .contract { margin-top: 28px; }
  .contract h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.6px; }
  .contract ol, .contract ul { padding-left: 0; list-style: none; }
  .contract li { margin: 6px 0; line-height: 1.5; color: #3a3a3d; }
  .signature-area { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; }
  .sig { border-top: 1px solid #1d1d1f; padding-top: 6px; font-size: 11px; color: #6e6e73; text-align: center; }
  .no-print {
    position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
    background: #1d1d1f; color: #fff; padding: 12px 24px; border-radius: 999px;
    border: none; font-size: 14px; cursor: pointer; z-index: 9999;
    box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  }
  @media print { body { padding: 0; } .no-print { display: none !important; } }
</style></head><body>
<div class="header">
  <div>
    <div class="brand">${data.companyName || 'Marcenaria Pro'}</div>
    ${data.companyCnpj ? `<div style="color:#6e6e73">CNPJ: ${data.companyCnpj}</div>` : ''}
    ${data.companyPhone ? `<div style="color:#6e6e73">${data.companyPhone}</div>` : ''}
  </div>
  <div class="doc">
    <div>Orçamento (uso interno)</div>
    <strong>${data.code}</strong>
    <div>${new Date(data.createdAt).toLocaleDateString('pt-BR')}</div>
  </div>
</div>

<div class="grid2">
  <div class="card">
    <div class="label">Cliente</div>
    <div class="value">${data.client?.name || '—'}</div>
    <div style="font-size:11px;color:#6e6e73;margin-top:4px">
      ${data.client?.phone || ''}${data.client?.email ? ' · ' + data.client.email : ''}
    </div>
  </div>
  <div class="card">
    <div class="label">Projeto</div>
    <div class="value">${data.projectName || '—'}</div>
    <div style="font-size:11px;color:#6e6e73;margin-top:4px">
      Entrega: ${deliveryDate.toLocaleDateString('pt-BR')} (${data.deliveryDays} dias úteis)
    </div>
  </div>
</div>

${tablesHtml}

<div class="totals">
  <div class="card"><div class="label">Custo Total</div><div class="value">${formatBRL(data.totalCost)}</div></div>
  <div class="card"><div class="label">Margem</div><div class="value">${data.profitMargin.toFixed(1)}%</div></div>
  <div class="card"><div class="label">Lucro</div><div class="value">${formatBRL(profit)}</div></div>
  <div class="card" style="background:#1d1d1f;color:#fff;border-color:#1d1d1f">
    <div class="label" style="color:#a1a1a6">Preço Final</div>
    <div class="value">${formatBRL(data.finalPrice)}</div>
  </div>
</div>

${data.paymentMethod ? `
  <div class="card" style="margin-top:20px">
    <div class="label">Condições de Pagamento</div>
    <div style="margin-top:6px;font-size:12px;line-height:1.5">${data.paymentMethod}</div>
  </div>` : ''}

${data.notes ? `
  <div class="card" style="margin-top:12px">
    <div class="label">Observações</div>
    <div style="margin-top:6px;font-size:11px;line-height:1.5;color:#3a3a3d">${data.notes.replace(/<!--BUDGET_META:.*?-->/s, '').trim()}</div>
  </div>` : ''}


<div class="signature-area">
  <div class="sig">${data.companyName || 'Contratada'}</div>
  <div class="sig">${data.client?.name || 'Cliente'}</div>
</div>

<button class="no-print" onclick="window.print()">Imprimir / Salvar PDF</button>
</body></html>`;
}

export function generateBudgetPdf(data: BudgetPdfData): void {
  const mode: 'client' | 'internal' = data.mode ?? (data.simplified ? 'client' : 'internal');
  const html = mode === 'client' ? renderClientPdf(data) : renderInternalPdf(data);

  const blob = new Blob([html], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  const newWindow = window.open(blobUrl, '_blank');
  if (newWindow) {
    newWindow.onload = () => URL.revokeObjectURL(blobUrl);
  } else {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `Orcamento_${data.code}_${mode}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }
}

export const defaultContractClauses = [
  'O prazo de entrega será contado a partir da confirmação do pagamento da entrada e aprovação do projeto pelo cliente.',
  'Eventuais alterações no projeto após aprovação poderão acarretar em custos adicionais e alteração do prazo de entrega.',
  'O pagamento deverá ser efetuado conforme as condições estabelecidas neste documento.',
  'A garantia dos móveis é de 12 (doze) meses a partir da data de entrega/montagem, cobrindo defeitos de fabricação.',
  'Não estão cobertos pela garantia: mau uso, exposição a umidade excessiva, calor direto e danos causados por terceiros.',
  'O cancelamento do pedido após início da produção implicará em multa de 30% do valor total do orçamento.',
  'A contratada não se responsabiliza por atrasos decorrentes de caso fortuito ou força maior.',
  'O foro competente para dirimir eventuais conflitos será o da comarca da sede da contratada.',
];
