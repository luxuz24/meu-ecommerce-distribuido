import { type InventoryItem } from '../domain/entities/InventoryItem.js';
import { type IInventoryRepository, type UpsertStockData } from '../domain/repositories/IInventoryRepository.js';

export class UpsertStockUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(input: UpsertStockData): Promise<InventoryItem> {
    if (input.availableQty < 0) {
      throw new Error('INVALID_STOCK_QUANTITY: Available quantity cannot be negative');
    }
    return this.inventoryRepository.upsertStock({
      productId: input.productId.trim(),
      sku: input.sku.trim().toUpperCase(),
      availableQty: input.availableQty,
    });
  }
}
