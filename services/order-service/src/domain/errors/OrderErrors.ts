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

export class ProductUnavailableError extends Error {
  constructor(productId: string) {
    super(`PRODUCT_UNAVAILABLE: Product ${productId} does not exist or is inactive`);
    this.name = 'ProductUnavailableError';
  }
}

export class CatalogUnavailableError extends Error {
  constructor() {
    super('CATALOG_UNAVAILABLE: Could not resolve product prices from catalog-service');
    this.name = 'CatalogUnavailableError';
  }
}
