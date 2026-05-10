## Objetivo
Transformar o módulo Financeiro em uma central executiva da marcenaria (saldo real, previsões, alertas e críticas inteligentes) e criar a aba **Colaboradores** para registrar horas/dias trabalhados, integrada às despesas com nome do colaborador como subcategoria.

---

## 1. Financeiro voltado para empresa

### 1.1 Novos KPIs no topo (Home do Financeiro)
- **Saldo Real** = soma `current_balance` de todas as contas bancárias (caixa atual disponível).
- **Saldo Projetado (30 dias)** = Saldo Real + Receitas previstas (próximos 30 dias) − Despesas previstas (próximos 30 dias).
- **Receitas Previstas** = total `pending`/`overdue` do tipo `income` com `due_date` nos próximos 30 dias.
- **Despesas Previstas** = idem para `expense` (separa fixas vs. variáveis).
- **Receitas Realizadas (mês)** e **Despesas Realizadas (mês)** — já existentes, manter.
- **Burn Rate** = média mensal de despesas dos últimos 3 meses.
- **Runway** = Saldo Real ÷ Burn Rate (meses de "fôlego").

### 1.2 Painel de Sugestões e Críticas (novo card destacado)
Engine de regras que analisa as transações e gera alertas dinâmicos. Exemplos:
- Despesas fixas > 60% das receitas → "Custos fixos altos demais."
- Margem de lucro do mês < margem mínima (`company_settings.min_margin`) → "Lucro abaixo da meta."
- Mais de X contas vencidas → "Você tem N contas vencidas totalizando R$..."
- Categoria com aumento > 30% vs. mês anterior → "Gasto com 'Material' subiu X%."
- Saldo projetado negativo → "Atenção: caixa pode ficar negativo em N dias."
- Comissões pendentes não pagas há mais de 15 dias.
- Cliente com saldo a receber vencido > 30 dias.
- Cada alerta tem severidade (info/warning/danger), ícone e ação sugerida.

### 1.3 Subcategoria nas despesas
- Adicionar campo **Subcategoria** no `TransactionDialog` (já existe coluna `subcategory` no banco).
- Para a categoria `Salários/Comissões/Mão de obra`, a subcategoria mostra dropdown com **nome do colaborador** (lista de `employees`).
- Exibido nas listagens, gráficos e relatórios.

---

## 2. Aba Colaboradores (nova seção dentro do Financeiro)

### 2.1 Tabela nova: `collaborator_work_logs`
Registra horas/dias trabalhados por colaborador.

```
- id, user_id, employee_id (uuid)
- work_date (date)
- hours_worked (numeric)         -- ex: 8.5
- days_worked (numeric default 1)
- hourly_rate (numeric)          -- snapshot do valor/hora no dia
- daily_rate (numeric)           -- snapshot
- total_amount (numeric generated) -- hours × rate OU days × daily
- project_id / budget_id (uuid nullable)  -- vincular a obra
- description (text)
- status ('pending' | 'paid')
- linked_transaction_id (uuid nullable) -- quando vira despesa
- created_at, updated_at
```
RLS: padrão `can_access_data(auth.uid(), user_id)`.

Adicionar em `employees`: `hourly_rate numeric`, `daily_rate numeric` (opcionais).

### 2.2 Interface da aba
- Lista de colaboradores com totais do mês (horas, dias, valor a pagar).
- Botão "Registrar Horas" → modal com colaborador, data, horas OU dias, valor calculado, obra vinculada.
- Filtro por colaborador, mês, status.
- Botão **"Gerar despesa"** em registros pendentes → cria `financial_transaction` (categoria mão-de-obra, subcategoria = nome do colaborador, valor = total) e marca `status=paid` no log.
- Resumo: total a pagar do mês por colaborador, custo médio/hora real, ranking.

### 2.3 Integração
- Card no Painel de Sugestões: "R$ X em horas de colaborador ainda não lançadas."
- Aparece no DRE como linha de custo.

---

## 3. Detalhes técnicos

### Migrations
1. `ALTER TABLE employees ADD COLUMN hourly_rate numeric DEFAULT 0, ADD COLUMN daily_rate numeric DEFAULT 0;`
2. Criar tabela `collaborator_work_logs` + RLS + trigger updated_at.

### Arquivos a criar
- `src/components/finance/FinancialAdvisor.tsx` — engine de sugestões/críticas.
- `src/components/finance/CollaboratorTab.tsx` — aba de horas trabalhadas.
- `src/components/finance/WorkLogDialog.tsx` — modal de registro.
- `src/hooks/useFinancialInsights.ts` — regras de análise.

### Arquivos a editar
- `src/pages/FinancePage.tsx` — novos KPIs, nova section `colaboradores`, integrar Advisor.
- `src/components/finance/TransactionDialog.tsx` — campo subcategoria + dropdown colaborador para categorias de mão-de-obra.
- `src/lib/finance-calc.ts` — funções `computeBurnRate`, `computeRunway`, `projectedBalance`.

### UX
- Mantém estética luxury (Graphite/Gold, Playfair).
- Cards de alerta com cores semânticas (warning/destructive/success).
- Tudo realtime via Supabase channels.

---

## Fluxo para o usuário
1. Abre Financeiro → vê instantaneamente Saldo Real, Saldo Projetado, alertas críticos no topo.
2. Lê críticas: "Sua margem está em 18% (mínimo 25%). Reveja preço dos últimos orçamentos."
3. Vai na aba **Colaboradores** → registra "João trabalhou 8h hoje na obra do cliente Maria."
4. Clica "Gerar despesa" → vira lançamento financeiro com subcategoria "João Silva".
5. Volta no Financeiro → vê impacto real no caixa e no lucro do projeto.

Posso prosseguir com essa implementação?