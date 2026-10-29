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
    private readonly batchSize = 50,
    private readonly onFailure: (orderId: string, err: unknown) => void = (orderId, err) =>
      console.error(`[inventory-service] Could not expire reservation of order ${orderId}:`, err)
  ) {}

  async execute(): Promise<string[]> {
    const now = this.now();
    const candidates = await this.inventoryRepository.findExpiredReservationOrderIds(
      now,
      this.batchSize
    );

    const expired: string[] = [];
    for (const orderId of candidates) {
      try {
        // Transição condicional: se o pagamento confirmou no meio-tempo, não expira
        if (await this.inventoryRepository.expireReservation(orderId, now)) {
          expired.push(orderId);
        }
      } catch (err) {
        // Uma reserva com defeito não pode travar a expiração de todas as outras
        // (seria uma "mensagem envenenada" do sweeper). Ela fica no log e é tentada de novo.
        this.onFailure(orderId, err);
      }
    }
    return expired;
  }
}
