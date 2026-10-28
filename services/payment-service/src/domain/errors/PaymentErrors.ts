export class PaymentNotFoundError extends Error {
  constructor(orderId: string) {
    super(`PAYMENT_NOT_FOUND: No payment found for order ${orderId}`);
    this.name = 'PaymentNotFoundError';
  }
}
