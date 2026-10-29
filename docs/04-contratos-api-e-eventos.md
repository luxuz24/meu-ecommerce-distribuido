# 04 — Contratos de API e Eventos

Toda a API é acessada pelo **API Gateway** em `http://localhost:8080`; as portas dos serviços não
são publicadas no host. O gateway aceita um `X-Correlation-ID` do cliente (ou gera um), devolve-o
na resposta e o repassa aos serviços. Erros gerados pelo próprio gateway (429, 502–504) também são
JSON: `{error, message, correlationId}`.

Autenticação: `Authorization: Bearer <tokenJwt>` (HS256, payload `{userId,email,role}`, 1h).

## Health
| Rota | Descrição |
|---|---|
| `GET /health` | Gateway |
| `GET /health/{user,catalog,inventory,order,payment}` | Health de cada serviço. Serviços da Saga retornam `{status, database, messaging}` e respondem **503** se banco ou RabbitMQ estiverem indisponíveis |

## user-service
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/users` | — | `{name(≥2), email, password(≥6)}` → 201 `{id,name,email,role:"CUSTOMER"}`; 400 se o e-mail existe. **Sempre cria CUSTOMER** (o campo `role` é ignorado). Limite: 10/min por IP |
| POST | `/login` | — | `{email,password}` → 200 `{tokenJwt, user}`; 401. Limite: 10/min por IP |
| GET | `/users/me` | usuário | → `{id,name,email,role}` |

A conta ADMIN é provisionada no boot do user-service a partir de `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

## catalog-service
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/products` | — | `?page&limit&q&active` → `{items,total,page,limit,totalPages}` |
| GET | `/api/products/:id` | — | → produto; 404 |
| POST | `/api/products` | ADMIN | `{name,description,sku,price≥0,stock≥0}` → 201; **409** se o SKU já existe (inclusive em cadastros simultâneos: o índice único decide) |
| PATCH | `/api/products/:id` | ADMIN | atualização parcial |
| DELETE | `/api/products/:id` | ADMIN | soft delete (`isActive=false`) → 204 |

## inventory-service
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/inventory` | — | lista de estoque |
| GET | `/api/inventory/:sku` | — | `{id,productId,sku,availableQty,reservedQty,updatedAt}` |
| POST | `/api/inventory/seed` | ADMIN | upsert `{productId,sku,availableQty}` |
| POST | `/api/inventory/reserve` | ADMIN | operação manual/diagnóstico; o fluxo normal é o evento `order_created` |
| POST | `/api/inventory/release/:orderId` | ADMIN | compensação manual; o fluxo normal é o evento `payment_failed` |

## order-service
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/api/orders` | usuário | `{items:[{productId, quantity}], simulatePaymentFailure?: boolean}` → 201 pedido `PENDING`. **Preço, nome e SKU vêm do catalog-service**; campos extras enviados pelo cliente são descartados. 422 produto inexistente/inativo · 503 catálogo indisponível |
| GET | `/api/orders` | usuário | pedidos do usuário `{items,total}` |
| GET | `/api/orders/:id` | dono ou ADMIN | 403 para outro cliente (anti-IDOR) |
| PATCH | `/api/orders/:id/saga-event` | ADMIN | transição manual para operação/diagnóstico (inclui `RESERVATION_EXPIRED`) |

## payment-service
| Método | Rota | Auth | Descrição |
|---|---|---|---|
| GET | `/api/payments/:orderId` | dono ou ADMIN | `{id,orderId,userId,amount,status,failureReason,createdAt}`; 403 / 404. `orderId` até 100 caracteres (limite de parâmetro do Fastify) |
| POST | `/api/payments/process` | ADMIN | processamento manual (o fluxo normal é o evento `stock_reserved`). `{orderId (≤100), userId, amount, simulateOutcome?, failureReason?, messageId?}`; `userId` ausente → 400. Pagamento já decidido para o pedido é **imutável**: responde `ALREADY_PROCESSED` sem novo evento |

Regra antifraude: pagamentos acima de **R$ 50.000** são recusados (o valor exato é aprovado). `simulateOutcome` só pode **forçar** uma recusa — `APPROVED` nunca fura o limite.

## Prazo das reservas
Toda reserva nasce com `expiresAt = agora + RESERVATION_TTL_SECONDS` (padrão 900s). Um sweeper no inventory-service (`RESERVATION_SWEEP_INTERVAL_MS`, padrão 15s) expira reservas `RESERVED` vencidas com transição condicional, devolve o estoque e publica `stock_reservation_expired`; o order-service cancela o pedido se ele ainda não foi pago. Se o pedido já estiver `PAID` (a confirmação se perdeu), o order-service reemite `ORDER_CONFIRMED` com `replay: true` e o inventory readquire o estoque com o mesmo update condicional; o notification-service ignora replays.

## Eventos — exchange `ecommerce_events` (topic, durable)

Propriedades AMQP de toda mensagem publicada pela outbox: `messageId` = id da linha da outbox
(chave de idempotência), `correlationId` = id da requisição que originou a cadeia,
`persistent: true`. O corpo é o `payload` abaixo.

| Evento | Routing key | Produtor | Consumidores | Payload |
|---|---|---|---|---|
| USER_CREATED | `user_created` | user-service | notification | `{name,email,role}` |
| ORDER_CREATED | `order_created` | order | inventory | `{orderId,userId,total,simulateOutcome?,items:[{productId,sku,name,price,quantity}]}` |
| STOCK_RESERVED | `stock_reserved` | inventory | order, payment | `{orderId,reservationId,userId,total,simulateOutcome?,items}` — `orderId`, `userId` e `total` (número finito ≥ 0) são **obrigatórios**: sem eles o payment-service recusa o evento (DLQ) em vez de cobrar R$ 0 ou criar pagamento sem dono |
| STOCK_REJECTED | `stock_rejected` | inventory | order | `{orderId,reason,items}` — `reason`: `INSUFFICIENT_STOCK:<sku>` ou `SKU_NOT_FOUND:<sku>` |
| STOCK_RELEASED | `stock_released` | inventory | — (auditoria) | `{orderId,items}` |
| STOCK_RESERVATION_EXPIRED | `stock_reservation_expired` | inventory (sweeper) | order | `{orderId,reason:"RESERVATION_EXPIRED",items}` — a reserva venceu sem a Saga concluir; o estoque já foi devolvido |
| PAYMENT_APPROVED | `payment_approved` | payment | order | `{orderId,paymentId,userId,amount,status}` |
| PAYMENT_FAILED | `payment_failed` | payment | order, inventory, notification | `{orderId,paymentId,userId,amount,status,reason}` |
| ORDER_CONFIRMED | `order_confirmed` | order | inventory, notification | `{orderId,userId,total,replay?}` — `replay: true` quando reemitido para reconciliar uma reserva expirada |
| ORDER_CANCELLED | `order_cancelled` | order | notification | `{orderId,userId,reason}` |

Cada fila de consumo tem uma DLQ (`<fila>_dlq`) ligada ao exchange `ecommerce_events_dlx`.

## Tabela outbox (Postgres)
`id, aggregateType, aggregateId, eventType, payload (JSONB), published, createdAt` — nos serviços da Saga (order, inventory, payment) também `correlationId`.
O relay publica pendentes em ordem de criação e só marca `published = true` após o publisher
confirm do broker.
