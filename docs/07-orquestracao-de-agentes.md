# 07 — Orquestração de Agentes por Tarefa

Este documento define o **protocolo de orquestração multi-agente** para desenvolvimento iterativo do ecossistema distribuído **MicroStore**. Qualquer agente coordenador (ou desenvolvedor humano) deve seguir este fluxo para distribuir responsabilidades entre os **5 agentes especialistas**.

---

## 1. Os 5 Agentes Especialistas

| Agente | Especificação Completa | Escopo Principal |
|---|---|---|
| **1. Agente de Banco de Dados (`agent-database`)** | [agents/agent-database.md](./agents/agent-database.md) | Schemas Prisma/PostgreSQL (`user_db`, `order_db`, `inventory_db`, `payment_db`), schemas Mongoose/MongoDB (`catalog_db`), migrations SQL idempotentes, Transactional Outbox, tabelas de idempotência (`processed_messages`), índices e prevenção contra SQL/NoSQL Injection. |
| **2. Agente de Backend (`agent-backend`)** | [agents/agent-backend.md](./agents/agent-backend.md) | Microsserviços Node.js + Fastify + TypeScript em **Clean Architecture** (`domain/` → `use-cases/` → `infra/`), princípios **SOLID**, workers RabbitMQ (Saga coreografada e Outbox Processor), segurança HTTP (Helmet, CORS allowlist, Rate Limit, JWT HS256, RBAC `CUSTOMER`/`ADMIN`) e API Gateway Nginx (`:8080`). |
| **3. Agente de Frontend (`agent-frontend`)** | [agents/agent-frontend.md](./agents/agent-frontend.md) | Aplicação React 19 + Vite + TypeScript + Tailwind CSS (`frontend/` na porta `:3002`), design system *Distributed Commerce Minimalist* (Stitch), consumo tipado das APIs, gestão de sessão JWT e isolamento estrito entre **Modo Dev Telemetry (`<DevOnly>`)** e **Modo Loja Limpa** para o usuário final. |
| **4. Agente de Testes & QA (`agent-qa-tests`)** | [agents/agent-qa-tests.md](./agents/agent-qa-tests.md) | Testes unitários puros com Vitest e Fakes In-Memory, testes de validação de schema e autorização, testes de parsers de eventos/mensageria, validação de build (`npm run build && npm test`), pipeline GitHub Actions (`.github/workflows/ci.yml`) e auditoria do checklist de PR antes da entrega. |
| **5. Agente de Grafo & Obsidian (`agent-graph`)** | [agents/agent-graph.md](./agents/agent-graph.md) | Manutenção contínua do Grafo de Conhecimento (`graphify-out/graph.json`, `GRAPH_REPORT.md`) e do Vault Obsidian (`docs/` + `docs/obsidian/graph.canvas`), análise de impacto pré-tarefa (`npm run graph:explain`, `npm run graph:path`) e auditoria de acoplamento Clean Architecture via AST. |

---

## 2. Fluxo de Orquestração por Tarefa (Pipeline de 7 Etapas)

Toda nova feature ou fase do [02-planejamento-roadmap.md](./02-planejamento-roadmap.md) deve seguir obrigatoriamente esta sequência:

```
[Etapa 0: Sincronização Git, Consulta ao Grafo & Contratos]
   git switch main && git pull → git checkout -b feat/<escopo>-<feature>
   Consultar impacto no grafo (npm run graph:explain / graph:path)
   Atualizar/confirmar contrato em docs/04-contratos-api-e-eventos.md
         │
         ▼
[Etapa 1: Agente de Banco de Dados (agent-database)]
   Modelagem de tabelas/coleções, migrations Prisma, tabelas Outbox/Idempotência e Repositórios concretos
         │
         ▼
[Etapa 2: Agente de Backend (agent-backend)]
   Entidades de Domínio, Erros Tipados, Use Cases (DIP/SRP), Controllers/Rotas Fastify, Workers RabbitMQ e Gateway
         │
         ▼
[Etapa 3: Agente de Frontend (agent-frontend)]
   Tipos em domain/types.ts, métodos em services/api.ts, Telas/Componentes + Telemetria encapsulada em <DevOnly>
         │
         ▼
[Etapa 4: Agente de Testes & QA (agent-qa-tests)]
   Testes unitários e automatizados (sucesso + erro + segurança), validação de build completo e Docker Compose
         │
         ▼
[Etapa 5: Agente de Grafo & Obsidian (agent-graph)]
   Executar `npm run graph:update` para atualizar graphify-out/graph.json, GRAPH_REPORT.md e Vault Obsidian (docs/obsidian/)
   Verificar se não há acoplamento indevido entre camadas no grafo
         │
         ▼
[Etapa 6: Abertura do Pull Request & Gate de CI]
   Commit semântico → git push → gh pr create → aguardar CI 100% verde → entregar link do PR ao usuário (NUNCA mergear sozinho)
```

---

## 3. Matriz de Orquestração pelas Próximas Tarefas do Roadmap

### Tarefa A — Fase 4.1: Microsserviço de Estoque (`inventory-service` + `inventory_db`)
1. **`agent-database`**:
   - Configurar Prisma no `services/inventory-service` apontando para o banco `inventory_db` (já criado no `init-databases.sh`).
   - Criar tabelas `inventory_items` (`id`, `productId`, `sku`, `availableQty`, `reservedQty`, `updatedAt`), `stock_reservations` (`id`, `orderId`, `status`, `createdAt`), `outbox` e `processed_messages` (idempotência).
   - Implementar `PrismaInventoryRepository` com transação atômica de reserva/baixa + escrita na `outbox`.
2. **`agent-backend`**:
   - Criar `domain/` (`InventoryItem`, `StockReservation`, `IInventoryRepository`, erros `InsufficientStockError`, `ItemNotFoundError`).
   - Criar use cases: `SyncProductStockUseCase`, `ReserveStockUseCase`, `ReleaseStockUseCase`, `GetStockBySkuUseCase`.
   - Expor rotas HTTP (`GET /health`, `GET /api/inventory/:sku`, `POST /api/inventory/seed`) e consumidor RabbitMQ para `ORDER_CREATED` emitindo `STOCK_RESERVED` ou `STOCK_REJECTED`.
   - Adicionar rota no `gateway/nginx.conf` e serviço no `docker-compose.yml`.
3. **`agent-frontend`**:
   - Integrar consulta de reserva/estoque na vitrine e no painel Admin (com telemetria em `<DevOnly>`).
4. **`agent-qa-tests`**:
   - Criar testes unitários de reserva com estoque suficiente, falha por estoque insuficiente (`STOCK_REJECTED`), idempotência de mensagens duplicadas e adicionar `inventory-service` na matriz do `.github/workflows/ci.yml`.
5. **`agent-graph`**:
   - Executar `npm run graph:update` para indexar os novos nós do `inventory-service` e validar suas conexões no `GRAPH_REPORT.md` e no Obsidian.

---

### Tarefa B — Fase 4.2: Microsserviço de Pedidos (`order-service` + `order_db`)
1. **`agent-database`**:
   - Configurar Prisma no `services/order-service` (`order_db`) com tabelas `orders` (`id`, `userId`, `status`: `PENDING` | `STOCK_RESERVED` | `PAID` | `CANCELLED`, `total`, `createdAt`), `order_items` (`id`, `orderId`, `productId`, `sku`, `name`, `price`, `quantity`), `outbox` e `processed_messages`.
2. **`agent-backend`**:
   - Criar `domain/` (`Order`, `OrderItem`, `IOrderRepository`) e use cases (`CreateOrderUseCase`, `ListUserOrdersUseCase`, `GetOrderByIdUseCase`, `UpdateOrderStatusUseCase`).
   - Proteger `POST /api/orders` e `GET /api/orders` por JWT (`AuthMiddleware`).
   - Consumir eventos RabbitMQ `STOCK_REJECTED`, `PAYMENT_APPROVED` e `PAYMENT_FAILED` para atualizar o status do pedido e emitir `ORDER_CONFIRMED` / `ORDER_CANCELLED`.
3. **`agent-frontend`**:
   - Implementar **Fase F4 e F5**: Drawer/Página de Carrinho de Compras, Checkout (`POST /api/orders`) e tela **Meus Pedidos (`/orders`)** com acompanhamento em tempo real do status da Saga.
4. **`agent-qa-tests`**:
   - Testar cálculo de total no servidor (nunca confiar no preço enviado pelo cliente), transições de estado da Saga e proteção JWT.
5. **`agent-graph`**:
   - Executar `npm run graph:update` para mapear o `order-service` e as relações de eventos da Saga no grafo e no Vault Obsidian.

---

### Tarefa C — Fase 4.3: Microsserviço de Pagamento (`payment-service` + `payment_db`)
1. **`agent-database`**:
   - Configurar Prisma no `services/payment-service` (`payment_db`) com tabelas `payments` (`id`, `orderId`, `userId`, `amount`, `status`: `APPROVED` | `FAILED`, `createdAt`), `outbox` e `processed_messages`.
2. **`agent-backend`**:
   - Criar `ProcessPaymentUseCase` acionado pelo evento `STOCK_RESERVED`, gravando aprovação/falha e emitindo `PAYMENT_APPROVED` ou `PAYMENT_FAILED` na `outbox`.
   - Estender `notification-service` para notificar `ORDER_CONFIRMED` e `PAYMENT_FAILED`.
3. **`agent-frontend`**:
   - Exibir status de pagamento no detalhe do pedido e permitir simulação de pagamento aprovado/recusado em `<DevOnly>`.
4. **`agent-qa-tests`**:
   - Testar fluxo ponta a ponta da Saga Coreografada (`ORDER_CREATED` → `STOCK_RESERVED` → `PAYMENT_APPROVED` → `ORDER_CONFIRMED`) e compensação (`PAYMENT_FAILED` → libera estoque e cancela pedido).
5. **`agent-graph`**:
   - Executar `npm run graph:update` para consolidar a topologia completa dos 5 microsserviços no Grafo de Conhecimento e no Obsidian.

---

### Tarefa D — Limpeza Final para Produção (Release Candidate)
1. **`agent-frontend`**:
   - Desativar `VITE_DEV_TELEMETRY=false` por padrão e remover os widgets de simulação/telemetria (`<DevOnly>`), entregando a interface 100% limpa ao consumidor final.
2. **`agent-qa-tests`**:
   - Validar build final de produção e garantir zero vazamento de metadados internos na UI.
3. **`agent-graph`**:
   - Executar `npm run graph:update` para garantir que o grafo final reflita exatamente a árvore limpa de produção.

---

## 4. Protocolo de Handoff entre Agentes

Ao passar o bastão de um agente para o próximo dentro de uma tarefa, o agente que concluiu sua etapa deve fornecer um **Resumo de Handoff** contendo:
1. **Arquivos criados/alterados** (caminhos exatos).
2. **Contratos expostos** (interfaces TypeScript, endpoints HTTP ou eventos RabbitMQ).
3. **Variáveis de ambiente adicionadas** (sempre espelhadas em `.env.example`).
4. **Comando de verificação executado** (ex: `npx prisma generate`, `npm run build`, `npm test`, `npm run graph:update`).
