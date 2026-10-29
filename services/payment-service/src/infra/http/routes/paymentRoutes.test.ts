import Fastify, { type FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

beforeEach(async () => {
  repo = new InMemoryPaymentRepository();
  const controller = new PaymentController(
    new ProcessPaymentUseCase(repo),
    new GetPaymentByOrderIdUseCase(repo)
  );
  app = Fastify();
  await app.register(async (api) => registerPaymentRoutes(api, controller), { prefix: '/api' });
  await app.ready();
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
