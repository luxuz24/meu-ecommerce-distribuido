import { type Order } from '../domain/entities/Order.js';
import { type IOrderRepository } from '../domain/repositories/IOrderRepository.js';

export type OrderSagaEventType =
  | 'STOCK_RESERVED'
  | 'STOCK_REJECTED'
  | 'PAYMENT_APPROVED'
  | 'PAYMENT_FAILED'
  | 'RESERVATION_EXPIRED';

export interface HandleOrderSagaEventInput {
  eventType: OrderSagaEventType;
  orderId: string;
  messageId?: string;
  reason?: string;
}

export class UpdateOrderStatusUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(input: HandleOrderSagaEventInput): Promise<Order | null> {
    const existing = await this.orderRepository.findById(input.orderId);
    if (!existing) {
      return null;
    }

    if (input.eventType === 'STOCK_RESERVED') {
      if (existing.status !== 'PENDING') return existing;
      return this.orderRepository.updateStatusWithOutbox({
        orderId: input.orderId,
        status: 'STOCK_RESERVED',
        ...(input.messageId !== undefined ? { messageId: input.messageId } : {}),
        sourceEvent: 'STOCK_RESERVED',
      });
    }

    if (input.eventType === 'STOCK_REJECTED') {
      if (existing.status === 'CANCELLED' || existing.status === 'PAID') return existing;
      const reason = input.reason ?? 'INSUFFICIENT_STOCK';
      return this.orderRepository.updateStatusWithOutbox({
        orderId: input.orderId,
        status: 'CANCELLED',
        cancelReason: reason,
        ...(input.messageId !== undefined ? { messageId: input.messageId } : {}),
        sourceEvent: 'STOCK_REJECTED',
        outboxEvent: {
          eventType: 'ORDER_CANCELLED',
          payload: {
            orderId: existing.id,
            userId: existing.userId,
            reason,
          },
        },
      });
    }

    if (input.eventType === 'PAYMENT_APPROVED') {
      if (existing.status === 'PAID') return existing;
      // Guard: CANCELLED order must NEVER transition to PAID! Only PENDING or STOCK_RESERVED can be paid.
      if (existing.status === 'CANCELLED') {
        console.warn(`[order-service] Ignored PAYMENT_APPROVED on already CANCELLED order ${existing.id}`);
        return existing;
      }
      return this.orderRepository.updateStatusWithOutbox({
        orderId: input.orderId,
        status: 'PAID',
        ...(input.messageId !== undefined ? { messageId: input.messageId } : {}),
        sourceEvent: 'PAYMENT_APPROVED',
        outboxEvent: {
          eventType: 'ORDER_CONFIRMED',
          payload: {
            orderId: existing.id,
            userId: existing.userId,
            total: existing.total,
          },
        },
      });
    }

    if (input.eventType === 'PAYMENT_FAILED') {
      if (existing.status === 'CANCELLED' || existing.status === 'PAID') return existing;
      const reason = input.reason ?? 'PAYMENT_DECLINED';
      return this.orderRepository.updateStatusWithOutbox({
        orderId: input.orderId,
        status: 'CANCELLED',
        cancelReason: reason,
        ...(input.messageId !== undefined ? { messageId: input.messageId } : {}),
        sourceEvent: 'PAYMENT_FAILED',
        outboxEvent: {
          eventType: 'ORDER_CANCELLED',
          payload: {
            orderId: existing.id,
            userId: existing.userId,
            reason,
          },
        },
      });
    }

    if (input.eventType === 'RESERVATION_EXPIRED') {
      if (existing.status === 'PAID') {
        // A confirmação deste pedido pago não chegou ao inventory (ex.: foi para a DLQ) e a
        // reserva expirou, devolvendo ao estoque unidades já vendidas. Reemitimos a
        // confirmação para o inventory readquirir o estoque (confirmação tardia).
        return this.orderRepository.updateStatusWithOutbox({
          orderId: input.orderId,
          status: 'PAID',
          ...(input.messageId !== undefined ? { messageId: input.messageId } : {}),
          sourceEvent: 'RESERVATION_EXPIRED',
          outboxEvent: {
            eventType: 'ORDER_CONFIRMED',
            payload: {
              orderId: existing.id,
              userId: existing.userId,
              total: existing.total,
              replay: true,
            },
          },
        });
      }
      if (existing.status !== 'PENDING' && existing.status !== 'STOCK_RESERVED') return existing;
      const reason = input.reason ?? 'RESERVATION_EXPIRED';
      return this.orderRepository.updateStatusWithOutbox({
        orderId: input.orderId,
        status: 'CANCELLED',
        cancelReason: reason,
        ...(input.messageId !== undefined ? { messageId: input.messageId } : {}),
        sourceEvent: 'RESERVATION_EXPIRED',
        outboxEvent: {
          eventType: 'ORDER_CANCELLED',
          payload: {
            orderId: existing.id,
            userId: existing.userId,
            reason,
          },
        },
      });
    }

    return existing;
  }
}
