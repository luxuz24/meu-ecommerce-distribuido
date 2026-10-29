# Engineering notes

Real defects found in this codebase, each one reproduced against the running system
before being fixed and then locked in with an automated test. They are the parts of
distributed systems that compile cleanly, pass unit tests with in-memory fakes and
still break in production.

Every entry follows the same structure: **symptom → evidence → root cause → fix → proof**.

---

## 1. The Saga approved every payment, silently

- **Symptom:** the anti-fraud rule (decline above R$ 50,000) never triggered, so the
  compensation path (release stock on payment failure) never ran in the real flow.
- **Evidence:** the `STOCK_RESERVED` rows in the inventory outbox had no `total` or
  `userId`, and the payment consumer derived the amount from that payload.
- **Root cause:** an intermediate event broke the contract. `ORDER_CREATED` carried
  `total` and `userId`, but `inventory-service` rebuilt the `STOCK_RESERVED` payload
  without them; the payment consumer fell back to `amount ?? 0`.
- **Fix:** complete event payloads end to end; consumers no longer hide missing
  business fields behind defaults.
- **Proof:** E2E scenario *anti-fraud* (only passes if `total` survives two hops) and
  *happy path* (asserts the charged amount equals the server-side total).

## 2. Any customer could buy anything for R$ 0.01

- **Symptom:** the order total was "calculated on the server", but from prices sent by
  the client.
- **Evidence:** `POST /api/orders` with `price: 0.01` produced a valid order.
- **Root cause:** the request schema accepted `price`, `name` and `sku`.
- **Fix:** the client sends only `{productId, quantity}`; `order-service` resolves
  price, name and SKU from `catalog-service` through an `IProductCatalog` port
  (3 s timeout, `503` when the catalog is down, `422` for unknown/inactive products).
- **Proof:** unit test with a fake catalog + E2E scenario sending a tampered price.

## 3. Overselling under concurrency

- **Symptom:** more units reserved than existed in stock.
- **Evidence:** stock = 5, 20 concurrent reservations → **14 reserved, `availableQty = -9`**.
- **Root cause:** time-of-check to time-of-use. The repository read the balance and
  decremented it afterwards; consumers had no `prefetch`, so messages were processed
  in parallel.
- **Fix:** atomic conditional update (`UPDATE … WHERE available_qty >= :qty`, zero rows
  affected means out of stock), whole-order rollback on the first shortage, a
  `CHECK (available_qty >= 0)` constraint as the last line of defense, unique-key races
  treated as "already processed", and `prefetch(10)` on every consumer.
- **Proof:** same experiment → exactly 5 reserved, stock 0. E2E: 12 simultaneous orders
  for 4 units → exactly 4 paid. Duplicate delivery of one message 10× → one effect.

## 4. On a cold start, the whole Saga was dead

- **Symptom:** after `docker compose up` from scratch, orders stayed `PENDING` forever.
- **Evidence:** every consumer logged `ECONNREFUSED` against RabbitMQ and kept running
  with no messaging at all. Health checks still reported the services as up.
- **Root cause:** services started before the broker accepted connections; the
  connection was attempted once and the failure only logged a warning. Outbox rows were
  marked `published` right after `channel.publish()`, which only writes to a local
  buffer.
- **Fix:** a resilient connection with exponential backoff (1 s → 30 s) that re-declares
  exchanges, queues and consumers after reconnecting; publisher confirms before marking
  outbox rows as published; `/health` returns `503` when messaging is down; Compose
  healthchecks with `depends_on: service_healthy`.
- **Proof:** cold start reaches 12/12 healthy without restarts. Chaos test: with
  RabbitMQ stopped, an order is accepted and held in the outbox; when the broker
  returns, every service reconnects and the order completes as `PAID`.

## 5. Anyone could register as an administrator

- **Symptom:** every admin-only guard (catalog writes, stock, payments, manual Saga
  transitions) was bypassable.
- **Evidence:** `POST /users {"role": "ADMIN", ...}` returned `"role": "ADMIN"` to an
  anonymous caller.
- **Root cause:** the public signup schema accepted the role, and frontend dev
  shortcuts relied on that to create admin accounts.
- **Fix:** public signup always creates `CUSTOMER`. The admin account is provisioned by
  `user-service` at boot from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (idempotent, never
  promoting an existing customer).
- **Proof:** E2E security scenario (escalation attempt, customer forcing a Saga
  transition, customer calling internal endpoints).

## 6. The per-IP rate limit was actually global

- **Symptom:** a handful of active users could get the whole site rate limited.
- **Evidence:** found while writing the E2E suite. Behind Nginx, every service saw the
  gateway's IP for every client, so "100 requests per minute per IP" meant 100 per
  minute for everyone.
- **Root cause:** services did not trust the proxy's `X-Forwarded-For`. Trusting it
  naively would open the opposite hole, because Nginx was *appending* the header, so a
  client could forge its own IP.
- **Fix:** services trust `X-Forwarded-For` only from private networks, and the gateway
  *overwrites* it with `$remote_addr`. Gateway-generated errors (429/5xx) now return
  JSON with `Retry-After` and the correlation id instead of HTML.
- **Proof:** 12 login attempts, each with a different forged `X-Forwarded-For`, still hit
  the same per-client limit.

## 7. A step that never answers locked stock forever

- **Symptom:** an order stuck in `STOCK_RESERVED`, with its units reserved indefinitely.
- **Evidence:** with `payment-service`'s database failing, the `stock_reserved` message
  was dead-lettered. After the database recovered, nothing resolved the order:
  `STOCK_RESERVED`, reservation `RESERVED`, 2 units locked, 1 message in the DLQ.
- **Root cause:** an intermediate Saga state had no guaranteed exit.
- **Fix:** reservations carry `expiresAt` (`RESERVATION_TTL_SECONDS`) and the originating
  correlation id. A sweeper expires overdue reservations with a conditional transition,
  returns the stock and publishes `stock_reservation_expired`; `order-service` cancels the
  order unless it is already paid. A payment approved after expiry re-acquires stock with
  the same conditional update.
- **Proof:** the same failure now ends `CANCELLED (RESERVATION_EXPIRED)` with stock
  restored. `scripts/chaos/reservation-expiry.sh` runs it in CI.

## 8. A critical vulnerability hidden in a lockfile

- **Symptom:** none visible.
- **Evidence:** adding `npm audit --omit=dev --audit-level=high` to CI reported 1 critical
  advisory (`fast-jwt`: verifier cache accepting expired JWTs) and 10 high ones in
  `user-service` and `catalog-service`.
- **Fix:** non-breaking lockfile updates; the audit now gates every service in CI.

## 9. The tooling was lying

- **Symptom:** the demo catalog was empty although the seed script printed "success",
  and test products later polluted the storefront.
- **Root cause:** the seed read `token` instead of `tokenJwt`, skipped every product and
  still reported success; the E2E suite never cleaned up what it created.
- **Fix:** the seed fails loudly (`exit 1`) and checks each effect; the E2E suite
  soft-deletes its own products.

---

## Lessons

1. **Unit tests with fakes cannot prove distributed behavior.** Races, duplicate
   delivery, broker outages and gateway behavior were only caught against real
   infrastructure.
2. **Reproduce first.** Every fix above started with an experiment that showed the
   failure and ended with the same experiment passing.
3. **The worst failures are silent:** a service "up" without messaging, a script that
   reports success without effect, a Saga that approves everything.
4. **Every intermediate state needs a guaranteed exit**: compensation, confirmation or
   expiry.
