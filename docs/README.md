# Docs — Guia para Agentes de Desenvolvimento

Este diretório é a **fonte de verdade** para qualquer agente (ou dev) que trabalhe neste monorepo. Leia na ordem abaixo antes de alterar código.

| # | Documento | Para que serve |
|---|-----------|----------------|
| 01 | [01-visao-e-arquitetura.md](./01-visao-e-arquitetura.md) | O que o sistema faz, serviços, infra, fluxo de eventos, estado real da Clean Architecture |
| 02 | [02-planejamento-roadmap.md](./02-planejamento-roadmap.md) | **Planejamento**: o que já foi feito, o que falta, fases e prioridades |
| 03 | [03-convencoes-e-regras-para-agentes.md](./03-convencoes-e-regras-para-agentes.md) | Regras obrigatórias: Clean Arch, TypeScript, git, Docker, testes |
| 04 | [04-contratos-api-e-eventos.md](./04-contratos-api-e-eventos.md) | Endpoints atuais/planejados e eventos RabbitMQ |
| 05 | [05-frontend-plano.md](./05-frontend-plano.md) | Plano do frontend, stack implementada e diretriz `<DevOnly>` vs. Modo Loja Limpa |
| 06 | [06-fluxo-solid-e-seguranca.md](./06-fluxo-solid-e-seguranca.md) | **Como os agentes trabalham**: branch + PR + testes como gate de merge, SOLID, segurança (SQL injection, CORS, rate limit, load balancer…) |
| 07 | [07-orquestracao-de-agentes.md](./07-orquestracao-de-agentes.md) | **Orquestração Multi-Agente por Tarefa**: pipeline de execução, matriz das próximas fases e protocolo de handoff |

## Perfis dos Agentes Especialistas (`docs/agents/`)

| Agente | Arquivo | Responsabilidade |
|---|---|---|
| **Banco de Dados (`agent-database`)** | [agents/agent-database.md](./agents/agent-database.md) | PostgreSQL/Prisma, MongoDB/Mongoose, Migrations, Transactional Outbox, Idempotência e Anti-Injection |
| **Backend (`agent-backend`)** | [agents/agent-backend.md](./agents/agent-backend.md) | Microsserviços Fastify/TypeScript em Clean Architecture, SOLID, RabbitMQ Saga, JWT/RBAC e Nginx Gateway |
| **Frontend (`agent-frontend`)** | [agents/agent-frontend.md](./agents/agent-frontend.md) | React 19/Vite/Tailwind (Stitch Design), integração de APIs e isolamento `<DevOnly>` vs. Produção Limpa |
| **Testes & QA (`agent-qa-tests`)** | [agents/agent-qa-tests.md](./agents/agent-qa-tests.md) | Testes unitários Vitest (Fakes In-Memory), testes de segurança/contratos, pipeline CI e Quality Gate de PR |

## Regras de manutenção
- Ao concluir uma tarefa, **atualize o checklist** em `02-planejamento-roadmap.md`.
- Ao criar/alterar endpoint ou evento, **atualize** `04-contratos-api-e-eventos.md` no mesmo PR.
- Se um doc divergir do código, o código vence — corrija o doc.

## Comandos rápidos
```bash
docker compose up -d          # sobe tudo (infra + serviços + gateway + frontend)
docker compose ps             # status
docker compose logs -f <svc>  # logs
docker compose up -d --build <svc>   # rebuild de um serviço
npm run build                 # builda todos os serviços e o frontend
npm test                      # roda todos os testes unitários do monorepo
```
Portas no host: user `3000`, catalog `3001`, frontend `3002`, API Gateway `8080`, Postgres `5434` (5432 do host está ocupada), Mongo `27017`, RabbitMQ `5672`/`15672`.
