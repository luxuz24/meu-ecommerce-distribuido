import { InvalidPaymentError } from '../errors/PaymentErrors.js';

export type PaymentStatus = 'APPROVED' | 'FAILED';

export interface PaymentProps {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  status: PaymentStatus;
  failureReason?: string | null;
  createdAt?: Date;
}

/**
 * Invariantes de um pagamento, compartilhadas pela entidade e pelo use case.
 * Um pagamento precisa de pedido e dono reais e de um valor finito e não negativo:
 * nenhum default silencioso ("SYSTEM", 0) substitui um campo de negócio ausente.
 */
export function assertValidPayment<T extends { orderId?: string; userId?: string; amount: number }>(
  fields: T
): asserts fields is T & { orderId: string; userId: string } {
  if (!fields.orderId || !fields.orderId.trim()) {
    throw new InvalidPaymentError('orderId is required');
  }
  if (!fields.userId || !fields.userId.trim()) {
    throw new InvalidPaymentError('userId is required');
  }
  if (!Number.isFinite(fields.amount) || fields.amount < 0) {
    throw new InvalidPaymentError('amount must be a finite number >= 0');
  }
}

export class Payment {
  public readonly id: string;
  public readonly orderId: string;
  public readonly userId: string;
  public readonly amount: number;
  public readonly status: PaymentStatus;
  public readonly failureReason: string | null;
  public readonly createdAt: Date;

  constructor(props: PaymentProps) {
    assertValidPayment(props);

    this.id = props.id;
    this.orderId = props.orderId.trim();
    this.userId = props.userId.trim();
    this.amount = Number(props.amount.toFixed(2));
    this.status = props.status;
    this.failureReason = props.failureReason ?? null;
    this.createdAt = props.createdAt ?? new Date();
  }
}
