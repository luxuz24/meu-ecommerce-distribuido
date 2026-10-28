import { type IInventoryRepository } from '../domain/repositories/IInventoryRepository.js';

export class ReleaseStockUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(orderId: string, messageId?: string): Promise<boolean> {
    if (!orderId) {
      throw new Error('ORDER_ID_REQUIRED');
    }
    return this.inventoryRepository.releaseOrderReservationWithOutbox(orderId, messageId);
  }
}
