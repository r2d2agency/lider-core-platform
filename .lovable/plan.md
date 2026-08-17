# Plano de Ação - Refatoração do Módulo Sabotadores (C.O.R.E.)

O usuário relatou dois problemas críticos:
1. O termo "Sabotadores" não deve ser usado, pois as perguntas foram ajustadas para algo mais leve/diferente.
2. O fluxo de "Refazer" está preso em um loop (clica em sim e a tela apenas recarrega na mesma pergunta).

Este plano detalha a renomeação da funcionalidade para "Limitadores de Performance" (ou similar condizente com C.O.R.E.) e a correção do motor de reset do assessment.

## Alterações

### 1. Renomeação Semântica
- Alterar "Sabotadores" para "Limitadores de Performance" em todo o Módulo Consciência.
- Atualizar títulos, descrições e hints para refletir a nova semântica, mantendo a estrutura de 10 pilares mas focando em "desafios de execução".

### 2. Correção do Loop de Reset (`src/routes/_authenticated/app.consciencia.assessment.tsx`)
- Corrigir a função de reset no `showResults`: em vez de apenas limpar o `localStorage` e dar `window.location.reload()`, garantir que o estado do React seja resetado explicitamente ou que o redirecionamento limpe os parâmetros de busca que forçam o `showResults`.
- Garantir que ao clicar em "Sim" para refazer, o usuário caia no `step` correto da etapa selecionada com os dados limpos.

### 3. Atualização de UI (`src/routes/_authenticated/app.consciencia.index.tsx`)
- Refletir a mudança de nome nos cards da Home e no progresso da jornada.

## Checklist de Verificação
- [ ] O termo "Sabotadores" não aparece mais na interface do usuário.
- [ ] Ao clicar em "Refazer Avaliação" -> "Sim", a tela limpa o progresso anterior e permite responder novamente desde o início daquela etapa.
- [ ] O rascunho (draft) é limpo corretamente ao iniciar uma nova tentativa.
