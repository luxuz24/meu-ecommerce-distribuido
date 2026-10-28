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
  processWithOutbox(data: ProcessPaymentData): Promise<ProcessPaymentResult>;
}
