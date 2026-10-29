import { assertValidPayment, type Payment } from '../domain/entities/Payment.js';
import { PaymentAccessDeniedError, PaymentNotFoundError } from '../domain/errors/PaymentErrors.js';
import {
  type IPaymentRepository,
  type ProcessPaymentResult,
} from '../domain/repositories/IPaymentRepository.js';

/** Acima deste valor o pagamento é recusado pela regra antifraude (o valor exato é aprovado). */
export const ANTI_FRAUD_LIMIT = 50_000;

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
    assertValidPayment(input);

    // A simulação só pode FORÇAR uma recusa (demonstração da compensação);
    // nunca aprova o que a regra antifraude recusaria.
    const shouldFail = input.simulateOutcome === 'FAILED' || input.amount > ANTI_FRAUD_LIMIT;

    const status = shouldFail ? 'FAILED' : 'APPROVED';
    const reason = shouldFail
      ? (input.failureReason ?? 'DECLINED_BY_ISSUER_OR_RISK_LIMIT')
      : undefined;

    return this.paymentRepository.processWithOutbox({
      orderId: input.orderId.trim(),
      userId: input.userId.trim(),
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
