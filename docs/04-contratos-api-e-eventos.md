# 04 — Contratos de API e Eventos

Legenda: ✅ existe · 🕓 planejado

## user-service — `http://localhost:3000`
| Método | Rota | Auth | Status | Descrição |
|---|---|---|---|---|
| GET | `/health` | — | ✅ | `{status:"up",service:"user-service"}` |
| POST | `/users` | — | ✅ | Body `{name(≥2), email, password(≥6)}` → 201 `{id,name,email}`; 400 se e-mail existe |
| POST | `/login` | — | ✅ | Body `{email,password}` → 200 `{tokenJwt, user:{id,name,email}}`; 401 `INVALID_CREDENTIALS!` |
| GET | `/users/me` | Bearer JWT | ✅ | → `{id,name,email}`; 401/404 |
| PATCH | `/users/me` | Bearer | 🕓 | Atualizar perfil |

JWT: HS256, payload `{userId,email}`, expira em 1h, segredo `JWT_SECRET`. Header: `Authorization: Bearer <token>`.
> Nota para o frontend: o campo do token se chama **`tokenJwt`** (não `token`).

## catalog-service — `http://localhost:3001` (prefixo `/api`)
| Método | Rota | Auth | Status | Descrição |
|---|---|---|---|---|
| GET | `/health` | — | ✅ | (sem prefixo `/api`) |
| POST | `/api/products` | — (🕓 admin) | ✅ | Body `{name,description,sku,price≥0,stock≥0}` → 201 produto; 400 SKU duplicado/valores negativos |
| GET | `/api/products` | — | 🕓 | `?page&limit&q&active` |
| GET | `/api/products/:id` | — | 🕓 | Detalhe |
| PATCH | `/api/products/:id` | admin | 🕓 | Atualizar |
| DELETE | `/api/products/:id` | admin | 🕓 | Soft delete (`isActive=false`) |

Produto: `{id, name, description, sku, price, stock, createdAt}` (model também tem `isActive`, `updatedAt`).

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
