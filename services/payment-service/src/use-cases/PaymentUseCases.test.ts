import { describe, it, expect, beforeEach } from 'vitest';
import {
  InvalidPaymentError,
  PaymentAccessDeniedError,
  PaymentNotFoundError,
} from '../domain/errors/PaymentErrors.js';
import { InMemoryPaymentRepository } from '../test-support/InMemoryPaymentRepository.js';
import {
  ANTI_FRAUD_LIMIT,
  GetPaymentByOrderIdUseCase,
  ProcessPaymentUseCase,
} from './PaymentUseCases.js';

describe('Payment Service Use Cases & Saga Compensation', () => {
  let repo: InMemoryPaymentRepository;
  let processPaymentUseCase: ProcessPaymentUseCase;
  let getPaymentByOrderIdUseCase: GetPaymentByOrderIdUseCase;

  beforeEach(() => {
    repo = new InMemoryPaymentRepository();
    processPaymentUseCase = new ProcessPaymentUseCase(repo);
    getPaymentByOrderIdUseCase = new GetPaymentByOrderIdUseCase(repo);
  });

  it('should approve payment and emit PAYMENT_APPROVED to outbox', async () => {
    const res = await processPaymentUseCase.execute({
      orderId: 'order-501',
      userId: 'user-501',
      amount: 549.9,
      messageId: 'msg-stock-501',
    });

    expect(res.event).toBe('PAYMENT_APPROVED');
    expect(res.payment.status).toBe('APPROVED');
    expect(repo.outboxEvents).toHaveLength(1);
    expect(repo.outboxEvents[0]?.eventType).toBe('PAYMENT_APPROVED');

    const stored = await getPaymentByOrderIdUseCase.execute('order-501', { userId: 'user-501', role: 'CUSTOMER' });
    expect(stored.amount).toBe(549.9);
  });

  it('should decline payment when simulateOutcome is FAILED and emit PAYMENT_FAILED', async () => {
    const res = await processPaymentUseCase.execute({
      orderId: 'order-502',
      userId: 'user-502',
      amount: 1299.0,
      simulateOutcome: 'FAILED',
      failureReason: 'INSUFFICIENT_CARD_LIMIT',
    });

    expect(res.event).toBe('PAYMENT_FAILED');
    expect(res.payment.status).toBe('FAILED');
    expect(res.payment.failureReason).toBe('INSUFFICIENT_CARD_LIMIT');
    expect(repo.outboxEvents[0]?.eventType).toBe('PAYMENT_FAILED');
  });

  it('should enforce idempotency on duplicate STOCK_RESERVED messageId', async () => {
    await processPaymentUseCase.execute({
      orderId: 'order-503',
      userId: 'user-503',
      amount: 299.0,
      messageId: 'msg-dup-503',
    });

    const dup = await processPaymentUseCase.execute({
      orderId: 'order-503',
      userId: 'user-503',
      amount: 299.0,
      messageId: 'msg-dup-503',
    });

    expect(dup.event).toBe('ALREADY_PROCESSED');
    expect(repo.outboxEvents).toHaveLength(1);
  });

  it('should throw PaymentNotFoundError when querying non-existent orderId', async () => {
    await expect(
      getPaymentByOrderIdUseCase.execute('unknown-order', { userId: 'u1', role: 'ADMIN' })
    ).rejects.toThrow(PaymentNotFoundError);
  });

  it('should let only the payment owner or an ADMIN read a payment (anti-IDOR)', async () => {
    await processPaymentUseCase.execute({ orderId: 'ord-owned', userId: 'owner', amount: 100 });

    const ownView = await getPaymentByOrderIdUseCase.execute('ord-owned', { userId: 'owner', role: 'CUSTOMER' });
    expect(ownView.orderId).toBe('ord-owned');

    const adminView = await getPaymentByOrderIdUseCase.execute('ord-owned', { userId: 'ops', role: 'ADMIN' });
    expect(adminView.orderId).toBe('ord-owned');

    await expect(
      getPaymentByOrderIdUseCase.execute('ord-owned', { userId: 'intruder', role: 'CUSTOMER' })
    ).rejects.toThrow(PaymentAccessDeniedError);
  });

  // Tabela de decisão da regra antifraude: (simulação, valor) → resultado
  it.each([
    ['sem simulação, abaixo do limite → APPROVED', undefined, 100, 'APPROVED'],
    ['sem simulação, no limite exato → APPROVED', undefined, ANTI_FRAUD_LIMIT, 'APPROVED'],
    ['sem simulação, 1 centavo acima → FAILED', undefined, ANTI_FRAUD_LIMIT + 0.01, 'FAILED'],
    ['simulação FAILED, valor baixo → FAILED', 'FAILED', 100, 'FAILED'],
    ['simulação APPROVED, valor baixo → APPROVED', 'APPROVED', 100, 'APPROVED'],
    ['simulação APPROVED acima do limite → FAILED (não fura o antifraude)', 'APPROVED', 60000, 'FAILED'],
  ] as const)('decisão: %s', async (_label, simulateOutcome, amount, expected) => {
    const res = await processPaymentUseCase.execute({
      orderId: `ord-${amount}-${simulateOutcome ?? 'none'}`,
      userId: 'u1',
      amount,
      ...(simulateOutcome ? { simulateOutcome } : {}),
    });
    expect(res.payment.status).toBe(expected);
    expect(res.event).toBe(expected === 'APPROVED' ? 'PAYMENT_APPROVED' : 'PAYMENT_FAILED');
  });

  it('uses the default decline reason unless one is provided, and none when approved', async () => {
    const declined = await processPaymentUseCase.execute({ orderId: 'r1', userId: 'u', amount: 60000 });
    expect(declined.payment.failureReason).toBe('DECLINED_BY_ISSUER_OR_RISK_LIMIT');

    const custom = await processPaymentUseCase.execute({
      orderId: 'r2', userId: 'u', amount: 1, simulateOutcome: 'FAILED', failureReason: 'CARD_EXPIRED',
    });
    expect(custom.payment.failureReason).toBe('CARD_EXPIRED');

    const approved = await processPaymentUseCase.execute({
      orderId: 'r3', userId: 'u', amount: 1, failureReason: 'IGNORED',
    });
    expect(approved.payment.failureReason).toBeNull();
  });

  it.each([
    ['blank orderId', { orderId: '   ', userId: 'u', amount: 1 }],
    ['missing owner', { orderId: 'o', amount: 1 }],
    ['negative amount', { orderId: 'o', userId: 'u', amount: -1 }],
    ['NaN amount', { orderId: 'o', userId: 'u', amount: Number.NaN }],
  ])('rejects %s with a domain error (no payment, no event)', async (_label, input) => {
    await expect(processPaymentUseCase.execute(input)).rejects.toThrow(InvalidPaymentError);
    expect(repo.outboxEvents).toHaveLength(0);
  });

  it('never rewrites a payment that was already decided (no second event)', async () => {
    await processPaymentUseCase.execute({ orderId: 'decided', userId: 'u', amount: 10 });
    const second = await processPaymentUseCase.execute({
      orderId: 'decided', userId: 'u', amount: 10, simulateOutcome: 'FAILED',
    });

    expect(second.event).toBe('ALREADY_PROCESSED');
    expect(second.payment.status).toBe('APPROVED');
    expect(repo.outboxEvents).toHaveLength(1);
  });

  it('trims the order id before looking the payment up', async () => {
    await processPaymentUseCase.execute({ orderId: 'trim-me', userId: 'owner', amount: 5 });
    const found = await getPaymentByOrderIdUseCase.execute('  trim-me  ', { userId: 'owner', role: 'CUSTOMER' });
    expect(found.orderId).toBe('trim-me');
  });

  it('hands normalized data to the repository (it is stored as received)', async () => {
    await processPaymentUseCase.execute({ orderId: '  ord-n  ', userId: '  u-n  ', amount: 10.129, messageId: 'm-n' });
    expect(repo.lastProcessData).toEqual({ orderId: 'ord-n', userId: 'u-n', amount: 10.13, status: 'APPROVED', messageId: 'm-n' });

    await processPaymentUseCase.execute({ orderId: 'ord-m', userId: 'u', amount: 1 });
    expect(repo.lastProcessData).not.toHaveProperty('messageId');
    expect(repo.lastProcessData).not.toHaveProperty('failureReason');
  });
});
