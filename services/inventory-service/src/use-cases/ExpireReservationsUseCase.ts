import { type IInventoryRepository } from '../domain/repositories/IInventoryRepository.js';

/**
 * Garante que nenhuma reserva fique presa: se a Saga não concluir dentro do prazo
 * (ex.: a mensagem do pagamento foi para a DLQ), a reserva expira, o estoque volta
 * e o evento STOCK_RESERVATION_EXPIRED faz o order-service cancelar o pedido.
 */
export class ExpireReservationsUseCase {
  constructor(
    private readonly inventoryRepository: IInventoryRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly batchSize = 50
  ) {}

  async execute(): Promise<string[]> {
    const now = this.now();
    const candidates = await this.inventoryRepository.findExpiredReservationOrderIds(
      now,
      this.batchSize
    );

    const expired: string[] = [];
    for (const orderId of candidates) {
      // Transição condicional: se o pagamento confirmou no meio-tempo, não expira
      if (await this.inventoryRepository.expireReservation(orderId, now)) {
        expired.push(orderId);
      }
    }
    return expired;
  }
}
