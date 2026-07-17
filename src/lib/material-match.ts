// Helpers para casar nomes de materiais tolerando acentos, caixa,
// pontuação e pequenas variações de digitação.

export function normalizeMaterialName(raw: string): string {
  return (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')    // remove pontuação
    .replace(/\s+/g, ' ')            // colapsa espaços
    .trim();
}

// Levenshtein clássico
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  const na = normalizeMaterialName(a);
  const nb = normalizeMaterialName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  return 1 - levenshtein(na, nb) / maxLen;
}

export interface CatalogLike {
  id: string;
  name: string;
  unit_cost: number;
  unit?: string | null;
  supplier?: string | null;
}

// Retorna o melhor match acima do threshold ou null.
export function findBestMatch<T extends CatalogLike>(
  name: string,
  catalog: T[],
  threshold = 0.82,
): { item: T; score: number } | null {
  const target = normalizeMaterialName(name);
  if (!target) return null;
  // Match exato normalizado tem prioridade absoluta.
  const exact = catalog.find(c => normalizeMaterialName(c.name) === target);
  if (exact) return { item: exact, score: 1 };
  let best: { item: T; score: number } | null = null;
  for (const c of catalog) {
    const s = similarity(name, c.name);
    if (s >= threshold && (!best || s > best.score)) best = { item: c, score: s };
  }
  return best;
}
