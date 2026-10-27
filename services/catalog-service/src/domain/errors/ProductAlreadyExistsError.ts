export class ProductAlreadyExistsError extends Error {
  constructor(sku: string) {
    super(`Product with SKU ${sku} already exists.`);
    this.name = 'ProductAlreadyExistsError';
  }
}
