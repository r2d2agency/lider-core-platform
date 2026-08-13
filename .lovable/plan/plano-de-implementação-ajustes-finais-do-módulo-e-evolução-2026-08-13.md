# Plano de Implementação - Ajustes Finais do Módulo E (Evolução)

O objetivo é consolidar a implementação das funcionalidades do ciclo de fechamento e jornada, garantindo que o status dos itens E1 e E2 reflita a entrega real no sistema, e que a Landing Page permaneça em sua versão original.

## O que será feito

### 1. Documentação de Entrega (Memória de Projeto)
- Atualizar `mem://index.md` e criar/atualizar memórias específicas para confirmar que E1 e E2 foram implementados.
- **E1 (Resultado do período):** Implementado em `app.cycle-closure.tsx` com campos de meta, realizado e cálculo de desvio.
- **E2 (Snapshot 9-Box):** Implementado em `app.cycle-closure.tsx` com visualização histórica de grade e destaque de riscos.

### 2. Refinamento de UI no Fechamento de Ciclo
- Garantir que a unificação da **Análise de Causa Raiz (5 Porquês)** esteja visualmente integrada ao fluxo de fechamento, evitando duplicidade de seções (removendo a seção duplicada detectada na inspeção do arquivo).

### 3. Preservação da Landing Page
- Confirmar que `src/routes/index.tsx` não contém notas técnicas ou pendências, mantendo o visual profissional "Líder C.O.R.E.".

## Detalhes Técnicos
- **Arquivo:** `src/routes/_authenticated/app.cycle-closure.tsx`
- **Ação:** Remover a seção duplicada de "Análise de Causa Raiz" (linhas 590-659 são idênticas a 495-564).
- **Ação:** Verificar o vínculo de salvamento no `useMutation` para garantir que as causas raiz editadas no formulário unificado sejam persistidas corretamente no endpoint `/organization/${orgId}/jornada/closure/${activeCycleId}`.

## Próximos Passos
1. Limpeza de código duplicado no Fechamento de Ciclo.
2. Atualização da memória do projeto para marcar itens como concluídos.
