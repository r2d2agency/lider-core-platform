# Plano de Ação - Correção de Fluxo e Progresso no Módulo Consciência

O usuário relatou dois problemas principais no Módulo Consciência:
1. O indicador de progresso diz "Faltam 1 etapa", mas o contador mostra "6/7" e ele não sabe qual falta.
2. Ao clicar em "Continuar", o assessment recomeça do zero em vez de continuar de onde parou.

Este plano detalha as correções para garantir que o progresso seja calculado corretamente e que o estado do assessment seja persistido e recuperado de forma confiável.

## Alterações

### Frontend

#### 1. Persistência e Recuperação do Assessment (`src/routes/_authenticated/app.consciencia.assessment.tsx`)
- Refatorar a lógica de `localStorage` para garantir que o `step` e as respostas sejam salvos em tempo real a cada interação.
- Ajustar a lógica de "Hidratação" para priorizar o rascunho salvo se o usuário estiver voltando para concluir um teste inacabado.
- Garantir que o botão "Continuar" da Home direcione para o `step` correto via search params.

#### 2. Cálculo de Progresso e Identificação de Etapa Faltante (`src/routes/_authenticated/app.consciencia.index.tsx`)
- Refinar a lógica de `done` para cada etapa, garantindo que critérios mínimos (ex: número de questões respondidas) sejam atendidos.
- Adicionar um destaque visual (badge ou texto) na lista de etapas para indicar claramente qual é a "Próxima Etapa" ou "Etapa Pendente".
- Melhorar o cálculo de `missing` para refletir o estado real das tabelas do backend.

### Backend

#### 1. API de Perfil (`api/src/routes/consciencia.routes.ts`)
- Garantir que o `upsert` do perfil não limpe campos existentes se não forem enviados (preservar rascunhos parciais se necessário, embora o frontend gerencie o draft local).
- Verificar se o campo `assessmentAt` está sendo atualizado apenas na conclusão real do teste.

## Checklist de Verificação
- [ ] Iniciar assessment, responder 50%, fechar aba, voltar e clicar em "Continuar": deve abrir na questão onde parou.
- [ ] Completar todas as etapas exceto "Sabotadores": a Home deve dizer "Falta 1 etapa: Sabotadores".
- [ ] O contador de progresso (80%, 90%...) deve ser consistente com o número de itens marcados como concluídos na lista.
