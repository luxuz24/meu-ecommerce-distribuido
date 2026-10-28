import { type Order } from '../domain/entities/Order.js';
import { type IOrderRepository } from '../domain/repositories/IOrderRepository.js';

export type OrderSagaEventType =
  | 'STOCK_RESERVED'
  | 'STOCK_REJECTED'
  | 'PAYMENT_APPROVED'
  | 'PAYMENT_FAILED';

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

    return existing;
  }
}
