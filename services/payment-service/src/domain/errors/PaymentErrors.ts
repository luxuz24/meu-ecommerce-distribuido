export class PaymentNotFoundError extends Error {
  constructor(orderId: string) {
    super(`PAYMENT_NOT_FOUND: No payment found for order ${orderId}`);
    this.name = 'PaymentNotFoundError';
  }
}

export class PaymentAccessDeniedError extends Error {
  constructor(orderId: string) {
    super(`FORBIDDEN_PAYMENT_ACCESS: You do not have permission to view the payment of order ${orderId}`);
    this.name = 'PaymentAccessDeniedError';
  }
}
