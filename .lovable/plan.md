# Plano de Implementação - Ajustes de Jornada e Causas Raiz

O objetivo é resolver dois pontos críticos da especificação: a visibilidade da Jornada inicial e a inclusão de múltiplas causas raiz categorizadas no PDI (módulo Evolução).

## O que será feito

### 1. Visibilidade da Jornada Inicial
- Ajustar a mensagem de "Nenhuma jornada publicada" na tela de Jornada para ser mais amigável ou ocultar a entrada se não houver conteúdo.
- Garantir que o administrador tenha uma forma clara de saber que precisa publicar esse conteúdo (via memória de projeto).

### 2. Causas Raiz Múltiplas no PDI (5 Porquês)
- **Backend (Prisma/API):**
    - A tabela `RootCause` já existe no schema, mas precisa ser melhor integrada ao fluxo de criação/edição de PDI.
    - Criar/Atualizar endpoints em `api/src/routes/pdis.routes.ts` para permitir vincular múltiplas causas raiz a um PDI.
- **Frontend:**
    - Modificar o modal de criação de PDI (`src/routes/_authenticated/app.pdis.tsx`) para incluir uma seção de "Análise de Causa Raiz".
    - Implementar seletor de categorias: comportamental/sabotador, processo/ritual, dado/cultura, estrutural/meta.
    - Permitir a adição de múltiplas causas com descrição livre.

## Detalhes Técnicos
- **Schema:** Utilizar a tabela `RootCause` existente que possui `category` e `description`. Adicionarei um campo `pdiId` (opcional) na tabela `RootCause` via migration para vincular diretamente ao PDI, se necessário, ou manter o vínculo via `cycleId` conforme a spec da Mariana.
- **Categorias:** `comportamental`, `processo`, `dado`, `estrutural`, `outro`.
- **UI:** Componente multi-input dinâmico no modal de PDI.

## Próximos Passos
1. Atualizar o schema Prisma para garantir o vínculo `RootCause` <-> `Pdi`.
2. Implementar a lógica de salvamento múltiplo na API de PDIs.
3. Atualizar a UI do Modal de PDI no Frontend.
4. Ajustar a mensagem de fallback da Jornada.
