import {
  type IInventoryRepository,
  type ReserveOrderInput,
  type ReserveOrderResult,
} from '../domain/repositories/IInventoryRepository.js';

export class ReserveStockUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(input: ReserveOrderInput): Promise<ReserveOrderResult> {
    if (!input.orderId || input.items.length === 0) {
      return {
        status: 'STOCK_REJECTED',
        orderId: input.orderId || 'UNKNOWN',
        reason: 'EMPTY_OR_INVALID_ORDER_ITEMS',
      };
    }

    for (const entry of input.items) {
      if (!entry.sku || entry.quantity <= 0) {
        return {
          status: 'STOCK_REJECTED',
          orderId: input.orderId,
          reason: `INVALID_QUANTITY_FOR_SKU_${entry.sku || 'UNKNOWN'}`,
        };
      }
    }

    return this.inventoryRepository.reserveOrderStockWithOutbox({
      ...(input.messageId !== undefined ? { messageId: input.messageId } : {}),
      orderId: input.orderId,
      items: input.items.map((item) => ({
        sku: item.sku.trim().toUpperCase(),
        quantity: item.quantity,
      })),
    });
  }
}
