import { formatBRL } from '@/lib/format';

interface BudgetPdfData {
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
  items: { name: string; quantity: number; unit_price: number }[];
  companyName?: string;
  companyCnpj?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyAddress?: string;
  contractClauses: string[];
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

function buildHeader(data: BudgetPdfData): string {
  return `
  <div class="header">
    <div>
      <div class="company-name">${data.companyName || 'Marcenaria Pro'}</div>
      ${data.companyCnpj ? `<div style="font-size:12px;color:#6b7280">CNPJ: ${data.companyCnpj}</div>` : ''}
      ${data.companyPhone ? `<div style="font-size:12px;color:#6b7280">Tel: ${data.companyPhone}</div>` : ''}
      ${data.companyEmail ? `<div style="font-size:12px;color:#6b7280">${data.companyEmail}</div>` : ''}
      ${data.companyAddress ? `<div style="font-size:12px;color:#6b7280">${data.companyAddress}</div>` : ''}
    </div>
    <div>
      <div class="doc-title">ORÇAMENTO</div>
      <div class="doc-code">${data.code} • ${new Date(data.createdAt).toLocaleDateString('pt-BR')}</div>
    </div>
  </div>`;
}

function buildClientSection(data: BudgetPdfData, simplified: boolean): string {
  if (!data.client) return '';
  if (simplified) {
    return `
    <div class="section">
      <div class="section-title">Cliente</div>
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Nome: </span>${data.client.name}</div>
        <div class="info-item"><span class="info-label">Telefone: </span>${data.client.phone}</div>
      </div>
    </div>`;
  }
  const clientAddress = [
    data.client.address,
    data.client.address_number ? `Nº ${data.client.address_number}` : '',
    data.client.complement,
    data.client.neighborhood,
    data.client.city && data.client.state ? `${data.client.city}/${data.client.state}` : data.client.city,
    data.client.cep ? `CEP: ${data.client.cep}` : '',
  ].filter(Boolean).join(', ');

  return `
  <div class="section">
    <div class="section-title">Dados do Cliente</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">Nome: </span>${data.client.name}</div>
      <div class="info-item"><span class="info-label">Telefone: </span>${data.client.phone}</div>
      ${data.client.email ? `<div class="info-item"><span class="info-label">Email: </span>${data.client.email}</div>` : ''}
      ${data.client.cpf_cnpj ? `<div class="info-item"><span class="info-label">CPF/CNPJ: </span>${data.client.cpf_cnpj}</div>` : ''}
    </div>
    ${clientAddress ? `<div class="info-item" style="margin-top:6px"><span class="info-label">Endereço: </span>${clientAddress}</div>` : ''}
  </div>`;
}

function buildProjectSection(data: BudgetPdfData): string {
  const startDate = new Date(data.createdAt);
  const deliveryDate = addBusinessDays(startDate, data.deliveryDays);
  const deliveryDateFormatted = deliveryDate.toLocaleDateString('pt-BR');

  return `
  <div class="section">
    <div class="section-title">Projeto</div>
    <div class="info-grid">
      ${data.projectName ? `<div class="info-item"><span class="info-label">Nome: </span>${data.projectName}</div>` : ''}
      <div class="info-item"><span class="info-label">Prazo de Entrega: </span>${data.deliveryDays} dias úteis</div>
      <div class="info-item"><span class="info-label">Data Prevista: </span>${deliveryDateFormatted}</div>
    </div>
  </div>`;
}

function buildTotalBox(data: BudgetPdfData): string {
  return `
  <div class="total-box">
    <div class="total-label">VALOR TOTAL</div>
    <div class="total-value">${formatBRL(data.finalPrice)}</div>
  </div>`;
}

function buildPaymentSection(data: BudgetPdfData): string {
  if (!data.paymentMethod) return '';
  return `
  <div class="section">
    <div class="section-title">Condições de Pagamento</div>
    <p style="font-size:14px;line-height:1.6">${data.paymentMethod}</p>
  </div>`;
}

function buildItemsTable(data: BudgetPdfData): string {
  if (data.items.length === 0) return '';
  const itemsHtml = data.items.map((item, i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px">${i + 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:13px">${item.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px">${formatBRL(item.unit_price)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600">${formatBRL(item.unit_price * item.quantity)}</td>
    </tr>
  `).join('');

  return `
  <div class="section">
    <div class="section-title">Itens do Orçamento</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:center;border-radius:6px 0 0 0">#</th>
          <th style="text-align:left">Descrição</th>
          <th style="text-align:center">Qtd</th>
          <th style="text-align:right">Unit.</th>
          <th style="text-align:right;border-radius:0 6px 0 0">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
  </div>`;
}

function buildContractSection(data: BudgetPdfData): string {
  if (data.contractClauses.length === 0) return '';
  const clausesHtml = data.contractClauses.map((clause, i) => `
    <p style="margin:6px 0;font-size:12px;line-height:1.5;color:#374151">
      <strong>${i + 1}.</strong> ${clause}
    </p>
  `).join('');

  return `
  <div class="contract-section">
    <div class="contract-title">TERMOS E CONDIÇÕES CONTRATUAIS</div>
    ${clausesHtml}
  </div>`;
}

function buildSignatureArea(data: BudgetPdfData): string {
  return `
  <div class="signature-area">
    <div><div class="signature-line">${data.companyName || 'Marcenaria Pro'}<br>Contratada</div></div>
    <div><div class="signature-line">${data.client?.name || 'Cliente'}<br>Contratante</div></div>
  </div>`;
}

const pdfStyles = `
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1f2e; margin: 0; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #e07a3a; padding-bottom: 16px; margin-bottom: 24px; }
  .company-name { font-size: 24px; font-weight: 800; color: #e07a3a; }
  .doc-title { font-size: 20px; font-weight: 700; color: #1a1f2e; text-align: right; }
  .doc-code { font-size: 14px; color: #6b7280; text-align: right; }
  .section { margin: 20px 0; }
  .section-title { font-size: 14px; font-weight: 700; color: #e07a3a; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #fed7aa; padding-bottom: 4px; margin-bottom: 12px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .info-item { font-size: 13px; }
  .info-label { color: #6b7280; font-weight: 500; }
  .total-box { background: linear-gradient(135deg, #e07a3a, #d4693a); color: white; padding: 16px 20px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin: 20px 0; }
  .total-label { font-size: 16px; font-weight: 600; }
  .total-value { font-size: 28px; font-weight: 800; }
  .contract-section { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 24px; }
  .contract-title { font-size: 16px; font-weight: 700; color: #1a1f2e; margin-bottom: 12px; }
  .signature-area { margin-top: 40px; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; text-align: center; }
  .signature-line { border-top: 1px solid #1a1f2e; padding-top: 8px; font-size: 12px; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1a1f2e; color: white; padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 12px; }
  @media print { body { padding: 0; } .no-print { display: none !important; } }
`;

export function generateBudgetPdf(data: BudgetPdfData): void {
  const simplified = data.simplified ?? false;

  const bodyContent = [
    buildHeader(data),
    buildClientSection(data, simplified),
    buildProjectSection(data),
    !simplified ? buildItemsTable(data) : '',
    buildTotalBox(data),
    buildPaymentSection(data),
    !simplified && data.notes ? `
    <div class="section">
      <div class="section-title">Observações</div>
      <p style="font-size:13px;line-height:1.5;color:#374151">${data.notes}</p>
    </div>` : '',
    !simplified ? buildContractSection(data) : '',
    buildSignatureArea(data),
    `<div class="footer">Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')} • ${data.companyName || 'Marcenaria Pro'} — ERP</div>`,
    `<div class="no-print" style="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:12px;z-index:9999;">
      <button onclick="window.print()" style="background:#e07a3a;color:white;border:none;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(224,122,58,0.4);">
        📄 Imprimir / Salvar PDF
      </button>
    </div>`,
  ].filter(Boolean).join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Orçamento ${data.code}${simplified ? ' (Simplificado)' : ''}</title>
  <style>${pdfStyles}</style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  const newWindow = window.open(blobUrl, '_blank');
  if (newWindow) {
    newWindow.onload = () => URL.revokeObjectURL(blobUrl);
  } else {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `Orcamento_${data.code}${simplified ? '_simplificado' : ''}.html`;
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
