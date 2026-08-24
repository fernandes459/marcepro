import Decimal from 'decimal.js';

/**
 * Composição de custos canônica do Orçamentista IA.
 *
 * Regras:
 *  - Custo direto  = material + ferragens + estrutura (10% s/ material, só FW)
 *                    + mão de obra (custo diário × dias) + overhead (7% s/ material) + frete/instalação
 *  - Custos variáveis (comissão do vendedor, comissão do montador/instalador e impostos)
 *    incidem sobre o VALOR DE VENDA — por isso o preço é calculado por markup dividido:
 *      venda = custo_direto × (1 + margem) / (1 − (comissão + montador + impostos))
 *    garantindo que a margem desejada sobre o custo seja preservada DEPOIS dos variáveis.
 *  - Custo total   = custo direto + variáveis
 *  - Lucro líquido = venda − custo total
 */

export interface CostInputs {
  material: number;
  ferragens: number;
  estruturaPct: number;      // 10 para FW Planejados, 0 caso contrário
  custoDiario: number;
  dias: number;
  overheadPct: number;       // 7 por padrão
  frete: number;
  comissaoPct: number;
  montadorPct: number;
  impostosPct: number;
  margemPct: number;
}

export interface CostBreakdown {
  material: number;
  ferragens: number;
  estrutura: number;
  maoObra: number;
  overhead: number;
  frete: number;
  custoDireto: number;
  comissao: number;
  montador: number;
  impostos: number;
  variaveis: number;
  custoTotal: number;
  venda: number;
  lucroLiquido: number;
  margemSobreCusto: number;  // %
  margemSobreVenda: number;  // %
}

const d = (v: any) => new Decimal(Number.isFinite(Number(v)) ? Number(v) : 0);

/** Preço de venda para uma margem-alvo (%) considerando os variáveis sobre a venda. */
export function vendaForMargin(custoDireto: number, margemPct: number, varPct: number): number {
  const denom = new Decimal(1).minus(d(varPct).div(100));
  const base = d(custoDireto).times(new Decimal(1).plus(d(margemPct).div(100)));
  if (denom.lte(0.1)) return base.toNumber();
  return base.div(denom).toNumber();
}

export function computeCosts(i: CostInputs): CostBreakdown {
  const material = d(i.material);
  const ferragens = d(i.ferragens);
  const baseMat = material.plus(ferragens);
  const estrutura = baseMat.times(d(i.estruturaPct).div(100));
  const maoObra = d(i.custoDiario).times(d(i.dias));
  const overhead = baseMat.times(d(i.overheadPct).div(100));
  const frete = d(i.frete);

  const custoDireto = baseMat.plus(estrutura).plus(maoObra).plus(overhead).plus(frete);
  const varPct = d(i.comissaoPct).plus(d(i.montadorPct)).plus(d(i.impostosPct));

  const venda = d(vendaForMargin(custoDireto.toNumber(), i.margemPct, varPct.toNumber()));
  const comissao = venda.times(d(i.comissaoPct).div(100));
  const montador = venda.times(d(i.montadorPct).div(100));
  const impostos = venda.times(d(i.impostosPct).div(100));
  const variaveis = comissao.plus(montador).plus(impostos);
  const custoTotal = custoDireto.plus(variaveis);
  const lucro = venda.minus(custoTotal);

  return {
    material: material.toNumber(),
    ferragens: ferragens.toNumber(),
    estrutura: estrutura.toNumber(),
    maoObra: maoObra.toNumber(),
    overhead: overhead.toNumber(),
    frete: frete.toNumber(),
    custoDireto: custoDireto.toNumber(),
    comissao: comissao.toNumber(),
    montador: montador.toNumber(),
    impostos: impostos.toNumber(),
    variaveis: variaveis.toNumber(),
    custoTotal: custoTotal.toNumber(),
    venda: venda.toNumber(),
    lucroLiquido: lucro.toNumber(),
    margemSobreCusto: custoTotal.gt(0) ? lucro.div(custoTotal).times(100).toNumber() : 0,
    margemSobreVenda: venda.gt(0) ? lucro.div(venda).times(100).toNumber() : 0,
  };
}
