// Edge function: AI pricing suggestion using Lovable AI Gateway.
// Returns three price tiers (minimum, ideal, premium) plus a short rationale.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Payload {
  totalCost: number;
  defaultMargin: number;
  minMargin: number;
  projectName?: string;
  finishType?: string;
  complexity?: string;
  rooms?: string[];
  history?: { final_price: number; total_cost: number; status: string }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Payload;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const historyLine = (body.history || [])
      .slice(0, 10)
      .map(
        (h) =>
          `- final R$${h.final_price.toFixed(2)} sobre custo R$${h.total_cost.toFixed(2)} (${h.status})`,
      )
      .join("\n");

    const sys = `Você é um especialista em precificação de marcenaria sob medida no Brasil. Sugira 3 faixas de preço (mínimo seguro, ideal e premium) que cubram o custo, atinjam pelo menos a margem mínima e estejam alinhadas com o histórico do cliente. Responda SEMPRE chamando a função suggest_pricing.`;

    const usr = `Custo total do projeto: R$ ${body.totalCost.toFixed(2)}
Margem padrão configurada: ${body.defaultMargin}%
Margem mínima exigida: ${body.minMargin}%
Projeto: ${body.projectName ?? "—"}
Acabamento: ${body.finishType ?? "—"}
Complexidade: ${body.complexity ?? "—"}
Ambientes: ${(body.rooms || []).join(", ") || "—"}
Histórico recente da loja:
${historyLine || "(sem histórico)"}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: usr },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_pricing",
              description: "Retorna 3 faixas de preço final ao cliente.",
              parameters: {
                type: "object",
                properties: {
                  minimum: { type: "number", description: "Preço mínimo seguro (margem mínima)" },
                  ideal: { type: "number", description: "Preço ideal recomendado" },
                  premium: { type: "number", description: "Preço premium / valor cheio" },
                  rationale: { type: "string", description: "1-2 frases curtas em português explicando" },
                },
                required: ["minimum", "ideal", "premium", "rationale"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_pricing" } },
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em instantes." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos da IA esgotados. Adicione saldo em Configurações > Workspace." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const txt = await resp.text();
      console.error("AI gateway error", resp.status, txt);
      return new Response(JSON.stringify({ error: "Falha na IA, tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("Resposta vazia");
    const args = JSON.parse(call.function.arguments);

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("suggest-pricing error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
