# 01 — Visão e Arquitetura

## O que é
E-commerce distribuído em microsserviços (Node 24, TypeScript ESM, Fastify). Persistência poliglota (PostgreSQL + MongoDB) e comunicação assíncrona via RabbitMQ usando o padrão **Transactional Outbox**.

## Mapa do repositório
```
ecommerce_micro/
├── docker-compose.yml        # infra + serviços
├── init-scripts/             # cria bancos lógicos no Postgres
├── docs/                     # ESTA documentação
└── services/
    ├── user-service/         # API de usuários/auth (Fastify + Prisma 7 + Postgres)
    ├── user-outbox-processor/# worker: outbox (Postgres) -> RabbitMQ
    ├── notification-service/ # worker: consome USER_CREATED, simula e-mail
    ├── catalog-service/      # API de produtos (Fastify + Mongoose + MongoDB)
    └── outbox-processor/     # LEGADO: cópia do user-outbox-processor, sem Dockerfile, fora do compose
```

## Infraestrutura (docker-compose)
| Componente | Imagem | Host | Observação |
|---|---|---|---|
| Postgres | postgres:15-alpine | 5434 | DB `ecommerce`; init cria `user_db`, `order_db`, `payment_db`, `inventory_db` |
| MongoDB | mongo:6 | 27017 | catálogo usa `catalog_db` |
| RabbitMQ | 3-management | 5672 / 15672 | exchange `ecommerce_events` (topic, durable) |

> ⚠️ Hoje o `user-service` usa o DB `ecommerce` (não `user_db`). Os bancos `order_db`, `payment_db`, `inventory_db` existem mas **nenhum serviço os usa ainda**.

## Fluxo implementado (Outbox)
```
POST /users → user-service (tx: users + outbox{USER_CREATED})
  → user-outbox-processor (poll 5s, FOR UPDATE SKIP LOCKED)
  → exchange ecommerce_events, routing key `user_created`
  → notification-service (fila notification_user_created) → log de e-mail simulado
```

## Estado real da Clean Architecture
Estrutura-alvo por serviço:
```
src/
├── domain/          # entidades, value objects, interfaces de repositório (sem libs externas)
├── use-cases/       # regras de aplicação; dependem só de interfaces
└── infra/
    ├── database/    # repositórios concretos, models, clients
    ├── http/        # controllers, routes, middlewares (Fastify)
    └── messaging/   # publishers/consumers
```

| Serviço | Situação |
|---|---|
| catalog-service | **Mais próximo do alvo**: `IProductRepository` + `MongoProductRepository` (infra) + use case + controller/rotas. Falta pasta `domain/` (interfaces/DTOs estão dentro do use case). Controller instancia dependências manualmente (sem composition root). `ListProductsUseCase.ts` está **vazio**. |
| user-service | **Totalmente alinhado**: Camadas `domain/` (`User`, erros tipados, `IUserRepository`, `IPasswordHasher`, `ITokenService`), use cases desacoplados de bibliotecas externas, implementações em `infra/` e composition root (`container.ts`). |
| workers (outbox/notification) | Arquivo único `index.ts`; sem camadas. Aceitável por ora, refatorar ao crescer. |

## Débitos técnicos conhecidos
1. user-service acoplado a Prisma/bcrypt/jwt nos use cases.
2. Catálogo sem `domain/`, sem listagem/busca/atualização, sem autenticação nas rotas.
3. `/users/me` e JWT sem verificação por outros serviços (sem gateway/segredo compartilhado definido).
4. Sem testes automatizados (`npm test` é placeholder) em nenhum serviço.
5. `outbox-processor/` duplicado e abandonado.
6. Sem validação de schema no catálogo; sem handler global de erros; sem idempotência no consumidor.
7. Sem DLQ/retry no RabbitMQ; `notification-service` dá `ack` mesmo em erro.
8. `.env` com segredos de dev; sem CORS configurado (necessário para o frontend).
9. Tarefas `npm audit` pendentes (user-service: 10 vulnerabilidades reportadas na instalação).
