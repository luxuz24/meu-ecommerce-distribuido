# 04 — Contratos de API e Eventos

Legenda: ✅ existe · 🕓 planejado

## user-service — `http://localhost:3000` (ou via Gateway `http://localhost:8080`)
| Método | Rota | Auth | Status | Descrição |
|---|---|---|---|---|
| GET | `/health` | — | ✅ | `{status:"up",service:"user-service"}` |
| POST | `/users` | — | ✅ | Body `{name(≥2), email, password(≥6), role?:"CUSTOMER"\|"ADMIN"}` → 201 `{id,name,email,role}`; 400 se e-mail existe |
| POST | `/login` | — | ✅ | Body `{email,password}` → 200 `{tokenJwt, user:{id,name,email,role}}`; 401 `INVALID_CREDENTIALS!` |
| GET | `/users/me` | Bearer JWT | ✅ | → `{id,name,email,role}`; 401/404 |
| PATCH | `/users/me` | Bearer | 🕓 | Atualizar perfil |

JWT: HS256, payload `{userId,email,role}`, expira em 1h, segredo `JWT_SECRET`. Header: `Authorization: Bearer <token>`.
> Nota para o frontend: o campo do token se chama **`tokenJwt`** (não `token`).

## catalog-service — `http://localhost:3001` (prefixo `/api`, ou via Gateway `http://localhost:8080/api`)
| Método | Rota | Auth | Status | Descrição |
|---|---|---|---|---|
| GET | `/health` | — | ✅ | (sem prefixo `/api`) |
| POST | `/api/products` | Bearer JWT (`ADMIN`) | ✅ | Body `{name,description,sku,price≥0,stock≥0}` → 201 produto; 400/401/403 |
| GET | `/api/products` | — | ✅ | `?page&limit&q&active` → `{items, total, page, limit, totalPages}` |
| GET | `/api/products/:id` | — | ✅ | Detalhe do produto → 200 produto; 404 não encontrado |
| PATCH | `/api/products/:id` | Bearer JWT (`ADMIN`) | ✅ | Atualizar campos parciais → 200 produto; 400/401/403/404 |
| DELETE | `/api/products/:id` | Bearer JWT (`ADMIN`) | ✅ | Soft delete (`isActive=false`) → 204; 401/403/404 |

Produto: `{id, name, description, sku, price, stock, isActive, createdAt, updatedAt}`.

## inventory-service — `http://localhost:3003` (prefixo `/api`, ou via Gateway `http://localhost:8080/api`)
| Método | Rota | Auth | Status | Descrição |
|---|---|---|---|---|
| GET | `/health` | — | ✅ | `{status:"up",service:"inventory-service"}` (sem prefixo `/api`) |
| GET | `/api/inventory` | — | ✅ | Lista itens de estoque (`{items: [...]}`) |
| GET | `/api/inventory/:sku` | — | ✅ | Consulta estoque por SKU → 200 `{id,productId,sku,availableQty,reservedQty,updatedAt}`; 404 |
| POST | `/api/inventory/seed` | Bearer JWT (`ADMIN`) | ✅ | Upsert de estoque `{productId,sku,availableQty≥0}` → 200 |
| POST | `/api/inventory/reserve` | — | ✅ | Reserva atômica `{orderId,messageId?,items:[{sku,quantity}]}` + gravação na `outbox` → 200 `STOCK_RESERVED` ou 409 `STOCK_REJECTED` |
| POST | `/api/inventory/release/:orderId` | — | ✅ | Compensação: libera estoque reservado de `orderId` + grava `STOCK_RELEASED` na `outbox` |

## order-service — `http://localhost:3004` (prefixo `/api`, ou via Gateway `http://localhost:8080/api`)
| Método | Rota | Auth | Status | Descrição |
|---|---|---|---|---|
| GET | `/health` | — | ✅ | `{status:"up",service:"order-service"}` (sem prefixo `/api`) |
| POST | `/api/orders` | Bearer JWT | ✅ | Cria pedido (`PENDING`), calcula total no servidor e grava `ORDER_CREATED` na `outbox` → 201 |
| GET | `/api/orders` | Bearer JWT | ✅ | Lista pedidos do usuário autenticado (`{items, total}`) → 200 |
| GET | `/api/orders/:id` | Bearer JWT | ✅ | Detalhe do pedido (protegido contra IDOR; permite dono ou `ADMIN`) → 200 / 403 / 404 |
| PATCH | `/api/orders/:id/saga-event` | Bearer JWT | ✅ | Transição da Saga (`STOCK_RESERVED`, `STOCK_REJECTED`, `PAYMENT_APPROVED`, `PAYMENT_FAILED`) → 200 |

## payment-service 🕓
Contratos serão definidos na Fase 4.3 (`GET /api/payments/:orderId`, `POST /api/payments/process`).

## Eventos (RabbitMQ — exchange `ecommerce_events`, topic)
| Evento | Routing key | Produtor | Consumidores | Status | Payload |
|---|---|---|---|---|---|
| USER_CREATED | `user_created` | user-service (outbox) | notification-service | ✅ | `{id,name,email}` |
| PRODUCT_CREATED / UPDATED | `product_created` / `product_updated` | catalog | inventory | 🕓 | `{id,sku,price,stock}` |
| ORDER_CREATED | `order_created` | order (outbox) | inventory | ✅ | `{orderId,userId,items:[{productId,sku,name,price,quantity}],total}` |
| STOCK_RESERVED / STOCK_REJECTED | `stock_reserved` / `stock_rejected` | inventory (outbox) | order, payment | ✅ | `{orderId,reservationId?,reason?,items}` |
| PAYMENT_APPROVED / PAYMENT_FAILED | `payment_approved` / `payment_failed` | payment | order, notification, inventory | 🟡 (order e inventory prontos) | `{orderId,paymentId,reason?}` |
| ORDER_CONFIRMED / ORDER_CANCELLED | `order_confirmed` / `order_cancelled` | order (outbox) | notification, inventory | ✅ (produtor pronto) | `{orderId,userId,total?,reason?}` |

Tabela outbox (Postgres): `id, aggregateType, aggregateId, eventType, payload(JSONB), published, createdAt`.
Observação: o processor publica **apenas `payload`** como corpo; `messageId` = id da outbox (usar para idempotência).
