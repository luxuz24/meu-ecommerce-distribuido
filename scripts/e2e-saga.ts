/**
 * Testes ponta a ponta da Saga coreografada, executados contra a stack real
 * (docker compose) e exclusivamente através do API Gateway.
 *
 * Cada execução cria seus próprios produtos com SKU único, então os cenários são
 * independentes entre si e do estado deixado por execuções anteriores.
 *
 * Uso: docker compose up -d --build --wait && npm run test:e2e
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const GATEWAY = process.env.API_GATEWAY_URL || 'http://localhost:8080';
const ADMIN = {
  email: process.env.ADMIN_EMAIL || 'admin@microstore.com',
  password: process.env.ADMIN_PASSWORD || 'AdminPassword123!',
};
const SAGA_TIMEOUT_MS = 30_000;
const RUN_ID = Date.now().toString(36).toUpperCase();

type OrderStatus = 'PENDING' | 'STOCK_RESERVED' | 'PAID' | 'CANCELLED';
interface Order {
  id: string;
  status: OrderStatus;
  total: number;
  cancelReason: string | null;
  items: Array<{ sku: string; name: string; price: number; quantity: number }>;
}
interface Stock {
  availableQty: number;
  reservedQty: number;
}

// ---------------------------------------------------------------- HTTP helpers

async function call<T = unknown>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  opts: { body?: unknown; token?: string; correlationId?: string } = {}
): Promise<{ status: number; data: T; headers: Headers }> {
  // Cliente bem-comportado: respeita o rate limit do gateway (429 + Retry-After)
  for (let attempt = 1; ; attempt++) {
    const res = await rawCall(method, path, opts);
    if (res.status !== 429 || attempt >= 6) return res as { status: number; data: T; headers: Headers };
    const retryAfterMs = Number(res.headers.get('retry-after') ?? 1) * 1000;
    await new Promise((r) => setTimeout(r, retryAfterMs * attempt));
  }
}

async function rawCall(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  opts: { body?: unknown; token?: string; correlationId?: string }
): Promise<{ status: number; data: unknown; headers: Headers }> {
  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: {
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...(opts.correlationId ? { 'X-Correlation-ID': opts.correlationId } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null, headers: res.headers };
}

async function login(email: string, password: string): Promise<string> {
  const res = await call<{ tokenJwt: string }>('POST', '/login', { body: { email, password } });
  assert.equal(res.status, 200, `login de ${email} falhou (HTTP ${res.status})`);
  return res.data.tokenJwt;
}

async function newCustomer(): Promise<string> {
  const email = `e2e-${randomUUID().slice(0, 8)}@microstore.test`;
  const password = 'E2ePassword123!';
  const res = await call('POST', '/users', { body: { name: 'E2E Customer', email, password } });
  assert.equal(res.status, 201, `cadastro do cliente falhou (HTTP ${res.status})`);
  return login(email, password);
}

let skuCounter = 0;
const createdProductIds: string[] = [];
async function newProduct(
  adminToken: string,
  price: number,
  stock: number
): Promise<{ id: string; sku: string; price: number }> {
  const sku = `E2E-${RUN_ID}-${++skuCounter}`;
  const created = await call<{ id: string }>('POST', '/api/products', {
    token: adminToken,
    body: { name: `Produto ${sku}`, description: 'Produto do teste E2E', sku, price, stock },
  });
  assert.equal(created.status, 201, `criação do produto falhou (HTTP ${created.status})`);
  createdProductIds.push(created.data.id);

  const seeded = await call('POST', '/api/inventory/seed', {
    token: adminToken,
    body: { productId: created.data.id, sku, availableQty: stock },
  });
  assert.ok(seeded.status < 300, `seed de estoque falhou (HTTP ${seeded.status})`);
  return { id: created.data.id, sku, price };
}

async function placeOrder(
  token: string,
  body: Record<string, unknown>,
  correlationId?: string
): Promise<{ order: Order; correlationId: string | null }> {
  const res = await call<Order>('POST', '/api/orders', {
    token,
    body,
    ...(correlationId ? { correlationId } : {}),
  });
  assert.equal(res.status, 201, `criação do pedido falhou (HTTP ${res.status}): ${JSON.stringify(res.data)}`);
  return { order: res.data, correlationId: res.headers.get('x-correlation-id') };
}

async function waitForFinalStatus(token: string, orderId: string): Promise<Order> {
  const deadline = Date.now() + SAGA_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await call<Order>('GET', `/api/orders/${orderId}`, { token });
    if (res.data.status === 'PAID' || res.data.status === 'CANCELLED') return res.data;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`pedido ${orderId} não concluiu a Saga em ${SAGA_TIMEOUT_MS / 1000}s`);
}

/** Aguarda vários pedidos consultando a listagem do cliente (1 requisição por ciclo). */
async function waitForAllFinal(token: string, orderIds: string[]): Promise<Order[]> {
  const deadline = Date.now() + SAGA_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await call<{ items: Order[] }>('GET', '/api/orders', { token });
    const mine = res.data.items.filter((o) => orderIds.includes(o.id));
    if (mine.length === orderIds.length && mine.every((o) => o.status === 'PAID' || o.status === 'CANCELLED')) {
      return mine;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${orderIds.length} pedidos não concluíram a Saga em ${SAGA_TIMEOUT_MS / 1000}s`);
}

async function stockOf(sku: string): Promise<Stock> {
  const res = await call<Stock>('GET', `/api/inventory/${sku}`);
  assert.equal(res.status, 200);
  return { availableQty: res.data.availableQty, reservedQty: res.data.reservedQty };
}

// ---------------------------------------------------------------- runner

const scenarios: Array<{ name: string; run: () => Promise<void> }> = [];
const scenario = (name: string, run: () => Promise<void>) => scenarios.push({ name, run });

let adminToken = '';
let customerToken = '';

scenario('Caminho feliz: pedido é pago e a reserva vira baixa definitiva', async () => {
  const product = await newProduct(adminToken, 120.5, 10);
  const { order } = await placeOrder(customerToken, {
    items: [{ productId: product.id, quantity: 2 }],
  });
  assert.equal(order.status, 'PENDING', 'pedido nasce PENDING (Saga assíncrona)');

  const final = await waitForFinalStatus(customerToken, order.id);
  assert.equal(final.status, 'PAID');
  assert.equal(final.total, 241);

  const payment = await call<{ status: string; amount: number }>(
    'GET',
    `/api/payments/${order.id}`,
    { token: adminToken }
  );
  assert.equal(payment.data.status, 'APPROVED');
  assert.equal(payment.data.amount, 241, 'payment-service cobra o total calculado pelo servidor');

  // Pequena folga para o consumer de order_confirmed no inventory
  await new Promise((r) => setTimeout(r, 1500));
  assert.deepEqual(await stockOf(product.sku), { availableQty: 8, reservedQty: 0 });
});

scenario('Compensação: pagamento recusado cancela o pedido e estorna o estoque', async () => {
  const product = await newProduct(adminToken, 99.9, 5);
  const { order } = await placeOrder(customerToken, {
    items: [{ productId: product.id, quantity: 3 }],
    simulatePaymentFailure: true,
  });

  const final = await waitForFinalStatus(customerToken, order.id);
  assert.equal(final.status, 'CANCELLED');
  assert.equal(final.cancelReason, 'DECLINED_BY_ISSUER_OR_RISK_LIMIT');

  await new Promise((r) => setTimeout(r, 1500));
  assert.deepEqual(
    await stockOf(product.sku),
    { availableQty: 5, reservedQty: 0 },
    'estoque reservado deve voltar integralmente'
  );
});

scenario('Falta de estoque: inventory rejeita e o pedido é cancelado sem cobrança', async () => {
  const product = await newProduct(adminToken, 50, 2);
  const { order } = await placeOrder(customerToken, {
    items: [{ productId: product.id, quantity: 5 }],
  });

  const final = await waitForFinalStatus(customerToken, order.id);
  assert.equal(final.status, 'CANCELLED');
  assert.equal(final.cancelReason, `INSUFFICIENT_STOCK:${product.sku}`);

  const payment = await call('GET', `/api/payments/${order.id}`, { token: adminToken });
  assert.equal(payment.status, 404, 'nenhuma cobrança deve existir para pedido sem estoque');
  assert.deepEqual(await stockOf(product.sku), { availableQty: 2, reservedQty: 0 });
});

scenario('Regra antifraude: compra acima de R$ 50.000 é recusada pelo payment-service', async () => {
  const product = await newProduct(adminToken, 30_000, 5);
  const { order } = await placeOrder(customerToken, {
    items: [{ productId: product.id, quantity: 2 }],
  });

  const final = await waitForFinalStatus(customerToken, order.id);
  assert.equal(final.status, 'CANCELLED');
  await new Promise((r) => setTimeout(r, 1500));
  assert.deepEqual(await stockOf(product.sku), { availableQty: 5, reservedQty: 0 });
});

scenario('Integridade de preço: preço/nome/SKU enviados pelo cliente são ignorados', async () => {
  const product = await newProduct(adminToken, 1899, 3);
  const { order } = await placeOrder(customerToken, {
    items: [{ productId: product.id, quantity: 1, price: 0.01, name: 'Hack', sku: 'FAKE-SKU' }],
  });

  assert.equal(order.total, 1899);
  assert.equal(order.items[0]?.price, 1899);
  assert.equal(order.items[0]?.sku, product.sku);
  await waitForFinalStatus(customerToken, order.id);
});

scenario('Concorrência: 12 pedidos simultâneos por 4 unidades não geram overselling', async () => {
  const product = await newProduct(adminToken, 10, 4);
  const orders = await Promise.all(
    Array.from({ length: 12 }, () =>
      placeOrder(customerToken, { items: [{ productId: product.id, quantity: 1 }] })
    )
  );
  const finals = await waitForAllFinal(
    customerToken,
    orders.map(({ order }) => order.id)
  );

  const paid = finals.filter((o) => o.status === 'PAID').length;
  assert.equal(paid, 4, `exatamente 4 pedidos devem ser pagos (pagos: ${paid})`);
  await new Promise((r) => setTimeout(r, 1500));
  assert.deepEqual(await stockOf(product.sku), { availableQty: 0, reservedQty: 0 });
});

scenario('Rastreabilidade: o X-Correlation-ID do cliente atravessa o gateway', async () => {
  const product = await newProduct(adminToken, 15, 2);
  const correlationId = `e2e-${randomUUID()}`;
  const { order, correlationId: echoed } = await placeOrder(
    customerToken,
    { items: [{ productId: product.id, quantity: 1 }] },
    correlationId
  );
  assert.equal(echoed, correlationId);
  await waitForFinalStatus(customerToken, order.id);
});

scenario('Segurança: cadastro público não concede ADMIN nem permite forçar a Saga', async () => {
  const email = `e2e-escalation-${randomUUID().slice(0, 8)}@microstore.test`;
  const reg = await call<{ role: string }>('POST', '/users', {
    body: { name: 'Intruso', email, password: 'Intruso123!', role: 'ADMIN' },
  });
  assert.equal(reg.data.role, 'CUSTOMER');

  const product = await newProduct(adminToken, 25, 1);
  const { order } = await placeOrder(customerToken, {
    items: [{ productId: product.id, quantity: 1 }],
    simulatePaymentFailure: true,
  });
  const forced = await call('PATCH', `/api/orders/${order.id}/saga-event`, {
    token: customerToken,
    body: { eventType: 'PAYMENT_APPROVED' },
  });
  assert.equal(forced.status, 403, 'cliente não pode transicionar a Saga manualmente');
  assert.equal((await waitForFinalStatus(customerToken, order.id)).status, 'CANCELLED');

  const directPayment = await call('POST', '/api/payments/process', {
    token: customerToken,
    body: { orderId: order.id, amount: 1 },
  });
  assert.equal(directPayment.status, 403, 'endpoints internos exigem ADMIN');
});

async function main(): Promise<void> {
  console.log(`E2E Saga — gateway ${GATEWAY} — run ${RUN_ID}\n`);
  adminToken = await login(ADMIN.email, ADMIN.password);
  customerToken = await newCustomer();

  let failed = 0;
  for (const { name, run } of scenarios) {
    const started = Date.now();
    try {
      await run();
      console.log(`  ✓ ${name} (${Date.now() - started}ms)`);
    } catch (err) {
      failed += 1;
      console.log(`  ✗ ${name}\n      ${(err as Error).message.split('\n').join('\n      ')}`);
    }
  }

  // Limpeza: soft delete dos produtos de teste para não poluir a vitrine da demo
  const cleanup = await Promise.all(
    createdProductIds.map((id) => call('DELETE', `/api/products/${id}`, { token: adminToken }))
  );
  const notCleaned = cleanup.filter((r) => r.status !== 204).length;
  if (notCleaned > 0) console.warn(`  ! ${notCleaned} produto(s) de teste não foram desativados`);

  console.log(`\n${scenarios.length - failed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err: Error) => {
  console.error(`✗ Falha de setup: ${err.message}`);
  process.exit(1);
});
