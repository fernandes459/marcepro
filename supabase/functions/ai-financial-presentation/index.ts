// Gera os textos de uma apresentação financeira a partir dos números do relatório.
import { corsHeaders as cors } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';

const item = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'text'],
  properties: { title: { type: 'string' }, text: { type: 'string' } },
};
const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'summary', 'score', 'health_label', 'highlights', 'risks', 'actions', 'closing'],
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    score: { type: 'number' },
    health_label: { type: 'string' },
    highlights: { type: 'array', items: item },
    risks: { type: 'array', items: item },
    actions: { type: 'array', items: item },
    closing: { type: 'string' },
  },
};

const SYSTEM = `Você é um consultor financeiro sênior de marcenarias de alto padrão no Brasil. Recebe o relatório financeiro (valores em BRL) de um período e escreve os textos de uma apresentação executiva para os sócios.
Regras: use SOMENTE os números fornecidos, nunca invente valores. Frases curtas e diretas (máx. 25 palavras por texto). Em português do Brasil.
- headline: título de até 8 palavras resumindo o período.
- summary: 1-2 frases.
- score: 0 a 100 (saúde financeira). health_label: Crítico, Atenção, Saudável ou Excelente.
- highlights: 3 pontos positivos ou fatos marcantes. risks: até 3 riscos. actions: 3 ações práticas para o próximo período.
- closing: 1 frase de fechamento.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ error: 'Faça login para usar a IA' }, 401);
    const client = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authorization } },
    });
    const { data: auth, error: authError } = await client.auth.getUser(authorization.slice(7));
    if (authError || !auth.user) return json({ error: 'Sessão inválida' }, 401);
    const { data: roles, error: rolesError } = await client.from('user_roles').select('role').eq('user_id', auth.user.id);
    if (rolesError || !roles?.some(row => ['admin', 'gerente', 'financeiro', 'partner'].includes(row.role))) return json({ error: 'Sem permissão para relatórios financeiros' }, 403);
    let body: unknown;
    try { body = await req.json(); } catch { return json({ error: 'Dados inválidos' }, 400); }
    const parsed = z.object({ company: z.string().max(255).optional(), report: z.record(z.unknown()) })
      .refine(value => JSON.stringify(value).length <= 100000, 'Relatório muito grande').safeParse(body);
    if (!parsed.success) return json({ error: 'Relatório inválido' }, 400);
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return json({ error: 'IA não configurada.' }, 500);
    const { report, company } = parsed.data;
    if (!report) return json({ error: 'Relatório ausente.' }, 400);

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Lovable-API-Key': apiKey,
        'X-Lovable-AIG-SDK': 'fetch',
        'Content-Type': 'application/json',
      },
      signal: req.signal,
      body: JSON.stringify({
        model: 'openai/gpt-6-astra',
        stream: true,
        store: false,
        reasoning: { effort: 'low' },
        instructions: SYSTEM,
        input: [{ role: 'user', content: `Empresa: ${company || 'Marcenaria'}\nRelatório:\n${JSON.stringify(report)}` }],
        text: { format: { type: 'json_schema', name: 'presentation', strict: true, schema } },
      }),
    });

    if (!resp.ok || !resp.body) {
      const t = await resp.text().catch(() => '');
      let msg = 'Falha ao gerar a apresentação.';
      try { msg = JSON.parse(t)?.error?.message || JSON.parse(t)?.message || msg; } catch { /* */ }
      if (resp.status === 402) msg = 'Créditos de IA esgotados. Adicione créditos para gerar a apresentação.';
      if (resp.status === 429) msg = 'Muitas solicitações à IA. Aguarde um minuto e tente de novo.';
      return json({ error: msg }, resp.status);
    }

    // Lê o stream SSE e junta o texto.
    const reader = resp.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let text = '';
    let failed: string | null = null;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const ev = JSON.parse(data);
          if (ev.type === 'response.output_text.delta') text += ev.delta ?? '';
          else if (ev.type === 'response.failed' || ev.type === 'error') failed = ev.response?.error?.message || ev.message || 'Falha da IA.';
        } catch { /* ignora */ }
      }
    }
    if (failed) return json({ error: failed }, 502);
    if (!text.trim()) return json({ error: 'A IA não retornou conteúdo.' }, 502);
    return json({ presentation: JSON.parse(text) });
  } catch (e) {
    if ((e as Error).name === 'AbortError') return json({ error: 'Cancelado' }, 499);
    console.error(e);
    return json({ error: (e as Error).message || 'Erro inesperado' }, 500);
  }
});
