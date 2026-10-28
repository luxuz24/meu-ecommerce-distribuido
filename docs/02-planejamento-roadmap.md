# 02 — Planejamento e Roadmap

Legenda: ✅ feito · 🟡 parcial · ⬜ pendente

## A. O que já foi feito
### Infra
- ✅ docker-compose com Postgres, MongoDB, RabbitMQ (healthcheck no Postgres)
- ✅ Dockerfiles multi-stage (Node 24-alpine) para user-service, user-outbox-processor, notification-service, catalog-service
- ✅ `.env`/`.env.example` na raiz e por serviço; `.dockerignore`
- ✅ Script idempotente de criação dos bancos lógicos
- ✅ README raiz com como rodar/testar

### user-service (Postgres/Prisma)
- ✅ `POST /users` (hash bcrypt + gravação em `outbox` na mesma transação)
- ✅ `POST /login` (JWT 1h), `GET /users/me` (middleware JWT), `GET /health`
- ✅ Migrations Prisma (`users`, `outbox` com payload JSONB)

### Mensageria
- ✅ user-outbox-processor publica `USER_CREATED` → routing key `user_created`
- ✅ notification-service consome e simula e-mail de boas-vindas
- ✅ Fluxo ponta a ponta validado manualmente

### catalog-service (MongoDB)
- ✅ Conexão Mongo, model Product, `POST /api/products` (valida SKU único, preço/estoque ≥ 0), `GET /health`
- ✅ `GET /api/products` (paginação, busca `q`, filtro `active`), `GET /api/products/:id`, `PATCH /api/products/:id`, `DELETE /api/products/:id` (soft delete)

## B. O que falta (por fase)

### Fase 0 — Higiene e fundação (fazer primeiro)
- ✅ Remover/arquivar `services/outbox-processor` (duplicado)
- ✅ Testes: configurar Vitest em cada serviço + scripts `test`
- ✅ CORS (`@fastify/cors`) em user e catalog para o frontend
- ✅ Handler global de erros (`setErrorHandler` com `correlationId`) + erros de domínio tipados
- ⬜ Corrigir `npm audit` onde seguro; pin de versões
- ✅ `.gitignore` do catalog-service commitado; setup local padronizado
- ⬜ Padronizar nomes de DB (usar `user_db` no user-service) e criar `catalog_db` explicitamente

### Fase 0.5 — Segurança e entrada (ver `06-fluxo-solid-e-seguranca.md`)
- ✅ CI GitHub Actions (.github/workflows/ci.yml: matrix build, prisma, test, docker build) + proteção da `main` (configuração no GitHub)
- ✅ `@fastify/helmet`, `@fastify/cors` (allowlist via `CORS_ORIGINS`), `@fastify/rate-limit` em user e catalog
- ✅ Schemas de validação (`additionalProperties:false`) e sanitização Mongo (`sanitizeFilter`)
- ✅ Nginx como API Gateway + Load Balancer (`gateway/nginx.conf` na porta `:8080`, `least_conn`, health checks, rate limit)
- ✅ Containers non-root (`USER node` em todos os Dockerfiles para compatibilidade AppArmor/Ubuntu e menor privilégio)
- ⬜ Rotacionar segredos de dev; scan de segredos e de imagens no CI
- ✅ Testes unitários dos use cases (user, catalog, inventory, order, payment, frontend) e parsers dos workers (44 testes passando)

### Fase 1 — Clean Architecture no user-service
- ✅ Criar `domain/` (`User`, `IUserRepository`, `IPasswordHasher`, `ITokenService`)
- ✅ Implementações em `infra/` (PrismaUserRepository, BcryptPasswordHasher, JwtTokenService)
- ✅ Use cases recebem interfaces; composition root (`infra/container.ts`)
- ✅ Erros de domínio (`UserAlreadyExistsError`, `InvalidCredentialsError`, `UserNotFoundError`) tipados
- ✅ Validação de entrada com schema em `/login` e `/users`; testes unitários puros com fakes in-memory

### Fase 2 — Catalog completo
- ✅ Mover DTOs/interfaces para `domain/`; composition root (`infra/container.ts`)
- ✅ `GET /api/products` (paginação, filtro por nome/SKU e status ativo), `GET /api/products/:id`
- ✅ `PATCH /api/products/:id`, `DELETE /api/products/:id` (soft via `isActive`)
- ✅ Proteger escrita por JWT (role `ADMIN` via `requireAdminAuth` — Fase 3)
- ✅ Schemas Fastify (validação de body, params e querystring)
- ⬜ Outbox no catálogo (ou publisher direto) para eventos `PRODUCT_CREATED/UPDATED`

### Fase 3 — Autorização e identidade
- ✅ Campo `role` (`CUSTOMER`/`ADMIN`) em `User` + migration Prisma + claims no JWT
- ⬜ Refresh token / logout (decidir escopo)
- ✅ Middleware JWT padronizado (`requireAdminAuth` no `catalog-service`) validando algoritmo `HS256` e role `ADMIN`
- ✅ API Gateway Nginx (`gateway/nginx.conf` em `http://localhost:8080`) roteando `/users`, `/login` e `/api/products`

### Fase 4 — Novos serviços (bancos já provisionados)
- ✅ **inventory-service** (`inventory_db`): estoque/reservas em Clean Architecture (`InventoryItem`, `StockReservation`, `Outbox`, `ProcessedMessage` para idempotência); consome `ORDER_CREATED` e `PAYMENT_FAILED`, emite `STOCK_RESERVED`/`STOCK_REJECTED`
- ✅ **order-service** (`order_db`): pedidos em Clean Architecture (`Order`, `OrderItem`, `Outbox`, `ProcessedMessage`), cálculo de total no servidor, proteção anti-IDOR, Saga (`PENDING` → `STOCK_RESERVED` → `PAID` / `CANCELLED`) e tela `/orders` + Carrinho no Frontend
- ✅ **payment-service** (`payment_db`): pagamento em Clean Architecture (`Payment`, `Outbox`, `ProcessedMessage`); consome `STOCK_RESERVED`, emite `PAYMENT_APPROVED`/`PAYMENT_FAILED`
- ✅ Saga coreografada: Order → Inventory → Payment → Order (confirmação/compensação completa)
- ✅ Estender notification-service: pedido confirmado (`order_confirmed`), pagamento falhou (`payment_failed`) e pedido cancelado (`order_cancelled`)
- ✅ Cada serviço: Dockerfile, entrada no compose, `.env.example`, migrations, testes

### Fase 5 — Resiliência e observabilidade
- ✅ Idempotência nos consumidores (tabela `processed_messages` / `messageId` implementada no `inventory-service`, `order-service` e `payment-service`)
- ✅ Retry + DLQ no RabbitMQ (`ecommerce_events_dlx` + filas `*_dlq`); `nack(msg, false, false)` no `notification-service` e workers da Saga
- ✅ Outbox transacional em `user-service`, `inventory-service`, `order-service` e `payment-service`
- ✅ Logs estruturados, `X-Correlation-ID` propagado pelo Gateway e serviços, `/health` com checagem ativa de banco de dados (`SELECT 1` / `readyState`)
- ✅ CI (GitHub Actions): build, lint, test, docker build (todos os 8 componentes na matriz)

### Fase 6 — Frontend (paralelo às fases 2–4)
- ✅ **F0 a F3**: Scaffold, autenticação JWT, catálogo com busca e filtros, painel Admin CRUD com soft delete
- ✅ **F4 & F5**: Carrinho de Compras persistente (`CartContext`), Checkout transacional (`POST /api/orders`) e tela **Meus Pedidos** (`/orders`) com status visual da Saga Coreografada
- ✅ **Telemetria Limpa**: Toggle instantâneo entre **Modo Telemetria Dev** e **Modo Loja Limpa** (`<DevOnly>`) no topo da página
Ver detalhes em [05-frontend-plano.md](./05-frontend-plano.md).

## C. Ordem sugerida de execução
1. Fase 0 → 2. Fase 1 e Fase 2 (paralelas) → 3. Fase 6 (MVP: cadastro/login/catálogo) → 4. Fase 3 → 5. Fase 4 → 6. Fase 5 → 7. Frontend de pedidos/pagamento.

## D. Definition of Done (qualquer tarefa)
- Build `tsc` sem erros; testes do que foi alterado passando
- Imagem Docker do serviço builda e sobe no compose
- `.env.example` e docs (`04-contratos…`, este roadmap) atualizados
- Commits em Conventional Commits, branch `feat/<nome>` ou `chore/<nome>`
