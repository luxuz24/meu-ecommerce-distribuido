export class InventoryItemNotFoundError extends Error {
  constructor(sku: string) {
    super(`INVENTORY_ITEM_NOT_FOUND: SKU ${sku} was not found`);
    this.name = 'InventoryItemNotFoundError';
  }
}

export class InsufficientStockError extends Error {
  constructor(sku: string, requested: number, available: number) {
    super(`INSUFFICIENT_STOCK: Requested ${requested} of SKU ${sku}, but only ${available} available`);
    this.name = 'InsufficientStockError';
  }
}

export class DuplicateMessageError extends Error {
  constructor(messageId: string) {
    super(`DUPLICATE_MESSAGE: Message ${messageId} has already been processed`);
    this.name = 'DuplicateMessageError';
  }
}
