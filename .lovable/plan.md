# Reestruturação Total — ERP Marcenaria Premium

Escopo grande. Vou executar em **6 ondas sequenciais**, cada onda entregando algo funcional e testável. Confirme e eu começo pela Onda 1.

---

## Onda 1 — Fundação: Status canônicos + FinancialEngine

**Objetivo:** acabar com a divergência de números criando uma única fonte de verdade.

- Criar `src/core/status.ts` com enum `PROJECT_STATUS` (rascunho, enviado, negociacao, aprovado, producao, instalacao, finalizado, recusado) e helpers `isClosed()`, `isOpen()`, `isRefused()`.
- Migração SQL: normalizar `budgets.status` (mapear `pending`→`enviado`, `approved`→`aprovado`, `in_production`→`producao`, `rejected`→`recusado`), adicionar `delivered_at`, `lost_reason`.
- Criar `src/engines/FinancialEngine.ts` — única fonte para: faturamento bruto (orçamentos fechados por `approved_at`), faturamento recebido (transactions paid), a receber, a pagar, saldo real, margem, lucro.
- Criar `src/engines/MetricsEngine.ts` — funil comercial (abertos, fechados, recusados, conversão, ticket médio, tempo médio fechamento).
- Refatorar `BudgetsPage`, `DashboardPage`, `FinancePage` para consumir SOMENTE as engines. Proibido cálculo em UI.

## Onda 2 — Recebíveis profissionais (pagamento parcial)

- Migração: adicionar `valor_original`, `valor_recebido`, `saldo_aberto` em `financial_transactions` (receitas).
- Criar `src/engines/ReceivablesEngine.ts` com `registrarPagamento(tituloId, valor, forma, data)` — NUNCA cria novo lançamento, atualiza o título.
- Tabela `payment_history` (id, transaction_id, valor, data, forma_pagamento, user_id).
- Status automático: `aberto` → `parcial` → `pago` → `atrasado` (trigger por due_date).
- UI: dialog "Receber pagamento" no Financeiro com input de valor parcial + histórico.

## Onda 3 — Engenharia comercial (m² + regional + custos reais)

- Tabelas: `m2_pricing_table` (tipo_material, valor_m2) e usar `region_pricing` existente como multiplicador.
- Em `BudgetWizardDialog`: nova aba "Cálculo por m²" com inputs `metragem`, `tipoMaterial`, `regiao` → calcula `valorBase = m² × tabela[tipo] × multiplicador[regiao]`.
- `CostEngine` em `src/engines/CostEngine.ts`: soma MDF + ferragens + fita + vidro + mão de obra + montagem + frete + impostos + comissão + op-costs.
- Margem real, alertas: <15% crítico, <25% alerta, >35% saudável (badge colorido no orçamento).

## Onda 4 — Dashboards executivos (4 painéis)

Refatorar `DashboardPage` em abas:
- **Comercial**: valor vendido, ticket médio, conversão, ranking vendedores, funil visual, tempo médio fechamento.
- **Financeiro**: caixa atual, faturado recebido, pendente, inadimplência, contas futuras, fluxo projetado 90 dias, lucro previsto vs realizado.
- **Operacional**: produção em andamento, instalações, atrasos, entregas no mês.
- **Estratégico**: margem média, ROI, crescimento MoM/YoY, previsão financeira.

Todos consumindo `FinancialEngine` + `MetricsEngine`.

## Onda 5 — Cliente 360° + Timeline

- Em `ClientsPage`, view de detalhe com KPIs (totalComprado, saldoAberto, qtdProjetos, ticketMedio).
- Timeline cruzando: orçamentos, aprovações, pagamentos, marcos de produção, instalação, assistências, anotações.
- Tabela `client_notes` para observações livres + upload de documentos/fotos (storage bucket `client-docs`).

## Onda 6 — Relatórios avançados + Polimento premium

- Página `/relatorios`: DRE simplificado, lucratividade por projeto/cliente/vendedor, inadimplência, curva ABC, previsão de caixa.
- Exportação PDF/CSV.
- Refino visual dark premium (Graphite + Gold já no DS), gráficos Recharts polidos, micro-animações framer-motion.

---

## Detalhes técnicos (resumo)

```text
src/
├── core/
│   ├── status.ts          ← enum único PROJECT_STATUS + helpers
│   └── constants.ts
├── engines/
│   ├── FinancialEngine.ts ← receita/despesa/saldo/margem
│   ├── MetricsEngine.ts   ← funil, conversão, ticket
│   ├── ReceivablesEngine.ts ← pagamento parcial sem duplicar
│   └── CostEngine.ts      ← custo real composto
└── services/              ← já existem, vão usar engines
```

Regras invioláveis:
1. UI nunca calcula — só consome engines.
2. Pagamento parcial atualiza, nunca duplica.
3. Status `producao/instalacao/finalizado` contam como FECHADO no funil/faturamento.
4. Faturamento usa `approved_at` (mês da aprovação), não `created_at`.
5. Todo módulo financeiro nasce do orçamento aprovado (auto-geração de recebíveis).

---

## Pergunta antes de começar

Cada onda dura ~1 mensagem grande de trabalho (migrations + 5-15 arquivos). **Confirma que toco onda por onda nessa ordem?** Se sim, começo agora pela Onda 1 (fundação — sem ela as outras não fecham).

Se quiser inverter prioridade (ex: começar pelos recebíveis parciais, ou pelos dashboards), me diga.
