import Fastify, { type FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type IPaymentRepository } from '../../../domain/repositories/IPaymentRepository.js';
import { InMemoryPaymentRepository } from '../../../test-support/InMemoryPaymentRepository.js';
import { GetPaymentByOrderIdUseCase, ProcessPaymentUseCase } from '../../../use-cases/PaymentUseCases.js';
import { PaymentController } from '../controllers/PaymentController.js';
import { registerPaymentRoutes } from './paymentRoutes.js';

const SECRET = 'test-secret';
const token = (userId: string, role: 'CUSTOMER' | 'ADMIN') =>
  `Bearer ${jwt.sign({ userId, email: `${userId}@test`, role }, SECRET, { algorithm: 'HS256', expiresIn: '1h' })}`;
const ADMIN = token('admin-1', 'ADMIN');
const OWNER = token('owner-1', 'CUSTOMER');
const OTHER = token('other-1', 'CUSTOMER');

let app: FastifyInstance;
let repo: InMemoryPaymentRepository;

beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
});
afterAll(() => {
  delete process.env.JWT_SECRET;
});

async function buildApp(repository: IPaymentRepository): Promise<FastifyInstance> {
  const controller = new PaymentController(
    new ProcessPaymentUseCase(repository),
    new GetPaymentByOrderIdUseCase(repository)
  );
  const instance = Fastify();
  await instance.register(async (api) => registerPaymentRoutes(api, controller), { prefix: '/api' });
  await instance.ready();
  return instance;
}

beforeEach(async () => {
  repo = new InMemoryPaymentRepository();
  app = await buildApp(repo);
});

const process_ = (body: unknown, authorization?: string) =>
  app.inject({
    method: 'POST',
    url: '/api/payments/process',
    payload: body as object,
    headers: authorization ? { authorization } : {},
  });
const get = (orderId: string, authorization?: string) =>
  app.inject({ method: 'GET', url: `/api/payments/${orderId}`, headers: authorization ? { authorization } : {} });

describe('POST /api/payments/process (admin only)', () => {
  it.each([
    ['anonymous', undefined, 401],
    ['malformed token', 'Bearer not-a-jwt', 401],
    ['wrong scheme', OWNER.replace('Bearer', 'Basic'), 401],
    ['customer', OWNER, 403],
  ])('%s → %i and nothing is processed', async (_label, auth, status) => {
    const res = await process_({ orderId: 'o1', userId: 'owner-1', amount: 10 }, auth);
    expect(res.statusCode).toBe(status);
    expect(repo.outboxEvents).toHaveLength(0);
  });

  it('admin processes a payment', async () => {
    const res = await process_({ orderId: 'o1', userId: 'owner-1', amount: 10 }, ADMIN);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ event: 'PAYMENT_APPROVED', payment: { orderId: 'o1', status: 'APPROVED' } });
  });

  it.each([
    ['orderId only with spaces', { orderId: '   ', userId: 'owner-1', amount: 10 }],
    ['missing owner', { orderId: 'o1', amount: 10 }],
    ['empty messageId (would silently disable idempotency)', { orderId: 'o1', userId: 'owner-1', amount: 10, messageId: '' }],
    ['negative amount', { orderId: 'o1', userId: 'owner-1', amount: -1 }],
  ])('rejects %s with 400 (never 500, never processed)', async (_label, body) => {
    const res = await process_(body, ADMIN);
    expect(res.statusCode).toBe(400);
    expect(repo.outboxEvents).toHaveLength(0);
  });

  it('discards unknown fields instead of acting on them', async () => {
    const res = await process_({ orderId: 'o1', userId: 'owner-1', amount: 10, status: 'FAILED' }, ADMIN);
    expect(res.statusCode).toBe(200);
    expect(res.json().payment.status).toBe('APPROVED');
  });

  it('fails with 500 when the server has no JWT secret', async () => {
    delete process.env.JWT_SECRET;
    try {
      expect((await process_({ orderId: 'o1', userId: 'u', amount: 1 }, ADMIN)).statusCode).toBe(500);
    } finally {
      process.env.JWT_SECRET = SECRET;
    }
  });
});

describe('GET /api/payments/:orderId (owner or admin)', () => {
  beforeEach(async () => {
    await process_({ orderId: 'o-owned', userId: 'owner-1', amount: 25 }, ADMIN);
  });

  it.each([
    ['owner', OWNER, 200],
    ['admin', ADMIN, 200],
    ['another customer', OTHER, 403],
    ['anonymous', undefined, 401],
  ])('%s → %i', async (_label, auth, status) => {
    const res = await get('o-owned', auth);
    expect(res.statusCode).toBe(status);
    if (status === 200) expect(res.json()).toMatchObject({ orderId: 'o-owned', amount: 25, userId: 'owner-1' });
  });

  it('unknown order → 404', async () => {
    expect((await get('nope', OWNER)).statusCode).toBe(404);
  });
});

describe('authentication edge cases', () => {
  const rawJwt = OWNER.slice('Bearer '.length);

  it('accepts extra spaces around the token', async () => {
    await process_({ orderId: 'o-sp', userId: 'owner-1', amount: 1 }, ADMIN);
    expect((await get('o-sp', `Bearer   ${rawJwt}  `)).statusCode).toBe(200);
  });

  it('rejects a valid token sent with another 7-character scheme prefix', async () => {
    await process_({ orderId: 'o-sch', userId: 'owner-1', amount: 1 }, ADMIN);
    expect((await get('o-sch', `Basic  ${rawJwt}`)).statusCode).toBe(401);
  });

  it.each([
    ['token without userId', jwt.sign({ email: 'x@test', role: 'ADMIN' }, SECRET)],
    ['token whose payload is a plain string', jwt.sign('just-a-string', SECRET)],
    ['token signed with another secret', jwt.sign({ userId: 'u', role: 'ADMIN' }, 'other-secret')],
    ['expired token', jwt.sign({ userId: 'u', role: 'ADMIN' }, SECRET, { expiresIn: -10 })],
    ['token signed with another HMAC algorithm (HS384)', jwt.sign({ userId: 'u', role: 'ADMIN' }, SECRET, { algorithm: 'HS384' })],
  ])('rejects a %s', async (_label, signed) => {
    const res = await process_({ orderId: 'o', userId: 'u', amount: 1 }, `Bearer ${signed}`);
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'UNAUTHORIZED: Invalid or missing Bearer token' });
  });

  it('explains authorization failures in the response body', async () => {
    expect((await process_({ orderId: 'o', userId: 'u', amount: 1 }, OWNER)).json()).toEqual({
      error: 'FORBIDDEN: Admin privileges required',
    });
    expect((await get('x')).json()).toEqual({ error: 'UNAUTHORIZED: Invalid or missing Bearer token' });
  });

  it('fails closed with 500 on both routes when the JWT secret is missing', async () => {
    delete process.env.JWT_SECRET;
    try {
      expect((await get('x', OWNER)).statusCode).toBe(500);
      const res = await process_({ orderId: 'o', userId: 'u', amount: 1 }, ADMIN);
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({ error: 'Internal Server Error' });
    } finally {
      process.env.JWT_SECRET = SECRET;
    }
  });
});

describe('input boundaries (schema)', () => {
  const ok = { orderId: 'o-b', userId: 'owner-1', amount: 10 };

  it.each([
    ['orderId at 100 chars', { ...ok, orderId: 'x'.repeat(100) }, 200],
    ['orderId at 101 chars', { ...ok, orderId: 'x'.repeat(101) }, 400],
    ['amount at the maximum', { ...ok, amount: 10_000_000 }, 200],
    ['amount above the maximum', { ...ok, amount: 10_000_000.01 }, 400],
    ['unknown simulation outcome', { ...ok, simulateOutcome: 'MAYBE' }, 400],
    ['failureReason at 250 chars', { ...ok, simulateOutcome: 'FAILED', failureReason: 'r'.repeat(250) }, 200],
    ['failureReason at 251 chars', { ...ok, failureReason: 'r'.repeat(251) }, 400],
    ['empty userId', { ...ok, userId: '' }, 400],
    ['userId at 120 chars', { ...ok, userId: 'u'.repeat(120) }, 200],
    ['userId at 121 chars', { ...ok, userId: 'u'.repeat(121) }, 400],
    ['APPROVED simulation below the limit', { ...ok, simulateOutcome: 'APPROVED' }, 200],
    ['messageId at 121 chars', { ...ok, messageId: 'm'.repeat(121) }, 400],
  ])('%s → %i', async (_label, body, status) => {
    expect((await process_(body, ADMIN)).statusCode).toBe(status);
  });

  it('can read back the longest order id the POST route accepts', async () => {
    const longest = 'x'.repeat(100);
    await process_({ ...ok, orderId: longest }, ADMIN);
    expect((await get(longest, ADMIN)).statusCode).toBe(200);
  });

  it('returns the domain message for invalid input', async () => {
    expect((await process_({ orderId: '  ', userId: 'u', amount: 1 }, ADMIN)).json()).toEqual({
      error: 'INVALID_PAYMENT: orderId is required',
    });
  });
});

describe('unexpected failures', () => {
  const broken: IPaymentRepository = {
    findByOrderId: async () => {
      throw new Error('db down');
    },
    processWithOutbox: async () => {
      throw new Error('db down');
    },
  };

  it('turns repository failures into 500 (never into 400/403/404)', async () => {
    const failing = await buildApp(broken);
    expect((await failing.inject({ method: 'GET', url: '/api/payments/o', headers: { authorization: OWNER } })).statusCode).toBe(500);
    expect(
      (await failing.inject({
        method: 'POST', url: '/api/payments/process', headers: { authorization: ADMIN },
        payload: { orderId: 'o', userId: 'u', amount: 1 },
      })).statusCode
    ).toBe(500);
  });

  it('returns the not-found message in the body', async () => {
    expect((await get('missing', OWNER)).json()).toEqual({ error: 'PAYMENT_NOT_FOUND: No payment found for order missing' });
  });

  it('returns the access-denied message in the body', async () => {
    await process_({ orderId: 'o-deny', userId: 'owner-1', amount: 1 }, ADMIN);
    expect((await get('o-deny', OTHER)).json()).toEqual({
      error: 'FORBIDDEN_PAYMENT_ACCESS: You do not have permission to view the payment of order o-deny',
    });
  });
});

describe('PaymentController without the auth middleware', () => {
  it('answers 401 instead of crashing when a route is wired without authentication', async () => {
    const controller = new PaymentController(new ProcessPaymentUseCase(repo), new GetPaymentByOrderIdUseCase(repo));
    const sent: { status?: number; body?: unknown } = {};
    const reply = {
      status(code: number) { sent.status = code; return this; },
      send(body: unknown) { sent.body = body; return this; },
    };
    await controller.getByOrderId(
      { params: { orderId: 'o' } } as Parameters<PaymentController['getByOrderId']>[0],
      reply as unknown as Parameters<PaymentController['getByOrderId']>[1]
    );
    expect(sent).toEqual({ status: 401, body: { error: 'UNAUTHORIZED' } });
  });
});

