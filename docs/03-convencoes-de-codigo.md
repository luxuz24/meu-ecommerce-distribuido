# 03 — Convenções de Código

## Clean Architecture (obrigatório em código novo/refatorado)
1. **Regra de dependência**: `infra → use-cases → domain`. Nunca o contrário.
2. `domain/` não importa Prisma, Mongoose, Fastify, bcrypt, jwt, amqplib.
3. Use cases recebem dependências por **construtor, via interfaces** (`IUserRepository`, `IPasswordHasher`…).
4. Controllers só: validar entrada → chamar use case → mapear erro/resposta HTTP. Sem regra de negócio.
5. Instanciação de dependências em um **composition root** (`infra/container.ts`), não dentro de controllers.
6. Erros de negócio = classes tipadas em `domain/errors`, não strings. HTTP mapeia classe → status.
7. Nunca retornar `password`/hash; mapear entidade → DTO de resposta.
8. Eventos publicados via **Outbox** (gravados na mesma transação da mudança de estado). Nunca publicar direto no broker dentro do use case.

## Estrutura de pastas por serviço
```
src/
├── domain/{entities,errors,repositories,services}
├── use-cases/
├── infra/{database,http/{controllers,routes,middlewares},messaging}
└── server.ts
```

## TypeScript / Node
- ESM (`"type": "module"`), `module: NodeNext`: imports relativos **com `.js`** (`./x.js`).
- `verbatimModuleSyntax`: usar `import type`/`import { type X }` para tipos.
- `strict: true`; evitar `any` (hoje há `as any` legados — não replicar).
- Variáveis de ambiente: falhar cedo se ausentes; nunca hardcode de segredos.
- Prisma 7 usa driver adapter (`@prisma/adapter-pg`) e `prisma.config.ts`; rodar `npx prisma generate` após mudar schema.

## Mensageria
- Exchange `ecommerce_events` (topic, durable). Routing key = `eventType` em minúsculas (`user_created`).
- Payload JSON com campos mínimos estáveis; versionar via campo `version` se quebrar contrato.
- Consumidores: idempotentes, `ack` só após sucesso, `nack`/DLQ em falha (meta da Fase 5).

## Docker / Ambiente
- Todo serviço novo: `Dockerfile` multi-stage, `.dockerignore`, `.env.example`, entrada no `docker-compose.yml`, `depends_on` com healthcheck quando houver Postgres.
- Dentro do compose, hosts são nomes de serviço (`postgres:5432`, `mongodb:27017`, `rabbitmq:5672`). Do host, Postgres é `localhost:5434`.
- Nunca commitar `.env` (já no `.gitignore`).

## Testes
- Vitest. Use cases testados com **fakes/in-memory das interfaces** (sem DB).
- Repositórios/rotas: testes de integração contra containers do compose.
- Novo comportamento ⇒ novo teste.

## Git
- Conventional Commits (`feat(catalog-service): ...`), branches `feat/*` e `chore/*`, PR para `main`.
- Um escopo por PR; atualizar docs junto.

## Não fazer
- Não misturar bancos entre serviços (cada serviço dono do seu schema).
- Não chamar um serviço diretamente do banco de outro.
- Não apagar comentários/docs existentes sem relação com a mudança.
- Não adicionar dependências sem necessidade; preferir as já usadas (Fastify, Prisma/Mongoose, amqplib, pg).
