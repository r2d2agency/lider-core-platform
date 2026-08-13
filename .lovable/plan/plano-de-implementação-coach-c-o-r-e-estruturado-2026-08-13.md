# Plano de Implementação: Coach C.O.R.E. Estruturado

O objetivo é transformar a lista de tarefas do Coach C.O.R.E. em um sistema de feedback estruturado (Concordo / Vou ajustar / Discordo) e integrar o plano de ação nas 4 frentes do PDI.

## Alterações

### 1. Backend (Prisma & API)
- Validar se o `CycleClosure` e `PdiSnapshot` no Prisma suportam os dados necessários.
- O campo `coachSuggestion` e `coachResponse` no `CycleClosure` serão usados para armazenar a interação estruturada (JSON).

### 2. Frontend (Componentes & Rotas)
- **`src/routes/_authenticated/app.cycle-closure.tsx`**:
  - Redesenhar a seção do Coach IA.
  - Substituir a lista simples por cards de recomendação com botões de ação: `Concordo`, `Ajustar`, `Discordo`.
  - Adicionar campo de texto condicional para "Ajustar" ou "Discordo".
  - Botão "Enviar para PDI" que distribui as ações aceitas nas 4 frentes.

- **`src/routes/_authenticated/app.pdis.tsx` (NewPdiDialog)**:
  - Integrar a mesma lógica de feedback caso o PDI esteja sendo criado a partir de uma sugestão da IA.

- **`src/routes/index.tsx`**:
  - Atualizar o texto de "O que ainda falta" para refletir a conclusão da tarefa.

### 3. Integração de IA
- Ajustar o prompt do `Coach` para retornar as recomendações já categorizadas nas 4 frentes do PDI.

## Detalhes Técnicos
- Utilizar `framer-motion` para transições suaves entre os estados de feedback.
- Manter a paleta de cores C.O.R.E. (Laranja para Evolução).
- Garantir que o `PdiSnapshot` registre a origem da ação (IA vs Manual).
