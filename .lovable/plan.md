# Plano: Engenharia por Cor, Ambientes Isolados, Parcelamento e Correções Financeiras

Vou resolver 7 problemas reais que você levantou, em uma única entrega. Sem mudar o que já funciona.

---

## 1. Paleta 3D = Cor real do material (não decorativa)

**Hoje:** a paleta no 3D só muda visual, não impacta nada.

**Vai virar:** seletor de **chapa por componente** (Corpo, Frentes, Fundo) usando o catálogo real de chapas (Configurações → Engenharia). Cada módulo guarda qual chapa foi usada onde.

**Resumo final mostrará:**
```
Chapas necessárias por cor:
- MDF 15mm Branco TX:  3 chapas (8,4 m²)
- MDF 15mm Areia:      2 chapas (5,1 m²)
- MDF 15mm Preto:      1 chapa  (2,8 m²)
Total: 6 chapas
```

Cálculo continua via `engineering-calc.ts` (decimal.js, sobra 20%), mas agora **agrupado por chapa** em vez de uma chapa só pro orçamento todo.

---

## 2. Custo Operacional = Dias

**Hoje:** valor fixo R$.

**Vai virar:** campo "Dias de produção" + "Custo operacional / dia" (vem de Configurações). Sistema multiplica = custo operacional do orçamento. Mostra os 2 campos visíveis no breakdown.

---

## 3. Ambientes isolados — bug de persistência

**Hoje:** ao criar módulo via engenharia, ele cai num "balde global" e não fica preso ao ambiente selecionado.

**Vai virar:** cada ambiente terá seu próprio array `modules: []` no JSON `meta.environments`. Adicionar/remover módulo só afeta o ambiente ativo. Ao recarregar o orçamento, cada ambiente reaparece com seus módulos.

---

## 4. Editor de módulo igual CorteCloud

Pelas suas screenshots, vou reorganizar o `ModuleConfigurator` em 3 abas:

- **Geral:** Nome, Largura, Altura, Profundidade, Quantidade
- **Opções:** Nº portas, Nº gavetas, Nº prateleiras, Lado da abertura (Esq/Dir/Dupla), Tipo de puxador, Tipo de corrediça (comum/telescópica/soft), Tipo de dobradiça, Pés/sapatas (sim/não), Fundo (3mm/6mm/MDF), Folga das frentes (mm)
- **Materiais:** seletor de chapa por componente (Corpo / Frentes / Fundo / Gavetas) + fita de borda

Cada campo tem ícone visual à esquerda (igual CorteCloud) e atualiza o 3D em tempo real.

---

## 5. Aba "Pagamento" no orçamento (parcelamento real)

Nova aba **Pagamento** entre Margem e Resumo:

- Define **N parcelas** com: valor, data de vencimento, forma (Dinheiro/PIX/Boleto/Cartão/Transferência), conta de destino
- Botões rápidos: "Entrada 30% + 2x", "3x iguais", "Sinal + Saldo na entrega"
- Valida que soma das parcelas = valor total do orçamento
- Salva em `meta.payment_schedule`

**Ao aprovar o orçamento** (botão "Aprovar e Converter em Projeto"):
- Cria N transações `income` em `transactions` com status `pending`
- `due_date` = data da parcela
- `account_id` = conta escolhida
- `category` = "installment", `project_id` = projeto criado
- Aparecem na aba Financeiro como "A Receber"

---

## 6. Financeiro: histórico contínuo + saldo anterior

**Hoje:** o filtro de mês esconde valores em aberto antigos.

**Vai virar:**
- KPI "A Receber" e "A Pagar" sempre incluem **TODOS** os pendentes/vencidos, independente do filtro de período (não some quando troca o mês)
- Adicionar card "Saldo do mês anterior" mostrando o caixa que veio do mês passado
- Lista de transações ganha toggle "Mostrar pendentes anteriores" (default: ligado) que prepende todos os atrasados de meses anteriores no topo, destacados em vermelho

---

## 7. Bug: lançamento não subtrai da conta PJ

**Causa provável:** o saldo da conta é calculado a partir de `transactions.account_id`, mas o `TransactionDialog` ou não está salvando o `account_id`, ou o cálculo do saldo não está somando.

**Vou:**
1. Auditar `TransactionDialog.tsx` → garantir que `account_id` é gravado em todo INSERT
2. Auditar `FinancePage.tsx` → recálculo de saldo por conta usa: `saldo_inicial + Σ(income.paid where account_id=X) − Σ(expense.paid where account_id=X)` com decimal.js
3. Testar: criar despesa paga em conta PJ → saldo PJ deve cair imediatamente (realtime)

---

## Arquivos afetados

**Engenharia / Orçamento**
- `src/components/budget/BudgetWizardDialog.tsx` — aba Pagamento, persistência por ambiente, custo operacional em dias
- `src/components/budget/ModuleConfigurator.tsx` — reorganização em Geral/Opções/Materiais com ícones
- `src/components/budget/Module3DViewer.tsx` — paleta vira seletor de chapa por componente
- `src/lib/engineering-calc.ts` — agregação de chapas POR COR (novo `calcSheetsByColor`)
- `src/components/budget/PricingPanel.tsx` — breakdown mostra chapas por cor + dias operacionais

**Financeiro**
- `src/components/finance/PaymentMilestones.tsx` (ou novo `BudgetPaymentSchedule.tsx`) — UI de parcelas
- `src/pages/BudgetsPage.tsx` — ao aprovar, gera N transações pending
- `src/pages/FinancePage.tsx` — KPIs sempre globais, card saldo mês anterior, toggle pendentes antigos
- `src/components/finance/TransactionDialog.tsx` — garantir `account_id` salvo
- Recálculo de saldo por conta com decimal.js

**Sem migration de banco** — tudo cabe em colunas existentes + JSON `meta` do budget e `transactions` já tem `account_id`.

---

## Ordem de execução

1. Corrigir bug de saldo da conta (rápido, alto impacto)
2. Persistência por ambiente (corrige perda de dados)
3. Engenharia por cor + dias operacionais
4. Reorganizar ModuleConfigurator
5. Aba Pagamento + geração de transações
6. Financeiro: KPIs globais + saldo anterior

Posso começar?
