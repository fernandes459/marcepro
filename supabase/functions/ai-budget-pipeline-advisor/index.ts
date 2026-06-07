// Edge Function: ai-budget-pipeline-advisor
// Diagnóstico IA para orçamentos em aberto (rascunho + pendente)
// Cruza origem (source), região, ticket médio, idade e dá próximos passos.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface OpenBudget {
  code: string;
  project_name?: string | null;
  client_name?: string | null;
  client_city?: string | null;
  client_state?: string | null;
  final_price: number;
  status: string;
  source?: string | null;
  days_open: number;
  seller?: string | null;
}

interface Payload {
  period_label?: string;
  open_budgets: OpenBudget[];
  by_source: Array<{ source: string; count: number; total: number; conversion?: number }>;
  by_region: Array<{ region: string; count: number; total: number; avg_ticket: number }>;
  totals: {
    open_count: number;
    open_value: number;
    avg_ticket: number;
    avg_age_days: number;
    closed_count?: number;
    closed_value?: number;
    conversion_overall?: number;
  };
  refused_reasons?: Array<{ reason: string; count: number }>;
}

const SYSTEM_PROMPT = `Você é um consultor de vendas sênior especializado em marcenarias de alto padrão no Brasil. Analise o pipeline de orçamentos EM ABERTO e gere um diagnóstico estratégico para o gestor.

Princípios:
- Cite NÚMEROS reais do contexto (R$, %, dias, nomes de canais e cidades).
- Identifique gargalos por idade do orçamento (>15 dias é amarelo, >30 dias é vermelho).
- Cruze ORIGEM x CONVERSÃO x TICKET para sugerir onde investir mais.
- Cruze REGIÃO x TICKET para identificar praças mais lucrativas.
- Sugira ações imediatas (ligar, enviar amostra, revisar proposta, descontar) por cliente quando possível.

Responda SEMPRE em JSON puro (sem markdown), seguindo:
{
  "score": 0-100,
  "health_label": "Crítico|Atenção|Saudável|Excelente",
  "summary": "<1 frase executiva>",
  "diagnostico": "<2-3 frases cruzando dados>",
  "top_canais": [{"canal":"...","insight":"..."}],
  "top_regioes": [{"regiao":"...","insight":"..."}],
  "acoes_urgentes": [{"titulo":"...","cliente":"...","acao":"...","prioridade":"alta|media|baixa"}],
  "alertas": [{"titulo":"...","detalhe":"..."}]
}
Limites: 3 canais, 3 regiões, 5 acoes_urgentes, 3 alertas.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY ausente');

    const payload = (await req.json()) as Payload;
    if (!payload?.open_budgets) throw new Error('open_budgets ausente');

    const topOpen = (payload.open_budgets || [])
      .slice()
      .sort((a, b) => b.days_open - a.days_open)
      .slice(0, 20);

    const userPrompt = `Período: ${payload.period_label || 'atual'}

PIPELINE TOTAL EM ABERTO
- Quantidade: ${payload.totals.open_count}
- Valor: R$ ${payload.totals.open_value.toFixed(2)}
- Ticket médio: R$ ${payload.totals.avg_ticket.toFixed(2)}
- Idade média: ${payload.totals.avg_age_days.toFixed(1)} dias
- Fechados no período: ${payload.totals.closed_count ?? 0} (R$ ${(payload.totals.closed_value ?? 0).toFixed(2)})
- Conversão geral: ${(payload.totals.conversion_overall ?? 0).toFixed(1)}%

POR ORIGEM (CANAL):
${payload.by_source.map(s => `- ${s.source}: ${s.count} aberto(s), R$ ${s.total.toFixed(0)}${s.conversion !== undefined ? `, conversão ${s.conversion.toFixed(0)}%` : ''}`).join('\n') || '- (sem dados)'}

POR REGIÃO:
${payload.by_region.map(r => `- ${r.region}: ${r.count} proj, R$ ${r.total.toFixed(0)}, ticket médio R$ ${r.avg_ticket.toFixed(0)}`).join('\n') || '- (sem dados)'}

ORÇAMENTOS EM ABERTO (top ${topOpen.length} por idade):
${topOpen.map(b => `- ${b.code} | ${b.client_name ?? '—'} (${b.client_city ?? '—'}/${b.client_state ?? ''}) | R$ ${b.final_price.toFixed(0)} | ${b.days_open}d aberto | canal: ${b.source ?? 'n/d'} | vendedor: ${b.seller ?? 'n/d'} | status: ${b.status}`).join('\n')}

MOTIVOS DE RECUSA RECENTES:
${(payload.refused_reasons || []).map(r => `- ${r.reason}: ${r.count}x`).join('\n') || '- (n/d)'}

Gere o diagnóstico estratégico em JSON.`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: 'Limite de uso da IA atingido. Tente novamente em alguns minutos.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: 'Créditos da IA esgotados. Adicione créditos para continuar.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`AI Gateway ${resp.status}: ${txt.slice(0, 200)}`);
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(raw); }
    catch { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {}; }

    return new Response(JSON.stringify({
      score: Number.isFinite(parsed.score) ? Math.max(0, Math.min(100, parsed.score)) : 50,
      health_label: parsed.health_label ?? 'Atenção',
      summary: parsed.summary ?? '',
      diagnostico: parsed.diagnostico ?? '',
      top_canais: Array.isArray(parsed.top_canais) ? parsed.top_canais.slice(0, 3) : [],
      top_regioes: Array.isArray(parsed.top_regioes) ? parsed.top_regioes.slice(0, 3) : [],
      acoes_urgentes: Array.isArray(parsed.acoes_urgentes) ? parsed.acoes_urgentes.slice(0, 5) : [],
      alertas: Array.isArray(parsed.alertas) ? parsed.alertas.slice(0, 3) : [],
      model: 'google/gemini-2.5-flash',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('ai-budget-pipeline-advisor error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
