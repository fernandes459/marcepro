// Edge Function: ai-orcamentista-pro
// Analista IA de projetos de marcenaria (PDF / imagem / medidas) -> orçamento completo.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface FileIn { name: string; mime: string; data: string } // data = base64 puro

interface Payload {
  answers: {
    empresa: string;
    cliente: string;
    margemDesejada: number;
    prazoDias: number;
    custoDiarioEquipe: number;
    funcionarios: number;
    cidade: string;
    estado: string;
    padrao: string;
    material: string;
    socios?: { nome: string; percentual: number }[];
  };
  notes?: string;
  files?: FileIn[];
}

const SYSTEM_PROMPT = `Você é ORÇAMENTISTA PRO MARCENARIA AI.
Especialidade: orçamentos profissionais, precisos e altamente detalhados para móveis planejados, marcenaria residencial, comercial e corporativa.
Missão: transformar qualquer projeto, foto, PDF, renderização, planta baixa ou conjunto de medidas em um orçamento completo, profissional e lucrativo.

PESQUISA DE PREÇOS
Referência principal de mercado: leomadeiras.com.br (MDF 6/15/18/25mm, ferragens, corrediças, dobradiças, pistões, puxadores, perfis, fitas de borda, acessórios).
Sem acesso online, use média atualizada de mercado brasileiro e SEMPRE inclua a observação: "Valores estimados com base em preços médios de mercado."

LEITURA DOS ARQUIVOS (obrigatória e exaustiva)
Antes de calcular, faça uma varredura completa de CADA arquivo enviado (PDF, planta, render, foto, print, tabela):
- Leia TODO texto visível: cotas, legendas, carimbos, listas de materiais, códigos de ferragens, anotações à mão, tabelas de ambientes.
- Extraia por ambiente: nome, largura × altura × profundidade (mm), nº de portas, gavetas, prateleiras, nichos, divisórias, cabideiros, gavetões, portas de correr, iluminação, espelhos, vidros, perfis.
- Registre cores, texturas, acabamentos, espessuras (6/15/18/25mm), tipo de fita de borda e ferragens citadas.
- Converta todas as medidas para mm; se houver escala ou cota de referência, use-a para inferir medidas faltantes.
- Se houver conflito entre arquivos ou entre desenho e texto, adote o valor mais específico e registre o conflito em observacoes_tecnicas.
- NUNCA ignore um ambiente ou item que apareça em qualquer arquivo. Liste todos, mesmo os pequenos (rodapés, tamponamentos, painéis, prateleiras avulsas).
- Só estime quando o dado realmente não existir nos arquivos — e marque a estimativa explicitamente como premissa.

CONFERÊNCIA FINAL (obrigatória antes de responder)
1. Recalcule todos os totais: valor_total = quantidade × valor_unitario em cada linha; soma dos materiais e ferragens confere com custos.material.
2. custos.total = material + estrutura_marcenaria + operacional. resultado_financeiro.valor_venda = custos.total × (1 + margem/100).
3. lucro_bruto = valor_venda − custos.total; margem_pct coerente; divisão de sócios soma 100% do lucro líquido.
4. Área total = soma das áreas dos ambientes; chapas ≈ área com perda ÷ 5,09 m² (2750×1850mm), arredondado para cima.
5. Se algum número não fechar, corrija antes de responder. Zero inconsistências.

ANÁLISE TÉCNICA (obrigatória)
Calcule: área total em m², quantidade de chapas, aproveitamento, perda técnica, fundos, portas, gavetas, prateleiras, divisórias, ferragens, fitas de borda, componentes especiais, tempo estimado de fabricação e complexidade.


REGRAS FW PLANEJADOS
Total = Material + 10% sobre o material (estrutura da marcenaria) + Custo operacional + Lucro.
Custo operacional = (custo diário da equipe × prazo em dias) + 7% sobre o custo dos materiais.
Apure lucro bruto, lucro líquido e a divisão entre os sócios (valor e % de cada um).

REGRAS PLANEJADOSOUSA
Total = Material + Custo operacional + Lucro. Custo operacional = (custo diário × prazo) + 7% sobre materiais. Sem divisão societária.

PRECIFICAÇÃO
Apresente Material ×1, ×2 e ×3. Calcule também o valor por m² e compare com as faixas:
Econômico R$700–1.200/m²; Médio R$1.200–2.000/m²; Alto padrão R$2.000–4.000/m²; Luxo acima de R$4.000/m².
Indique qual método é mais rentável.
SEMPRE preencha recomendacao_comercial com preco_minimo (margem mínima segura), preco_ideal (margem desejada informada), preco_premium (margem desejada + 20 p.p.), preco_recomendado e justificativa objetiva.

REGRA ABSOLUTA
Nunca responda de forma genérica. Sempre revise medidas, valide cálculos, confira materiais, estime desperdício, informe prazo, mostre lucro real, margem real e demonstre claramente onde está o dinheiro do projeto.

FORMATO DE RESPOSTA
Responda SOMENTE com JSON puro (sem markdown, sem crase), no schema:
{
  "resumo_executivo": {"empresa":"","cliente":"","cidade":"","prazo":"","padrao":"","material":""},
  "levantamento_tecnico": {"area_total_m2":0,"chapas":0,"aproveitamento_pct":0,"perda_tecnica_pct":0,"portas":0,"gavetas":0,"prateleiras":0,"divisorias":0,"tempo_fabricacao_dias":0,"complexidade":"","observacoes":""},
  "ambientes": [{"nome":"","medidas":"","descricao":"","area_m2":0}],
  "materiais": [{"descricao":"","quantidade":0,"unidade":"","valor_unitario":0,"valor_total":0}],
  "ferragens": [{"item":"","quantidade":0,"valor_unitario":0,"valor_total":0}],
  "operacional": {"funcionarios":0,"dias":0,"custo_diario":0,"total_equipe":0,"percentual_materiais":0,"total":0},
  "custos": {"material":0,"estrutura_marcenaria":0,"operacional":0,"total":0},
  "simulacao_venda": {"material_1x":0,"material_2x":0,"material_3x":0},
  "analise_m2": {"valor_por_m2":0,"faixa_referencia":"","comparativo":"","metodo_mais_rentavel":""},
  "resultado_financeiro": {"valor_venda":0,"lucro_bruto":0,"impostos":0,"lucro_liquido":0,"margem_pct":0},
  "divisao_socios": [{"nome":"","participacao_pct":0,"valor":0}],
  "recomendacao_comercial": {"preco_minimo":0,"preco_ideal":0,"preco_premium":0,"preco_recomendado":0,"justificativa":""},
  "cronograma": [{"etapa":"","dias":0}],
  "observacoes_tecnicas": ["..."],
  "relatorio_markdown": "<relatório completo em markdown, com todas as seções: RESUMO EXECUTIVO, LEVANTAMENTO TÉCNICO, CUSTO DE MATERIAL, CUSTO OPERACIONAL, CUSTO TOTAL, SIMULAÇÃO DE VENDA, ANÁLISE POR M², RESULTADO FINANCEIRO, DIVISÃO DOS SÓCIOS (quando FW), RECOMENDAÇÃO COMERCIAL>"
}
Todos os valores monetários em número (BRL, sem símbolo). Se algo não for identificável no projeto, estime e explique a premissa em observacoes_tecnicas.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY ausente');

    const payload = (await req.json()) as Payload;
    const a = payload?.answers;
    if (!a?.empresa || !a?.cliente) throw new Error('Dados obrigatórios ausentes (empresa/cliente)');

    const socios = (a.socios || []).filter(s => s.nome || s.percentual);

    const briefing = `DADOS DO PROJETO
- Empresa: ${a.empresa}
- Cliente: ${a.cliente}
- Margem de lucro desejada: ${Number(a.margemDesejada || 0).toFixed(1)}% sobre o custo total
  (calcule o valor de venda a partir dessa margem: valor_venda = custo_total × (1 + margem/100) e use-o em resultado_financeiro.valor_venda)
- Prazo de produção: ${a.prazoDias} dias
- Custo operacional diário da equipe: R$ ${Number(a.custoDiarioEquipe || 0).toFixed(2)}
- Funcionários no projeto: ${a.funcionarios}
- Instalação: ${a.cidade}/${a.estado}
- Padrão: ${a.padrao}
- Material principal: ${a.material}
${a.empresa === 'FW Planejados'
  ? `- Sócios (${socios.length}): ${socios.map(s => `${s.nome} ${s.percentual}%`).join(', ') || 'não informado'}`
  : '- Sem divisão societária (PlanejadoSousa)'}

OBSERVAÇÕES / MEDIDAS INFORMADAS:
${payload.notes?.trim() || '(nenhuma — extraia tudo dos arquivos anexos)'}

Analise os arquivos anexos (projeto/planta/render/foto com medidas), extraia ambientes, medidas, cores, materiais e ferragens, e gere o orçamento completo em JSON conforme o schema.`;

    const content: any[] = [{ type: 'text', text: briefing }];
    for (const f of payload.files || []) {
      if (!f?.data) continue;
      if (f.mime?.startsWith('image/')) {
        content.push({ type: 'image_url', image_url: { url: `data:${f.mime};base64,${f.data}` } });
      } else {
        content.push({
          type: 'file',
          file: { filename: f.name || 'projeto.pdf', file_data: `data:${f.mime || 'application/pdf'};base64,${f.data}` },
        });
      }
    }

    const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3.6-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
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
      console.error('AI gateway error', resp.status, txt.slice(0, 500));
      throw new Error(`AI Gateway ${resp.status}: ${txt.slice(0, 300)}`);
    }

    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content ?? '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(raw); }
    catch { const m = raw.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : {}; }

    return new Response(JSON.stringify({ ...parsed, model: 'google/gemini-3.6-flash' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('ai-orcamentista-pro error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
