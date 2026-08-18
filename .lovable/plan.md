# Plano de Implementação: Reset Total de Assessments

Garantir que ao clicar em "Refazer" ou iniciar um novo teste, todos os dados anteriores (drafts locais e estados de memória) sejam completamente limpos, forçando o usuário a começar do zero.

## Alterações

### Frontend

#### Assessment Wizard (`app.consciencia.assessment.tsx`)
- Adicionar uma função centralizada `clearAllStates` que reseta todos os hooks de estado (`setSabAns({})`, `setCerAns({})`, `setHard([])`, etc.).
- Modificar o `useEffect` de hidratação do draft para que, se a flag `reset` estiver presente na URL, ele limpe o `localStorage` imediatamente e não carregue nenhum dado.
- Garantir que o botão "Refazer Avaliação" na tela de resultados chame esta função de limpeza antes de navegar.

#### Página Inicial de Consciência (`app.consciencia.index.tsx`)
- Atualizar os links de "Refazer" ou "Continuar" para garantir que, quando a intenção for reiniciar, o parâmetro `reset: true` seja passado corretamente na URL.

#### Página de Evolução (`app.evolution.tsx`)
- (Opcional) Revisar se há links de reteste que precisem da flag de reset.

## Detalhes Técnicos
- Utilizar `localStorage.removeItem` com a chave específica da organização.
- Garantir que o `useEffect` de salvamento automático não sobrescreva o estado limpo com dados antigos logo após o reset.
- Escopo: Módulo C (DISC, Limitadores, Radar HSH/IPM).

---
*Este plano foca na correção da persistência indesejada de dados durante o reinício de testes.*
