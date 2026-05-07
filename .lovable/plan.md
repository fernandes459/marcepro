# Plano: Biblioteca 3D Profissional + Fluxo de Orçamento Refinado

Vou expandir drasticamente a biblioteca de módulos, melhorar a visualização 3D (com portas/gavetas abertas, puxadores, corrediças) e revisar todo o fluxo do orçamento até o PDF.

---

## 1. Biblioteca de Módulos (de ~25 para 100+)

Reescrever `src/components/budget/moduleTemplates.ts` com módulos categorizados estilo CorteCloud:

**Categorias e quantidade alvo:**
- **Armários Base** (15): 1, 2, 3, 4 colunas; com/sem gavetas; caixas separadas; cantos em L
- **Cozinha** (20): aéreos 1/2/3 portas, basculantes, torre quente, torre forno+microondas, despenseiro, balcão pia, balcão cooktop, gaveteiro 3/4/5 gavetas, canto otimizado
- **Dormitório** (15): GR 2/3/4/6/8 portas, GR de canto, cabeceira + criados, sapateira, cômoda 4/6 gavetas
- **Closet** (10): módulos abertos cabideiro, prateleiras, gaveteiro com vidro, sapateira diagonal, ilha central
- **Banheiro** (8): gabinete simples/duplo, espelheira, torre alta, nicho box
- **Home/Sala** (12): rack suspenso, painel TV liso/ripado, estante livros, bar, adega, aparador
- **Escritório** (10): mesa reta/L/U, gaveteiro volante, armário arquivo, estante alta, mesa reunião 6/8/12 lugares
- **Lavanderia** (6): torre máquinas, armário tanque, prateleira utilidades
- **Comercial** (8): balcão atendimento, expositor vidro, prateleira loja, caixa, vitrine

Cada template terá: nome, descrição, ícone, dimensões padrão profissionais (mm), quantidade de portas/gavetas/prateleiras corretas.

---

## 2. Visualização 3D Profissional (`Module3DViewer.tsx`)

Reescrever o renderizador Three.js para mostrar realismo CorteCloud-like:

**Componentes visuais por módulo:**
- **Caixa**: laterais, base, tampo, fundo (3mm recuado) com espessura visível
- **Prateleiras**: com pinos suportes visíveis
- **Portas**: animadas (fechadas/abertas a 90°/110°) com toggle
- **Gavetas**: animadas (fechadas/abertas) com frente + caixa interna + corrediças laterais visíveis
- **Puxadores**: barras horizontais cromadas em portas e gavetas
- **Dobradiças**: cilindros pequenos visíveis quando porta aberta
- **Pés/sapatas**: cilindros na base de balcões/torres

**Controles novos:**
- Toggle "Abrir portas/gavetas" (anima tudo simultaneamente)
- Toggle "Mostrar interno" (oculta portas)
- Toggle "Mostrar puxadores/ferragens"
- Modos de visualização: Perspectiva / Frontal / Lateral / Topo / Isométrica
- Presets de ambiente (manter os 6 atuais)
- Zoom para módulo específico
- Cor do material configurável (branco, madeirado, preto)

**Implementação:** componente `<ModuleMesh>` recebe config + estado de animação; usa `@react-three/drei` `useSpring` ou lerp manual via `useFrame` para abrir/fechar suavemente.

---

## 3. Fluxo de Orçamento Refinado

Revisar `BudgetWizardDialog.tsx` end-to-end:

**Aba 1 — Cliente:** validação obrigatória, exibir avatar/iniciais, badge "novo cliente"

**Aba 2 — Projeto:** auto-preenchimento de número sequencial, validade do orçamento (30 dias default), prioridade

**Aba 3 — Ambientes:** drag-to-reorder, duplicar ambiente, ícone por tipo

**Aba 4 — Módulos:** picker da nova biblioteca grande com busca + filtros por categoria; preview 3D ao lado; edição inline de dimensões

**Aba 5 — Custos:** breakdown visível (chapas, fitas, ferragens, mão de obra, overhead)

**Aba 6 — Margem:** sliders + preview de preço ao vivo + sugestão IA + condições de pagamento

**Aba 7 — Resumo + PDF:**
- Validação de completude (badge verde/vermelho por aba)
- Botão "Gerar PDF Cliente" (configurável: descrição, itens, condições, cláusulas)
- Botão "Gerar PDF Interno" (com custos, plano de corte, materiais)
- Botão "Enviar via WhatsApp" com link do PDF
- Botão "Aprovar e Converter em Projeto" (move para produção)

**Persistência:** garantir que TODOS os campos (modules, opções 3D, custos, margem, condições) são salvos no JSON `meta` da budget e recarregados ao reabrir.

---

## 4. PDF Aprimorado (`BudgetPdfGenerator.tsx`)

- Capa com logo + dados do cliente + número/data/validade
- Página de descrição do projeto (rich text do campo "Descrição Externa")
- Lista de ambientes com itens agrupados
- Tabela de condições de pagamento detalhada
- Cláusulas contratuais editáveis em Configurações
- Rodapé com vendedor + assinaturas
- PDF Interno adiciona: custo por item, total de chapas, fita linear, lista de ferragens

---

## Arquivos afetados

- `src/components/budget/moduleTemplates.ts` (reescrito, ~100 templates)
- `src/components/budget/Module3DViewer.tsx` (reescrito, animações + ferragens)
- `src/components/budget/ModuleTemplatePicker.tsx` (busca + filtros)
- `src/components/budget/BudgetWizardDialog.tsx` (refinos UX + persistência)
- `src/components/finance/BudgetPdfGenerator.tsx` (capa + seções configuráveis)
- `src/pages/SettingsPage.tsx` (cláusulas contratuais editáveis)

Sem mudanças de schema — tudo cabe nas colunas existentes + JSON `meta`.
