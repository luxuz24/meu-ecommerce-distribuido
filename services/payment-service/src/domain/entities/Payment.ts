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

export class Payment {
  public readonly id: string;
  public readonly orderId: string;
  public readonly userId: string;
  public readonly amount: number;
  public readonly status: PaymentStatus;
  public readonly failureReason: string | null;
  public readonly createdAt: Date;

  constructor(props: PaymentProps) {
    if (!props.orderId || !props.orderId.trim()) {
      throw new Error('PAYMENT_ORDER_ID_REQUIRED');
    }
    if (props.amount < 0) {
      throw new Error('PAYMENT_NEGATIVE_AMOUNT');
    }

    this.id = props.id;
    this.orderId = props.orderId.trim();
    this.userId = props.userId || 'SYSTEM';
    this.amount = Number(props.amount.toFixed(2));
    this.status = props.status;
    this.failureReason = props.failureReason ?? null;
    this.createdAt = props.createdAt ?? new Date();
  }
}
