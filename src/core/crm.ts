/**
 * CRM — regras puras do funil comercial (sem acesso ao banco).
 * IDs de etapa antigos ('novo', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido')
 * foram mantidos para compatibilidade com notificações e dados existentes.
 */

export type LeadStage =
  | 'novo'
  | 'primeiro_contato'
  | 'em_qualificacao'
  | 'qualificado'
  | 'visita_tecnica'
  | 'projeto'
  | 'proposta'
  | 'negociacao'
  | 'ganho'
  | 'perdido';

export const LEAD_STAGES: { id: LeadStage; title: string; color: string; probability: number }[] = [
  { id: 'novo',             title: 'Novo lead',                 color: 'hsl(210, 80%, 52%)', probability: 10 },
  { id: 'primeiro_contato', title: 'Primeiro contato',          color: 'hsl(200, 70%, 48%)', probability: 15 },
  { id: 'em_qualificacao',  title: 'Em qualificação',           color: 'hsl(190, 60%, 42%)', probability: 20 },
  { id: 'qualificado',      title: 'Qualificado',               color: 'hsl(38, 92%, 50%)',  probability: 30 },
  { id: 'visita_tecnica',   title: 'Visita técnica',            color: 'hsl(32, 88%, 52%)',  probability: 40 },
  { id: 'projeto',          title: 'Projeto em desenvolvimento',color: 'hsl(28, 85%, 56%)',  probability: 50 },
  { id: 'proposta',         title: 'Orçamento enviado',         color: 'hsl(280, 55%, 55%)', probability: 60 },
  { id: 'negociacao',       title: 'Negociação',                color: 'hsl(265, 60%, 55%)', probability: 75 },
  { id: 'ganho',            title: 'Aprovado',                  color: 'hsl(152, 60%, 42%)', probability: 100 },
  { id: 'perdido',          title: 'Perdido',                   color: 'hsl(0, 70%, 55%)',   probability: 0 },
];

export const CLOSED_STAGES: LeadStage[] = ['ganho', 'perdido'];

export function isOpenStage(stage: string): boolean {
  return !CLOSED_STAGES.includes(stage as LeadStage);
}

export function stageTitle(stage: string): string {
  return LEAD_STAGES.find((s) => s.id === stage)?.title ?? stage;
}

/** Origens — mesmas opções usadas no cadastro de orçamento, para os dados cruzarem. */
export const LEAD_SOURCES: { value: string; label: string }[] = [
  { value: 'indicacao', label: 'Indicação' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google / Site' },
  { value: 'anuncio', label: 'Anúncio pago' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'arquiteto', label: 'Arquiteto / Parceiro' },
  { value: 'showroom', label: 'Showroom / Loja' },
  { value: 'cliente_antigo', label: 'Cliente antigo (recompra)' },
  { value: 'manual', label: 'Cadastro manual' },
  { value: 'outro', label: 'Outro' },
];

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return '—';
  return LEAD_SOURCES.find((s) => s.value === source)?.label ?? source;
}

export const LOST_REASONS = [
  'Preço acima do esperado',
  'Fechou com concorrente',
  'Desistiu do projeto',
  'Prazo não atende',
  'Sem retorno do cliente',
  'Outro',
];

/**
 * Normaliza telefone brasileiro para apenas dígitos, sem DDI 55.
 * Retorna null quando não há dígitos suficientes (mínimo DDD + 8 dígitos).
 */
export function normalizeBrPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = String(raw).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1); // 0 + DDD + 8 dígitos
  if (d.length < 10 || d.length > 11) return null;
  return d;
}

/** Formata telefone normalizado como (11) 99999-0000. */
export function formatBrPhone(raw: string | null | undefined): string {
  const d = normalizeBrPhone(raw);
  if (!d) return raw ?? '';
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  return rest.length === 9
    ? `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`
    : `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

/** Dois telefones são o mesmo contato? (compara versão normalizada) */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeBrPhone(a);
  const nb = normalizeBrPhone(b);
  return !!na && na === nb;
}

/** Link do WhatsApp com DDI 55. */
export function whatsappLink(raw: string | null | undefined): string | null {
  const d = normalizeBrPhone(raw);
  return d ? `https://wa.me/55${d}` : null;
}

export interface ClientLike { id: string; name: string; phone: string | null; email: string | null }

/**
 * Procura um cliente existente que corresponda ao lead (telefone, depois e-mail).
 * Nunca compara só pelo nome, para evitar juntar pessoas diferentes.
 */
export function findMatchingClient<T extends ClientLike>(
  clients: T[],
  lead: { phone: string | null; email: string | null },
): T | null {
  const byPhone = clients.find((c) => samePhone(c.phone, lead.phone));
  if (byPhone) return byPhone;
  const email = lead.email?.trim().toLowerCase();
  if (email) {
    const byEmail = clients.find((c) => c.email?.trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  return null;
}
