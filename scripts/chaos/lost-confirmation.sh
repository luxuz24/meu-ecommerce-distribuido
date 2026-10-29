#!/usr/bin/env bash
# Chaos test: a PAID order whose confirmation never reached inventory must not have
# its units put back on sale when the reservation expires.
#
# A normal order is placed and paid. Then the database is put in the exact state of a
# lost order_confirmed (e.g. dead-lettered): the reservation goes back to RESERVED,
# already overdue, with its units counted as reserved again. The sweeper expires it and
# returns the units to availableQty; order-service sees the order is PAID and replays
# ORDER_CONFIRMED; inventory re-acquires the stock through the late-confirmation path.
# Expected final state: order PAID, reservation CONFIRMED, units deducted exactly once.
#
# Requires a short sweep interval (RESERVATION_SWEEP_INTERVAL_MS=2000). For a
# non-default Compose project, export COMPOSE_PROJECT_NAME.
set -euo pipefail

GW="${API_GATEWAY_URL:-http://localhost:8080}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@microstore.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-AdminPassword123!}"
TIMEOUT_S="${CHAOS_TIMEOUT_SECONDS:-90}"
RUN="CHAOS-LOST-$(date +%s)"
QTY=2
INITIAL=10

psql_inventory() { docker compose exec -T postgres psql -U "${POSTGRES_USER:-postgres}" -d inventory_db -qtAc "$1"; }
json() { curl -sf -H 'Content-Type: application/json' "$@"; }

admin=$(json -X POST "$GW/login" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | jq -r .tokenJwt)
email="chaos-$RANDOM@microstore.test"
json -X POST "$GW/users" -d "{\"name\":\"Chaos\",\"email\":\"$email\",\"password\":\"Chaos12345!\"}" >/dev/null
customer=$(json -X POST "$GW/login" -d "{\"email\":\"$email\",\"password\":\"Chaos12345!\"}" | jq -r .tokenJwt)

product=$(json -X POST "$GW/api/products" -H "Authorization: Bearer $admin" \
  -d "{\"name\":\"Chaos $RUN\",\"description\":\"chaos test product\",\"sku\":\"$RUN\",\"price\":10,\"stock\":$INITIAL}" | jq -r .id)
json -X POST "$GW/api/inventory/seed" -H "Authorization: Bearer $admin" \
  -d "{\"productId\":\"$product\",\"sku\":\"$RUN\",\"availableQty\":$INITIAL}" >/dev/null

order=$(json -X POST "$GW/api/orders" -H "Authorization: Bearer $customer" \
  -d "{\"items\":[{\"productId\":\"$product\",\"quantity\":$QTY}]}" | jq -r .id)

wait_for() { # $1 = SQL returning 't' when the condition holds
  local deadline=$((SECONDS + TIMEOUT_S))
  until [ "$(psql_inventory "$1")" = "t" ]; do
    [ $SECONDS -ge $deadline ] && return 1
    sleep 1
  done
}

wait_for "select status = 'CONFIRMED' from stock_reservations where \"orderId\" = '$order'" \
  || { echo "FAIL: order never got confirmed in the first place" >&2; exit 1; }
echo "Order paid and confirmed. Simulating a lost order_confirmed..."

psql_inventory "begin;
  update stock_reservations set status = 'RESERVED', \"expiresAt\" = now() - interval '1 second'
   where \"orderId\" = '$order';
  update inventory_items set \"reservedQty\" = \"reservedQty\" + $QTY where sku = '$RUN';
commit;" >/dev/null

wait_for "select status = 'CONFIRMED' from stock_reservations where \"orderId\" = '$order'" || true

reservation=$(psql_inventory "select status from stock_reservations where \"orderId\" = '$order'")
stock=$(curl -sf "$GW/api/inventory/$RUN" | jq -r '"\(.availableQty)/\(.reservedQty)"')
status=$(curl -sf "$GW/api/orders/$order" -H "Authorization: Bearer $customer" | jq -r .status)
curl -sf -o /dev/null -X DELETE "$GW/api/products/$product" -H "Authorization: Bearer $admin" || true

expected="$((INITIAL - QTY))/0"
echo "order=$status reservation=$reservation stock(available/reserved)=$stock expected=$expected"
if [ "$status" = "PAID" ] && [ "$reservation" = "CONFIRMED" ] && [ "$stock" = "$expected" ]; then
  echo "PASS: paid order kept its units after the reservation expired"
else
  echo "FAIL: sold units were put back on sale" >&2
  exit 1
fi
