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
  /** % de entrada exibido na seção "Investimento e condições". */
  downPaymentPct?: number;
  /** Texto da condição do saldo (ex: "no cartão de crédito em até 18x sem juros"). */
  balanceTerms?: string;
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
  const esc = (s: any) => String(s ?? '').replace(/</g, '&lt;');

  // Valor por ambiente escalado para fechar exatamente com o preço final.
  const allRooms = grouped.map(([room, list]) => ({
    room,
    raw: list.reduce((s, i) => s + i.unit_price * i.quantity, 0),
  }));
  // Ignora agrupamentos sem valor (insumos internos) quando existe ambiente valorizado.
  const withValue = allRooms.filter(r => r.raw > 0);
  const roomSubtotals = withValue.length ? withValue : allRooms;
  const rawTotal = roomSubtotals.reduce((s, r) => s + r.raw, 0);
  const scaled = roomSubtotals.map((r) =>
    rawTotal <= 0
      ? { ...r, value: data.finalPrice / Math.max(1, roomSubtotals.length) }
      : { ...r, value: (r.raw / rawTotal) * data.finalPrice },
  );
  const sumScaled = scaled.reduce((s, r) => s + r.value, 0);
  if (scaled.length > 0) scaled[scaled.length - 1].value += data.finalPrice - sumScaled;

  const ambientes = scaled.map(s => s.room).filter(Boolean);
  const escopoTxt = ambientes.length
    ? `Desenvolvimento e execução ${ambientes.length > 1 ? 'dos projetos' : 'do projeto'} de ${ambientes.join(', ').replace(/, ([^,]*)$/, ' e $1')}, contemplando as etapas descritas nesta proposta, desde o levantamento inicial até a fabricação e instalação dos móveis planejados.`
    : 'Desenvolvimento e execução do projeto de marcenaria planejada, contemplando as etapas descritas nesta proposta, desde o levantamento inicial até a fabricação e instalação.';

  const etapas: [string, string][] = [
    ['Visita técnica', 'Levantamento das medidas e avaliação do ambiente.'],
    ['Briefing e definição do projeto', 'Entendimento das necessidades, preferências e soluções desejadas.'],
    ['Projeto 3D', 'Desenvolvimento da proposta visual dos ambientes e apresentação do projeto.'],
    ['Detalhamento', 'Definição de medidas, divisões, acabamentos e demais especificações necessárias.'],
    ['Fabricação', 'Produção dos móveis planejados após a aprovação final do projeto.'],
    ['Instalação', 'Montagem e instalação dos móveis planejados no local definido.'],
  ];

  const pct = Math.min(100, Math.max(0, data.downPaymentPct ?? 50));
  const entrada = (data.finalPrice * pct) / 100;
  const saldo = data.finalPrice - entrada;
  const saldoTexto = (data.balanceTerms || data.paymentMethod || '').trim();

  const cityLine = data.client ? [data.client.city, data.client.state].filter(Boolean).join(' / ') : '';
  const company = esc(data.companyName || 'Marcenaria');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Proposta Comercial ${esc(data.code)}</title>
<style>
  @page { size: A4; margin: 16mm 16mm 18mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #1f2933; margin: 0; padding: 0; font-size: 12.5px; line-height: 1.55;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .cover {
    min-height: 250mm; display: flex; flex-direction: column; justify-content: center;
    text-align: center; padding: 40px; page-break-after: always;
  }
  .cover .brand { font-size: 13px; letter-spacing: 5px; text-transform: uppercase; color: #8a6d1f; font-weight: 700; }
  .cover .kicker { font-size: 11px; letter-spacing: 4px; text-transform: uppercase; color: #8f9aa5; margin-top: 6px; }
  .cover h1 { font-size: 34px; font-weight: 600; margin: 60px auto 8px; max-width: 460px; line-height: 1.25; }
  .cover .client { font-size: 14px; color: #5b6672; }
  .cover .box { margin: 60px auto 0; max-width: 420px; border: 1px solid #e3e6ea; border-radius: 14px; padding: 26px 20px; }
  .cover .box .lbl { font-size: 11px; letter-spacing: 2.5px; text-transform: uppercase; color: #8f9aa5; }
  .cover .box .val { font-size: 34px; font-weight: 700; margin-top: 8px; }
  .cover .foot { margin-top: 70px; font-size: 11px; color: #8f9aa5; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 1.2px; color: #1f2933;
       border-bottom: 2px solid #b8860b; padding-bottom: 6px; margin: 26px 0 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; background: #f4f5f7; color: #5b6672; font-size: 10.5px; text-transform: uppercase;
       letter-spacing: 0.8px; padding: 8px 10px; }
  td { padding: 8px 10px; border-bottom: 1px solid #edeff2; vertical-align: top; }
  td.step { width: 46px; color: #8a6d1f; font-weight: 700; }
  td.svc { width: 34%; font-weight: 600; }
  td.num { text-align: right; white-space: nowrap; }
  .pay td:first-child { width: 34%; font-weight: 600; }
  .pay tr:last-child td { border-bottom: none; }
  .total-row td { background: #1f2933; color: #fff; font-weight: 700; font-size: 14px; }
  ul { padding-left: 18px; margin: 8px 0; }
  li { margin: 4px 0; }
  .sig { margin-top: 56px; display: grid; grid-template-columns: 1fr 1fr; gap: 56px; }
  .sig div { border-top: 1px solid #1f2933; padding-top: 8px; text-align: center; font-size: 11px; }
  .sig strong { display: block; font-size: 12px; }
  .footer { margin-top: 32px; padding-top: 10px; border-top: 1px solid #edeff2; font-size: 10.5px; color: #8f9aa5; text-align: center; }
  .no-print { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    background: #1f2933; color: #fff; padding: 12px 26px; border-radius: 999px; border: none;
    font-size: 14px; cursor: pointer; z-index: 9999; box-shadow: 0 6px 20px rgba(0,0,0,.2); }
  @media print { .no-print { display: none !important; } }
</style></head><body>

<section class="cover">
  <div class="brand">${company}</div>
  <div class="kicker">Proposta Comercial</div>
  <h1>${esc(data.projectName || (ambientes.length ? `Projeto de ${ambientes.join(' + ')}` : 'Projeto de Marcenaria'))}</h1>
  <div class="client">Cliente: ${esc(data.client?.name || '—')}${cityLine ? ` · ${esc(cityLine)}` : ''}</div>
  <div class="box">
    <div class="lbl">Investimento total</div>
    <div class="val">${formatBRL(data.finalPrice)}</div>
  </div>
  <div class="foot">
    Proposta ${esc(data.code)} · ${new Date(data.createdAt).toLocaleDateString('pt-BR')}<br/>
    ${company}${data.companyPhone ? ` • ${esc(data.companyPhone)}` : ''}
  </div>
</section>

<h2>1. Escopo da proposta</h2>
<p>${escopoTxt}</p>
${(data.clientPdfOptions?.showDescription ?? true) && data.clientDescription
  ? `<p style="white-space:pre-wrap">${esc(data.clientDescription)}</p>` : ''}

<h2>2. O que está incluso</h2>
<table>
  <thead><tr><th>Etapa</th><th>Serviço</th><th>Descrição</th></tr></thead>
  <tbody>
    ${etapas.map(([s, d], i) => `<tr><td class="step">${String(i + 1).padStart(2, '0')}</td><td class="svc">${s}</td><td>${d}</td></tr>`).join('')}
  </tbody>
</table>

${ambientes.length ? `
<h2>3. Ambientes contemplados</h2>
<table>
  <thead><tr><th>Ambiente</th><th class="num">Investimento</th></tr></thead>
  <tbody>
    ${scaled.map(({ room, value }) => `<tr><td>${esc(room)}</td><td class="num">${formatBRL(value)}</td></tr>`).join('')}
  </tbody>
</table>` : ''}

${(data.clientPdfOptions?.showItemsList ?? false) && data.items.length ? `
<h2>Itens detalhados</h2>
<table>
  <thead><tr><th>Ambiente</th><th>Item</th><th class="num">Qtd</th></tr></thead>
  <tbody>
    ${data.items.map(i => `<tr><td>${esc(i.room_label || 'Geral')}</td><td>${esc(i.name)}</td><td class="num">${i.quantity}</td></tr>`).join('')}
  </tbody>
</table>` : ''}

<h2>${ambientes.length ? '4' : '3'}. Investimento e condições de pagamento</h2>
<table class="pay">
  <tbody>
    <tr class="total-row"><td>Valor total</td><td class="num">${formatBRL(data.finalPrice)}</td></tr>
    ${(data.clientPdfOptions?.showPaymentTerms ?? true) ? `
      <tr><td>Entrada (${pct}%)</td><td class="num">${formatBRL(entrada)}</td></tr>
      <tr><td>Saldo</td><td class="num">${formatBRL(saldo)}${saldoTexto ? ` — ${esc(saldoTexto)}` : ''}</td></tr>
    ` : ''}
  </tbody>
</table>

<h2>${ambientes.length ? '5' : '4'}. Prazo</h2>
<p>Prazo estimado de entrega: <strong>${data.deliveryDays} dias úteis</strong> (previsão: ${deliveryDate.toLocaleDateString('pt-BR')}), contado a partir da confirmação do pagamento da entrada e da aprovação das informações necessárias para o desenvolvimento do projeto.</p>

<h2>${ambientes.length ? '6' : '5'}. Aprovação e início da fabricação</h2>
<p>A fabricação será iniciada somente após a aprovação final do projeto pelo cliente. Alterações solicitadas após a aprovação poderão gerar revisão de prazo e/ou valores, quando envolverem mudanças relevantes no projeto ou nos materiais.</p>

<h2>${ambientes.length ? '7' : '6'}. Observações</h2>
<ul>
  ${(data.clientPdfOptions?.showContractClauses ?? true) && data.contractClauses.length
    ? data.contractClauses.map(c => `<li>${esc(c)}</li>`).join('')
    : `<li>Medidas e condições do local serão verificadas na visita técnica.</li>
       <li>A execução seguirá o projeto aprovado pelo cliente.</li>
       <li>Eventuais serviços ou itens não descritos nesta proposta serão orçados separadamente.</li>`}
</ul>

<div class="sig">
  <div><strong>${company}</strong>Responsável pela proposta</div>
  <div><strong>${esc(data.client?.name || 'Cliente')}</strong>Aprovação da proposta</div>
</div>

<div class="footer">
  ${company}${data.companyCnpj ? ` · CNPJ ${esc(data.companyCnpj)}` : ''}${data.companyPhone ? ` · ${esc(data.companyPhone)}` : ''}${data.companyEmail ? ` · ${esc(data.companyEmail)}` : ''}<br/>
  Documento gerado em ${new Date().toLocaleDateString('pt-BR')}.
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
