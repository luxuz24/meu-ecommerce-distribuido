export class OrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`ORDER_NOT_FOUND: Order ${orderId} was not found`);
    this.name = 'OrderNotFoundError';
  }
}

export class OrderAccessDeniedError extends Error {
  constructor(orderId: string) {
    super(`FORBIDDEN_ORDER_ACCESS: You do not have permission to view order ${orderId}`);
    this.name = 'OrderAccessDeniedError';
  }
}

export class InvalidOrderTransitionError extends Error {
  constructor(current: string, target: string) {
    super(`INVALID_ORDER_TRANSITION: Cannot transition order from ${current} to ${target}`);
    this.name = 'InvalidOrderTransitionError';
  }
}
