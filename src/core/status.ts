/**
 * STATUS CANÔNICOS — fonte única de verdade.
 * Banco ainda usa rótulos legados em inglês (`draft|pending|approved|in_production|rejected`).
 * Esta camada normaliza para o vocabulário do produto.
 */

export const PROJECT_STATUS = {
  RASCUNHO: 'rascunho',
  ENVIADO: 'enviado',
  NEGOCIACAO: 'negociacao',
  APROVADO: 'aprovado',
  PRODUCAO: 'producao',
  INSTALACAO: 'instalacao',
  FINALIZADO: 'finalizado',
  RECUSADO: 'recusado',
} as const;

export type ProjectStatus = (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];

// Mapa de migração legados (DB) -> canônico
const LEGACY_TO_CANON: Record<string, ProjectStatus> = {
  draft: PROJECT_STATUS.RASCUNHO,
  pending: PROJECT_STATUS.ENVIADO,
  negociacao: PROJECT_STATUS.NEGOCIACAO,
  approved: PROJECT_STATUS.APROVADO,
  in_production: PROJECT_STATUS.PRODUCAO,
  installation: PROJECT_STATUS.INSTALACAO,
  delivered: PROJECT_STATUS.FINALIZADO,
  finalizado: PROJECT_STATUS.FINALIZADO,
  rejected: PROJECT_STATUS.RECUSADO,
};

export function toCanonicalStatus(raw?: string | null): ProjectStatus {
  if (!raw) return PROJECT_STATUS.RASCUNHO;
  return LEGACY_TO_CANON[raw] ?? (raw as ProjectStatus);
}

const OPEN: ProjectStatus[] = [PROJECT_STATUS.ENVIADO, PROJECT_STATUS.NEGOCIACAO];
const CLOSED: ProjectStatus[] = [
  PROJECT_STATUS.APROVADO,
  PROJECT_STATUS.PRODUCAO,
  PROJECT_STATUS.INSTALACAO,
  PROJECT_STATUS.FINALIZADO,
];
const REFUSED: ProjectStatus[] = [PROJECT_STATUS.RECUSADO];

export const isDraft = (s?: string | null) => toCanonicalStatus(s) === PROJECT_STATUS.RASCUNHO;
export const isOpen = (s?: string | null) => OPEN.includes(toCanonicalStatus(s));
export const isClosed = (s?: string | null) => CLOSED.includes(toCanonicalStatus(s));
export const isRefused = (s?: string | null) => REFUSED.includes(toCanonicalStatus(s));
export const isInProductionPhase = (s?: string | null) => {
  const c = toCanonicalStatus(s);
  return c === PROJECT_STATUS.PRODUCAO || c === PROJECT_STATUS.INSTALACAO;
};

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  negociacao: 'Negociação',
  aprovado: 'Aprovado',
  producao: 'Em Produção',
  instalacao: 'Instalação',
  finalizado: 'Finalizado',
  recusado: 'Recusado',
};

export const STATUS_TONE: Record<ProjectStatus, string> = {
  rascunho: 'bg-muted text-muted-foreground',
  enviado: 'bg-warning/10 text-warning',
  negociacao: 'bg-warning/10 text-warning',
  aprovado: 'bg-success/10 text-success',
  producao: 'bg-info/10 text-info',
  instalacao: 'bg-info/10 text-info',
  finalizado: 'bg-success/10 text-success',
  recusado: 'bg-destructive/10 text-destructive',
};
