# Plano de Implementação — Ciclo de Evolução (HSH & PDI)

Implementar o versionamento e comparação do Radar HSH (Hard/Soft/Heart) entre ciclos e consolidar o histórico incremental do PDI através de snapshots versionados, garantindo a rastreabilidade da evolução do líder conforme a especificação Mariana.

## Mudanças Técnicas

### 1. Banco de Dados (Prisma)
- Adicionar campo `radarSnapshot` no modelo `CycleClosure` para salvar o estado do Radar HSH no momento do fechamento do ciclo.
- Garantir que `PdiSnapshot` capture o estado do Radar no momento da criação da versão.

### 2. Backend (API)
- **`api/src/routes/jornada.routes.ts`**:
    - Atualizar `GET /closure/:cycleId` para buscar o Radar HSH do ciclo anterior e calcular o delta (antes × depois).
    - Atualizar `POST /pdi-snapshots` para incluir obrigatoriamente o snapshot do Radar HSH atual.
- **`api/src/routes/consciencia.routes.ts`**:
    - Criar helper para buscar histórico de scores HSH do usuário logado.

### 3. Frontend (React)
- **`src/components/jornada/PdiSnapshotPanel.tsx`**:
    - Adicionar visualização do "CORE Radar Evolution" mostrando a comparação entre a versão atual e a anterior (ex: "Heart 48 → 61").
- **`src/routes/_authenticated/app.cycle-closure.tsx`**:
    - Integrar o componente de comparação HSH na tela de fechamento de ciclo.
    - Exibir o histórico de versões do PDI com destaque para as mudanças de metas e competências.
- **`src/routes/_authenticated/app.consciencia.index.tsx`**:
    - Atualizar o card "Minha Evolução" para exibir a tendência (setas de subida/descida) baseada no ciclo anterior.

## Experiência do Usuário
- O líder poderá visualizar graficamente sua evolução técnica (Hard), comportamental (Soft) e emocional (Heart) a cada virada de ciclo.
- O PDI deixa de ser um "documento vivo" que apaga o passado e se torna um "log de crescimento", onde cada versão reflete as decisões de recalibração tomadas na jornada.
