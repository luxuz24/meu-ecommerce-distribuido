import { Payment } from '../domain/entities/Payment.js';
import {
  type IPaymentRepository,
  type ProcessPaymentData,
  type ProcessPaymentResult,
} from '../domain/repositories/IPaymentRepository.js';

/** Fake em memória do repositório de pagamentos, compartilhado pelos testes unitários. */
export class InMemoryPaymentRepository implements IPaymentRepository {
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
