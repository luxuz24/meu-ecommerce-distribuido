import { type InventoryItem } from '../domain/entities/InventoryItem.js';
import { InventoryItemNotFoundError } from '../domain/errors/InventoryErrors.js';
import { type IInventoryRepository } from '../domain/repositories/IInventoryRepository.js';

export class GetStockBySkuUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(sku: string): Promise<InventoryItem> {
    const normalizedSku = sku.trim().toUpperCase();
    const item = await this.inventoryRepository.findBySku(normalizedSku);
    if (!item) {
      throw new InventoryItemNotFoundError(normalizedSku);
    }
    return item;
  }

  async listAll(): Promise<InventoryItem[]> {
    return this.inventoryRepository.findAll();
  }
}
