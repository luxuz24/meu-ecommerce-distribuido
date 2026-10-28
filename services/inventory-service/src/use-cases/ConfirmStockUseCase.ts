import { type IInventoryRepository } from '../domain/repositories/IInventoryRepository.js';

/**
 * Fechamento da Saga: quando o pedido é pago (ORDER_CONFIRMED), a reserva vira baixa
 * definitiva. As unidades saem de reservedQty sem voltar para availableQty.
 */
export class ConfirmStockUseCase {
  constructor(private readonly inventoryRepository: IInventoryRepository) {}

  async execute(orderId: string, messageId?: string): Promise<boolean> {
    if (!orderId) {
      throw new Error('ORDER_ID_REQUIRED');
    }
    return this.inventoryRepository.confirmOrderReservation(orderId, messageId);
  }
}
