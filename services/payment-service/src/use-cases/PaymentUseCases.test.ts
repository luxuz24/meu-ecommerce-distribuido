import { describe, it, expect, beforeEach } from 'vitest';
import { Payment } from '../domain/entities/Payment.js';
import { PaymentNotFoundError } from '../domain/errors/PaymentErrors.js';
import {
  type IPaymentRepository,
  type ProcessPaymentData,
  type ProcessPaymentResult,
} from '../domain/repositories/IPaymentRepository.js';
import {
  GetPaymentByOrderIdUseCase,
  ProcessPaymentUseCase,
} from './PaymentUseCases.js';

class InMemoryPaymentRepository implements IPaymentRepository {
  private payments = new Map<string, Payment>();
  private processedMessages = new Set<string>();
  public outboxEvents: Array<{ eventType: string; payload: unknown }> = [];

  async findByOrderId(orderId: string): Promise<Payment | null> {
    return this.payments.get(orderId) ?? null;
  }

  async processWithOutbox(data: ProcessPaymentData): Promise<ProcessPaymentResult> {
    if (data.messageId && this.processedMessages.has(data.messageId)) {
      const existing = this.payments.get(data.orderId);
      if (existing) {
        return { event: 'ALREADY_PROCESSED', payment: existing };
      }
    }

    const payment = new Payment({
      id: `pay_${data.orderId}`,
      orderId: data.orderId,
      userId: data.userId,
      amount: data.amount,
      status: data.status,
      failureReason: data.failureReason ?? null,
    });

    this.payments.set(data.orderId, payment);
    if (data.messageId) {
      this.processedMessages.add(data.messageId);
    }

    const eventType =
      data.status === 'APPROVED' ? 'PAYMENT_APPROVED' : 'PAYMENT_FAILED';

    this.outboxEvents.push({
      eventType,
      payload: {
        orderId: payment.orderId,
        paymentId: payment.id,
        userId: payment.userId,
        amount: payment.amount,
        status: payment.status,
        ...(payment.failureReason ? { reason: payment.failureReason } : {}),
      },
    });

    return { event: eventType, payment };
  }
}

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

    const stored = await getPaymentByOrderIdUseCase.execute('order-501');
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
      getPaymentByOrderIdUseCase.execute('unknown-order')
    ).rejects.toThrow(PaymentNotFoundError);
  });
});
