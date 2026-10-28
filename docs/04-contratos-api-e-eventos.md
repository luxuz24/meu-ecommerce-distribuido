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

## order / payment / inventory 🕓
Contratos serão definidos aqui antes da implementação (Fase 4). Rotas previstas: `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`, `GET /api/payments/:orderId`.

## Eventos (RabbitMQ — exchange `ecommerce_events`, topic)
| Evento | Routing key | Produtor | Consumidores | Status | Payload |
|---|---|---|---|---|---|
| USER_CREATED | `user_created` | user-service (outbox) | notification-service | ✅ | `{id,name,email}` |
| PRODUCT_CREATED / UPDATED | `product_created` / `product_updated` | catalog | inventory | 🕓 | `{id,sku,price,stock}` |
| ORDER_CREATED | `order_created` | order | inventory | 🕓 | `{orderId,userId,items:[{productId,qty,price}],total}` |
| STOCK_RESERVED / STOCK_REJECTED | `stock_reserved` / `stock_rejected` | inventory | order, payment | 🕓 | `{orderId,reason?}` |
| PAYMENT_APPROVED / PAYMENT_FAILED | `payment_approved` / `payment_failed` | payment | order, notification, inventory | 🕓 | `{orderId,paymentId}` |
| ORDER_CONFIRMED / ORDER_CANCELLED | `order_confirmed` / `order_cancelled` | order | notification, inventory | 🕓 | `{orderId,userId}` |

Tabela outbox (Postgres): `id, aggregateType, aggregateId, eventType, payload(JSONB), published, createdAt`.
Observação: o processor publica **apenas `payload`** como corpo; `messageId` = id da outbox (usar para idempotência).
