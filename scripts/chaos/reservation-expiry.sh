#!/usr/bin/env bash
# Chaos test: a Saga step that never answers must not lock stock forever.
#
# Injects a failure in payment-service's database (renames the payments table),
# so the stock_reserved message is dead-lettered. Without reservation expiry the
# order would stay STOCK_RESERVED and the units would stay reserved indefinitely.
# Expected: after RESERVATION_TTL_SECONDS the reservation expires, stock returns
# and the order is CANCELLED with reason RESERVATION_EXPIRED.
#
# Requires the stack running with a short TTL, e.g.:
#   RESERVATION_TTL_SECONDS=15 RESERVATION_SWEEP_INTERVAL_MS=2000 docker compose up -d --wait
# For a non-default Compose project, export COMPOSE_PROJECT_NAME so `docker compose exec`
# reaches the right postgres container.
set -euo pipefail

GW="${API_GATEWAY_URL:-http://localhost:8080}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@microstore.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-AdminPassword123!}"
TIMEOUT_S="${CHAOS_TIMEOUT_SECONDS:-90}"
RUN="CHAOS-$(date +%s)"

psql_payment() { docker compose exec -T postgres psql -U "${POSTGRES_USER:-postgres}" -d payment_db -qtAc "$1"; }
json() { curl -sf -H 'Content-Type: application/json' "$@"; }

restore() { psql_payment 'ALTER TABLE IF EXISTS payments_offline RENAME TO payments' >/dev/null 2>&1 || true; }
trap restore EXIT

admin=$(json -X POST "$GW/login" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | jq -r .tokenJwt)
email="chaos-$RANDOM@microstore.test"
json -X POST "$GW/users" -d "{\"name\":\"Chaos\",\"email\":\"$email\",\"password\":\"Chaos12345!\"}" >/dev/null
customer=$(json -X POST "$GW/login" -d "{\"email\":\"$email\",\"password\":\"Chaos12345!\"}" | jq -r .tokenJwt)

product=$(json -X POST "$GW/api/products" -H "Authorization: Bearer $admin" \
  -d "{\"name\":\"Chaos $RUN\",\"description\":\"chaos test product\",\"sku\":\"$RUN\",\"price\":10,\"stock\":5}" | jq -r .id)
json -X POST "$GW/api/inventory/seed" -H "Authorization: Bearer $admin" \
  -d "{\"productId\":\"$product\",\"sku\":\"$RUN\",\"availableQty\":5}" >/dev/null

echo "Injecting failure: payment-service database unavailable"
psql_payment 'ALTER TABLE payments RENAME TO payments_offline'
order=$(json -X POST "$GW/api/orders" -H "Authorization: Bearer $customer" \
  -d "{\"items\":[{\"productId\":\"$product\",\"quantity\":3}]}" | jq -r .id)
sleep 5
restore
echo "Failure removed; payment message is already in the DLQ. Waiting for reservation expiry..."

deadline=$((SECONDS + TIMEOUT_S))
status=""
while [ $SECONDS -lt $deadline ]; do
  read -r status reason < <(curl -sf "$GW/api/orders/$order" -H "Authorization: Bearer $customer" \
    | jq -r '"\(.status) \(.cancelReason // "-")"')
  [ "$status" = "CANCELLED" ] && break
  sleep 2
done

stock=$(curl -sf "$GW/api/inventory/$RUN" | jq -r '"\(.availableQty)/\(.reservedQty)"')
curl -sf -o /dev/null -X DELETE "$GW/api/products/$product" -H "Authorization: Bearer $admin" || true

echo "order=$status reason=$reason stock(available/reserved)=$stock"
if [ "$status" = "CANCELLED" ] && [ "$reason" = "RESERVATION_EXPIRED" ] && [ "$stock" = "5/0" ]; then
  echo "PASS: stuck reservation expired, stock returned, order cancelled"
else
  echo "FAIL: expected CANCELLED / RESERVATION_EXPIRED / 5/0" >&2
  exit 1
fi
