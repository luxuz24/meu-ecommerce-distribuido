export class InvalidProductDataError extends Error {
  constructor(message = 'Price and stock must be non-negative values.') {
    super(message);
    this.name = 'InvalidProductDataError';
  }
}
