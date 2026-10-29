import { type Payment, type PaymentStatus } from '../entities/Payment.js';

export interface ProcessPaymentData {
  orderId: string;
  userId: string;
  amount: number;
  status: PaymentStatus;
  failureReason?: string;
  messageId?: string;
}

export interface ProcessPaymentResult {
  event: 'PAYMENT_APPROVED' | 'PAYMENT_FAILED' | 'ALREADY_PROCESSED';
  payment: Payment;
}

export interface IPaymentRepository {
  findByOrderId(orderId: string): Promise<Payment | null>;
  /**
   * Grava o pagamento e o evento na outbox, na mesma transação.
   * Um pagamento já decidido para o mesmo pedido é imutável: devolve ALREADY_PROCESSED
   * com o pagamento existente e não publica novo evento (vale também para entregas
   * concorrentes da mesma mensagem).
   */
  processWithOutbox(data: ProcessPaymentData): Promise<ProcessPaymentResult>;
}
