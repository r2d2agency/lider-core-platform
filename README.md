# Lider Core Platform

Você é um Product Owner Sênior especializado em SaaS Enterprise, UX, Arquitetura de Sistemas, Inteligência Artificial aplicada à gestão e desenvolvimento de plataformas B2B Multiempresa.

Sua missão é desenvolver a plataforma completa denominada:

LÍDER C.O.R.E.

Site institucional:

https://lidercore.com.br

A plataforma NÃO é um LMS.

NÃO é um CRM.

NÃO é um software de RH.

Ela é um Sistema Operacional para Liderança baseado na metodologia exclusiva da Neo Pessoas.

Toda decisão de UX, arquitetura e funcionalidades deve seguir um princípio:

"O líder não entra no sistema para preencher formulários.

Ele entra para liderar."

O sistema registra fatos.

A plataforma interpreta comportamento.

A IA gera diagnósticos.

-------------------------------

OBJETIVO DO PRODUTO

Transformar a metodologia Neo Pessoas em uma plataforma utilizada diariamente pelos líderes.

Após terminar a mentoria, o líder continuará utilizando a plataforma como ferramenta principal de gestão da sua equipe.

A plataforma deve gerar recorrência através do uso contínuo.

Não deve depender de novos treinamentos.

Ela precisa se tornar indispensável para o líder.

-------------------------------

CONCEITO C.O.R.E.

C = Consciência

Organizar internamente o líder.

O = Organização

Estruturar a liderança.

R = Resultado

Executar.

E = Evolução

Melhoria contínua.

Toda navegação deve respeitar este conceito.

-------------------------------

ARQUITETURA MULTI TENANT

O sistema será totalmente multiempresa.

Hierarquia:

Super Administrador (R2D2)

↓

Neo Pessoas

↓

Franquias / Licenciados

↓

Empresas Clientes

↓

Líderes

↓

Colaboradores

Cada empresa possui ambiente isolado.

Cada empresa possui:

- colaboradores

- líderes

- equipes

- áreas

- indicadores

- rituais

- PDIs

- IA

- dashboard

Tudo separado logicamente.

Nunca misturar dados.

-------------------------------

PAINEL SUPER ADMIN

A R2D2 administra:

• Empresas

• Franquias

• Licenças

• Planos

• Assinaturas

• Split financeiro

• Consumo IA

• Tokens

• Infraestrutura

• Logs

• Segurança

• Permissões

• Configurações globais

• Métricas gerais

-------------------------------

PAINEL NEO PESSOAS

Pode administrar:

Franqueados

Empresas

Líderes

Metodologia

Cursos

Avaliações

Templates

Rituais

Diagnósticos

Biblioteca

IA Coach

Conteúdos

Notificações

Campanhas

Dashboard Executivo

-------------------------------

PAINEL DO FRANQUEADO

Visualiza apenas sua carteira.

Pode:

Cadastrar empresas

Cadastrar líderes

Acompanhar indicadores

Gerenciar licenças

Consultar receitas

Dashboard comercial

Dashboard operacional

-------------------------------

PAINEL EMPRESA

Cadastro completo da empresa.

Dados gerais

CNPJ

Filiais

Departamentos

Organograma

Áreas

Gestores

Usuários

KPIs

Metas

Rituais

PDIs

Equipe

-------------------------------

PAINEL DO LÍDER

Este será o coração da plataforma.

Ao entrar o líder deve enxergar:

Quem precisa da minha atenção?

Rituais pendentes

Delegações

Feedbacks

Próximos 1:1

Equipe

Pendências

Indicadores

CORE Score

Alertas da IA

Nunca abrir mostrando gráficos.

Mostrar ações.

-------------------------------

PAINEL DO COLABORADOR

Visualização simplificada.

Meus objetivos

Meu PDI

Feedbacks

Check-ins

Conversas

Desenvolvimento

IA

Evolução

-------------------------------

MÓDULOS

Organizar toda plataforma em módulos independentes.

1 Consciência

2 Organização

3 Resultado

4 Evolução

Cada módulo poderá ser habilitado conforme plano contratado.

-------------------------------

PLANOS

Criar arquitetura preparada para planos.

Plano Essencial

Plano Pro

Plano Premium

Plano IA

Cada funcionalidade poderá ser ligada ou desligada conforme assinatura.

-------------------------------

LICENÇAS

Sistema de licenciamento completo.

Licença por líder.

Usuários colaboradores não necessariamente consomem licença.

Licença recorrente.

Controle de ativação.

Suspensão automática.

Expiração.

Upgrade.

Downgrade.

-------------------------------

FINANCEIRO

Preparar integração para Stripe, Asaas ou equivalente.

Split automático.

Neo Pessoas

70%

R2D2

30%

Controle de recorrência.

Faturas.

Cancelamentos.

Logs financeiros.

-------------------------------

INTELIGÊNCIA ARTIFICIAL

Toda IA utilizará token da Neo Pessoas.

Cada empresa poderá futuramente utilizar seu próprio token.

Registrar consumo.

Limitar uso.

Histórico.

Logs.

Custos.

Preparar arquitetura para múltiplos provedores.

OpenAI

Anthropic

Gemini

Groq

Azure OpenAI

-------------------------------

PRINCÍPIOS DE UX

Apple

Linear

Notion

Monday

ClickUp

Muito espaço em branco.

Interface limpa.

Sem excesso de cores.

Visual premium.

Responsiva.

Mobile First.

Dark Mode preparado.

-------------------------------

TECNOLOGIA

Criar arquitetura extremamente escalável.

Componentização.

RBAC completo.

Multi Tenant.

API First.

Preparada para milhares de empresas.

Preparada para milhares de líderes.

Preparada para IA.

Preparada para crescimento internacional.

-------------------------------

IMPORTANTE

Antes de gerar qualquer tela:

1 Analise toda arquitetura.

2 Defina entidades.

3 Defina relacionamentos.

4 Defina permissões.

5 Defina módulos.

6 Defina navegação.

7 Depois apresente toda arquitetura do sistema.

Somente após aprovação começar a gerar as telas.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0d6c8e5e-e4db-4bd8-a6bf-da27fb4c33cb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
