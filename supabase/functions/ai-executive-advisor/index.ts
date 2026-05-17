// Supabase Edge Function: ai-executive-advisor
// Recebe métricas financeiras e devolve análise executiva via Lovable AI Gateway.
// CORS habilitado, sem JWT (público p/ simplicidade — não persiste dados aqui).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Metrics {
  period_label?: string;
  revenue?: number;
  fixed_expenses?: number;
  variable_expenses?: number;
  total_expenses?: number;
  profit?: number;
  margin_percent?: number;
  cash_balance?: number;
  overdue_receivables?: number;
  overdue_count?: number;
  active_projects?: number;
  delivered_projects?: number;
  pending_assistance?: number;
  break_even?: number;
  monthly_goal?: number;
  top_clients?: Array<{ name: string; revenue: number }>;
  top_expense_categories?: Array<{ category: string; amount: number }>;
  company_name?: string;
}

const SYSTEM_PROMPT = `Você é um consultor empresarial sênior especializado em gestão de marcenarias e fábricas de móveis sob medida no Brasil. Analise as métricas fornecidas e gere uma avaliação executiva DIRETA, ESTRATÉGICA e ACIONÁVEL — nunca genérica.

Considere o contexto setorial:
- Margem saudável em marcenaria premium: 35-50%
- Ciclo médio de projeto: 30-60 dias
- Inadimplência aceitável: < 5% do faturamento
- Estoque parado é o maior inimigo do caixa
- Capacidade ociosa reduz margem real

Responda SEMPRE em JSON puro (sem markdown, sem backticks) seguindo exatamente este schema:
{
  "score": <0-100>,
  "health_label": "<Crítico|Atenção|Saudável|Excelente>",
  "summary": "<1 frase executiva direta>",
  "insights": [{"title":"...","message":"...","severity":"danger|warning|info|success"}],
  "recommendations": [{"title":"...","action":"...","priority":"alta|média|baixa"}],
  "alerts": [{"title":"...","detail":"..."}]
}

Limite a 4 insights, 4 recommendations e 3 alerts. Seja específico citando NÚMEROS reais das métricas.`;

function calcScore(m: Metrics): number {
  let score = 50;
  const margin = m.margin_percent ?? 0;
  if (margin >= 40) score += 25;
  else if (margin >= 25) score += 15;
  else if (margin >= 10) score += 5;
  else if (margin < 0) score -= 20;

  const cash = m.cash_balance ?? 0;
  const monthExp = (m.fixed_expenses ?? 0) + (m.variable_expenses ?? 0);
  if (monthExp > 0) {
    const runway = cash / monthExp;
    if (runway >= 3) score += 15;
    else if (runway >= 1) score += 5;
    else if (runway < 0.5) score -= 15;
  }

  const overdue = m.overdue_receivables ?? 0;
  const revenue = m.revenue ?? 0;
  if (revenue > 0) {
    const inadRate = overdue / revenue;
    if (inadRate > 0.15) score -= 15;
    else if (inadRate > 0.05) score -= 5;
    else score += 5;
  }

  if ((m.pending_assistance ?? 0) > 3) score -= 5;
  if ((m.active_projects ?? 0) >= 3) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY ausente');

    const { metrics } = (await req.json()) as { metrics: Metrics };
    if (!metrics) throw new Error('metrics ausente');

    const fallbackScore = calcScore(metrics);

    const userPrompt = `Empresa: ${metrics.company_name ?? 'Marcenaria'}
Período: ${metrics.period_label ?? 'mês atual'}

MÉTRICAS:
- Faturamento (recebido): R$ ${(metrics.revenue ?? 0).toFixed(2)}
- Despesas fixas: R$ ${(metrics.fixed_expenses ?? 0).toFixed(2)}
- Despesas variáveis: R$ ${(metrics.variable_expenses ?? 0).toFixed(2)}
- Despesas totais: R$ ${(metrics.total_expenses ?? 0).toFixed(2)}
- Lucro líquido: R$ ${(metrics.profit ?? 0).toFixed(2)}
- Margem: ${(metrics.margin_percent ?? 0).toFixed(1)}%
- Saldo em caixa: R$ ${(metrics.cash_balance ?? 0).toFixed(2)}
- A receber vencido: R$ ${(metrics.overdue_receivables ?? 0).toFixed(2)} (${metrics.overdue_count ?? 0} contas)
- Projetos ativos: ${metrics.active_projects ?? 0}
- Projetos entregues no período: ${metrics.delivered_projects ?? 0}
- Assistências pendentes: ${metrics.pending_assistance ?? 0}
- Ponto de equilíbrio mensal: R$ ${(metrics.break_even ?? 0).toFixed(2)}
- Meta de faturamento: R$ ${(metrics.monthly_goal ?? 0).toFixed(2)}

TOP CLIENTES: ${(metrics.top_clients ?? []).slice(0, 3).map((c) => `${c.name} (R$ ${c.revenue.toFixed(0)})`).join(' | ') || 'n/d'}
TOP CATEGORIAS DESPESA: ${(metrics.top_expense_categories ?? []).slice(0, 3).map((c) => `${c.category} (R$ ${c.amount.toFixed(0)})`).join(' | ') || 'n/d'}

Score sugerido pelo cálculo local: ${fallbackScore}/100. Refine baseado no contexto setorial.`;

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
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
      return new Response(
        JSON.stringify({ error: 'Limite de uso da IA atingido. Tente novamente em alguns minutos.', fallback_score: fallbackScore }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (resp.status === 402) {
      return new Response(
        JSON.stringify({ error: 'Créditos da IA esgotados. Adicione créditos para continuar.', fallback_score: fallbackScore }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`AI Gateway ${resp.status}: ${txt.slice(0, 200)}`);
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : {};
    }

    const result = {
      score: Number.isFinite(parsed.score) ? Math.max(0, Math.min(100, parsed.score)) : fallbackScore,
      health_label: parsed.health_label ?? (fallbackScore >= 75 ? 'Saudável' : fallbackScore >= 50 ? 'Atenção' : 'Crítico'),
      summary: parsed.summary ?? '',
      insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 4) : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 4) : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts.slice(0, 3) : [],
      model: 'google/gemini-2.5-flash',
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('ai-executive-advisor error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
