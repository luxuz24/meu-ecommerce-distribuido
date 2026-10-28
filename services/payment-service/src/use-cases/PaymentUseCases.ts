import { type Payment } from '../domain/entities/Payment.js';
import { PaymentAccessDeniedError, PaymentNotFoundError } from '../domain/errors/PaymentErrors.js';
import {
  type IPaymentRepository,
  type ProcessPaymentResult,
} from '../domain/repositories/IPaymentRepository.js';

export interface ProcessPaymentInput {
  orderId: string;
  userId?: string;
  amount: number;
  simulateOutcome?: 'APPROVED' | 'FAILED';
  failureReason?: string;
  messageId?: string;
}

export class ProcessPaymentUseCase {
  constructor(private readonly paymentRepository: IPaymentRepository) {}

  async execute(input: ProcessPaymentInput): Promise<ProcessPaymentResult> {
    if (!input.orderId || !input.orderId.trim()) {
      throw new Error('PAYMENT_ORDER_ID_REQUIRED');
    }
    if (input.amount < 0) {
      throw new Error('PAYMENT_NEGATIVE_AMOUNT');
    }

    // Business rule: approve unless simulateOutcome === 'FAILED' or amount > 50000 (high-risk anti-fraud ceiling)
    const shouldFail =
      input.simulateOutcome === 'FAILED' ||
      (input.simulateOutcome === undefined && input.amount > 50000);

    const status = shouldFail ? 'FAILED' : 'APPROVED';
    const reason = shouldFail
      ? (input.failureReason ?? 'DECLINED_BY_ISSUER_OR_RISK_LIMIT')
      : undefined;

    return this.paymentRepository.processWithOutbox({
      orderId: input.orderId.trim(),
      userId: (input.userId ?? 'SYSTEM').trim(),
      amount: Number(input.amount.toFixed(2)),
      status,
      ...(reason !== undefined ? { failureReason: reason } : {}),
      ...(input.messageId !== undefined ? { messageId: input.messageId } : {}),
    });
  }
}

export class GetPaymentByOrderIdUseCase {
  constructor(private readonly paymentRepository: IPaymentRepository) {}

  async execute(
    orderId: string,
    requester: { userId: string; role: 'CUSTOMER' | 'ADMIN' }
  ): Promise<Payment> {
    const payment = await this.paymentRepository.findByOrderId(orderId.trim());
    if (!payment) {
      throw new PaymentNotFoundError(orderId);
    }
    // Anti-IDOR: o cliente só enxerga o pagamento dos próprios pedidos
    if (payment.userId !== requester.userId && requester.role !== 'ADMIN') {
      throw new PaymentAccessDeniedError(orderId);
    }
    return payment;
  }
}
