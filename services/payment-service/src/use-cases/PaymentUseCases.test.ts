import { describe, it, expect, beforeEach } from 'vitest';
import { PaymentAccessDeniedError, PaymentNotFoundError } from '../domain/errors/PaymentErrors.js';
import { InMemoryPaymentRepository } from '../test-support/InMemoryPaymentRepository.js';
import {
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
});
