# 02 — Planejamento e Roadmap

Legenda: `[x]` feito · `[ ]` pendente

## A. O que já foi feito
### Infra
- [x] docker-compose com Postgres, MongoDB, RabbitMQ (healthcheck no Postgres)
- [x] Dockerfiles multi-stage (Node 24-alpine) para user-service, user-outbox-processor, notification-service, catalog-service
- [x] `.env`/`.env.example` na raiz e por serviço; `.dockerignore`
- [x] Script idempotente de criação dos bancos lógicos
- [x] README raiz com como rodar/testar

### user-service (Postgres/Prisma)
- [x] `POST /users` (hash bcrypt + gravação em `outbox` na mesma transação)
- [x] `POST /login` (JWT 1h), `GET /users/me` (middleware JWT), `GET /health`
- [x] Migrations Prisma (`users`, `outbox` com payload JSONB)

### Mensageria
- [x] user-outbox-processor publica `USER_CREATED` → routing key `user_created`
- [x] notification-service consome e simula e-mail de boas-vindas
- [x] Fluxo ponta a ponta validado manualmente

### catalog-service (MongoDB)
- [x] Conexão Mongo, model Product, `POST /api/products` (valida SKU único, preço/estoque ≥ 0), `GET /health`
- [x] `GET /api/products` (paginação, busca `q`, filtro `active`), `GET /api/products/:id`, `PATCH /api/products/:id`, `DELETE /api/products/:id` (soft delete)

## B. O que falta (por fase)

### Fase 0 — Higiene e fundação (fazer primeiro)
- [x] Remover/arquivar `services/outbox-processor` (duplicado)
- [x] Testes: configurar Vitest em cada serviço + scripts `test`
- [x] CORS (`@fastify/cors`) em user e catalog para o frontend
- [x] Handler global de erros (`setErrorHandler` com `correlationId`) + erros de domínio tipados
- [x] `npm audit --omit=dev --audit-level=high` como gate do CI (1 crítica e 10 altas corrigidas na Fase 8); pin de versões via lockfile
- [x] `.gitignore` do catalog-service commitado; setup local padronizado
- [x] Padronizar nomes de DB: user-service usa `user_db` (Fase 7); `catalog_db` é criado pelo MongoDB no primeiro uso

### Fase 0.5 — Segurança e entrada (ver `06-fluxo-solid-e-seguranca.md`)
- [x] CI GitHub Actions (.github/workflows/ci.yml: matrix build, prisma, test, docker build) + proteção da `main` (configuração no GitHub)
- [x] `@fastify/helmet`, `@fastify/cors` (allowlist via `CORS_ORIGINS`), `@fastify/rate-limit` em user e catalog
- [x] Schemas de validação (`additionalProperties:false`) e sanitização Mongo (`sanitizeFilter`)
- [x] Nginx como API Gateway + Load Balancer (`gateway/nginx.conf` na porta `:8080`, `least_conn`, health checks, rate limit)
- [x] Containers non-root (`USER node` em todos os Dockerfiles para compatibilidade AppArmor/Ubuntu e menor privilégio)
- [ ] Rotacionar segredos de dev; scan de segredos e de imagens no CI
- [x] Testes unitários dos use cases (user, catalog, inventory, order, payment, frontend) e parsers dos workers (44 testes passando)

### Fase 1 — Clean Architecture no user-service
- [x] Criar `domain/` (`User`, `IUserRepository`, `IPasswordHasher`, `ITokenService`)
- [x] Implementações em `infra/` (PrismaUserRepository, BcryptPasswordHasher, JwtTokenService)
- [x] Use cases recebem interfaces; composition root (`infra/container.ts`)
- [x] Erros de domínio (`UserAlreadyExistsError`, `InvalidCredentialsError`, `UserNotFoundError`) tipados
- [x] Validação de entrada com schema em `/login` e `/users`; testes unitários puros com fakes in-memory

### Fase 2 — Catalog completo
- [x] Mover DTOs/interfaces para `domain/`; composition root (`infra/container.ts`)
- [x] `GET /api/products` (paginação, filtro por nome/SKU e status ativo), `GET /api/products/:id`
- [x] `PATCH /api/products/:id`, `DELETE /api/products/:id` (soft via `isActive`)
- [x] Proteger escrita por JWT (role `ADMIN` via `requireAdminAuth` — Fase 3)
- [x] Schemas Fastify (validação de body, params e querystring)
- [ ] Outbox no catálogo (ou publisher direto) para eventos `PRODUCT_CREATED/UPDATED`

### Fase 3 — Autorização e identidade
- [x] Campo `role` (`CUSTOMER`/`ADMIN`) em `User` + migration Prisma + claims no JWT
- [ ] Refresh token / logout (decidir escopo)
- [x] Middleware JWT padronizado (`requireAdminAuth` no `catalog-service`) validando algoritmo `HS256` e role `ADMIN`
- [x] API Gateway Nginx (`gateway/nginx.conf` em `http://localhost:8080`) roteando `/users`, `/login` e `/api/products`

### Fase 4 — Novos serviços (bancos já provisionados)
- [x] **inventory-service** (`inventory_db`): estoque/reservas em Clean Architecture (`InventoryItem`, `StockReservation`, `Outbox`, `ProcessedMessage` para idempotência); consome `ORDER_CREATED` e `PAYMENT_FAILED`, emite `STOCK_RESERVED`/`STOCK_REJECTED`
- [x] **order-service** (`order_db`): pedidos em Clean Architecture (`Order`, `OrderItem`, `Outbox`, `ProcessedMessage`), cálculo de total no servidor, proteção anti-IDOR, Saga (`PENDING` → `STOCK_RESERVED` → `PAID` / `CANCELLED`) e tela `/orders` + Carrinho no Frontend
- [x] **payment-service** (`payment_db`): pagamento em Clean Architecture (`Payment`, `Outbox`, `ProcessedMessage`); consome `STOCK_RESERVED`, emite `PAYMENT_APPROVED`/`PAYMENT_FAILED`
- [x] Saga coreografada: Order → Inventory → Payment → Order (confirmação/compensação completa)
- [x] Estender notification-service: pedido confirmado (`order_confirmed`), pagamento falhou (`payment_failed`) e pedido cancelado (`order_cancelled`)
- [x] Cada serviço: Dockerfile, entrada no compose, `.env.example`, migrations, testes

### Fase 5 — Resiliência e observabilidade
- [x] Idempotência nos consumidores (tabela `processed_messages` / `messageId` implementada no `inventory-service`, `order-service` e `payment-service`)
- [x] Retry + DLQ no RabbitMQ (`ecommerce_events_dlx` + filas `*_dlq`); `nack(msg, false, false)` no `notification-service` e workers da Saga
- [x] Outbox transacional em `user-service`, `inventory-service`, `order-service` e `payment-service`
- [x] Logs estruturados, `X-Correlation-ID` propagado pelo Gateway e serviços, `/health` com checagem ativa de banco de dados (`SELECT 1` / `readyState`)
- [x] CI (GitHub Actions): lint, build/test/audit por componente e job E2E com a stack completa (Fase 8)

### Fase 6 — Frontend (paralelo às fases 2–4)
- [x] **F0 a F3**: Scaffold, autenticação JWT, catálogo com busca e filtros, painel Admin CRUD com soft delete
- [x] **F4 & F5**: Carrinho de Compras persistente (`CartContext`), Checkout transacional (`POST /api/orders`) e tela **Meus Pedidos** (`/orders`) com status visual da Saga Coreografada
- [x] **Telemetria Limpa**: Toggle instantâneo entre **Modo Telemetria Dev** e **Modo Loja Limpa** (`<DevOnly>`) no topo da página
Ver detalhes em [05-frontend-plano.md](./05-frontend-plano.md).

### Fase 7 — Hardening para estudo de caso
- [x] **Integridade de preço**: order-service resolve preço/nome/SKU no catalog-service; cliente envia só `{productId, quantity}`
- [x] **Sem overselling**: reserva por `UPDATE` condicional, `CHECK (availableQty >= 0)`, `prefetch` nos consumers
- [x] **Fechamento da Saga**: `order_confirmed` converte a reserva em baixa definitiva
- [x] **Mensageria resiliente**: reconexão com backoff, publisher confirms, healthchecks e `depends_on: service_healthy`
- [x] **Gateway como porta única**: serviços sem portas no host; `X-Correlation-ID` propagado por HTTP → outbox → AMQP
- [x] **Segurança**: cadastro público não concede ADMIN; rate limit por IP real (`trustProxy` + XFF sobrescrito na borda); pagamento visível só ao dono/ADMIN
- [x] **Testes E2E**: 8 cenários da Saga contra a stack real, executados no CI
- [x] **Banco por serviço de fato**: user-service migrado para `user_db`

### Fase 8 — Completude da Saga e gates de qualidade
- [x] **Expiração de reservas**: `expiresAt` + sweeper condicional; `stock_reservation_expired` cancela pedidos não pagos; confirmação tardia readquire o estoque
- [x] **SKU duplicado concorrente**: `409 Conflict` em vez de `500`
- [x] **Lint** (ESLint + typescript-eslint) e **`npm audit`** como gates do CI
- [x] **Teste de caos** de expiração de reservas no CI
- [x] **README em inglês** + engineering notes

## C. Ordem sugerida de execução
1. Fase 0 → 2. Fase 1 e Fase 2 (paralelas) → 3. Fase 6 (MVP: cadastro/login/catálogo) → 4. Fase 3 → 5. Fase 4 → 6. Fase 5 → 7. Frontend de pedidos/pagamento.

## D. Definition of Done (qualquer tarefa)
- Build `tsc` sem erros; testes do que foi alterado passando
- Imagem Docker do serviço builda e sobe no compose
- `.env.example` e docs (`04-contratos…`, este roadmap) atualizados
- Commits em Conventional Commits, branch `feat/<nome>` ou `chore/<nome>`
