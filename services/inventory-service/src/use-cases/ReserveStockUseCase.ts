import {
  type IInventoryRepository,
  type ReserveOrderInput,
  type ReserveOrderResult,
} from '../domain/repositories/IInventoryRepository.js';

export const DEFAULT_RESERVATION_TTL_MS = 15 * 60 * 1000;

export class ReserveStockUseCase {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly reservationTtlMs: number = DEFAULT_RESERVATION_TTL_MS,
    private readonly now: () => Date = () => new Date()
  ) {}

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
      expiresAt: new Date(this.now().getTime() + this.reservationTtlMs),
      ...(input.messageId !== undefined ? { messageId: input.messageId } : {}),
      orderId: input.orderId,
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.total !== undefined ? { total: input.total } : {}),
      ...(input.simulateOutcome !== undefined ? { simulateOutcome: input.simulateOutcome } : {}),
      items: input.items.map((item) => ({
        sku: item.sku.trim().toUpperCase(),
        quantity: item.quantity,
        ...(item.price !== undefined ? { price: item.price } : {}),
        ...(item.name !== undefined ? { name: item.name } : {}),
      })),
    });
  }
}
