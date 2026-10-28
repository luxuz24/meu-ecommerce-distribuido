import { type PrismaClient } from '@prisma/client';
import { Order, OrderItem, type OrderStatus } from '../../../domain/entities/Order.js';
import {
  type CreateOrderData,
  type IOrderRepository,
  type UpdateOrderStatusData,
} from '../../../domain/repositories/IOrderRepository.js';

export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createWithOutbox(data: CreateOrderData): Promise<Order> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          userId: data.userId,
          status: 'PENDING',
          total: data.total,
          items: {
            create: data.items.map((i) => ({
              productId: i.productId,
              sku: i.sku,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
            })),
          },
        },
        include: { items: true },
      });

      await tx.outbox.create({
        data: {
          aggregateType: 'Order',
          aggregateId: created.id,
          eventType: 'ORDER_CREATED',
          payload: {
            orderId: created.id,
            userId: created.userId,
            total: created.total,
            items: created.items.map((item) => ({
              productId: item.productId,
              sku: item.sku,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
            })),
          },
        },
      });

      return new Order({
        id: created.id,
        userId: created.userId,
        status: created.status as OrderStatus,
        total: created.total,
        cancelReason: created.cancelReason,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        items: created.items.map(
          (i) =>
            new OrderItem({
              id: i.id,
              productId: i.productId,
              sku: i.sku,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
            })
        ),
      });
    });
  }

  async findById(id: string): Promise<Order | null> {
    const raw = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!raw) return null;

    return new Order({
      id: raw.id,
      userId: raw.userId,
      status: raw.status as OrderStatus,
      total: raw.total,
      cancelReason: raw.cancelReason,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
      items: raw.items.map(
        (i) =>
          new OrderItem({
            id: i.id,
            productId: i.productId,
            sku: i.sku,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })
      ),
    });
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const rows = await this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(
      (raw) =>
        new Order({
          id: raw.id,
          userId: raw.userId,
          status: raw.status as OrderStatus,
          total: raw.total,
          cancelReason: raw.cancelReason,
          createdAt: raw.createdAt,
          updatedAt: raw.updatedAt,
          items: raw.items.map(
            (i) =>
              new OrderItem({
                id: i.id,
                productId: i.productId,
                sku: i.sku,
                name: i.name,
                price: i.price,
                quantity: i.quantity,
              })
          ),
        })
    );
  }

  async updateStatusWithOutbox(data: UpdateOrderStatusData): Promise<Order | null> {
    return this.prisma.$transaction(async (tx) => {
      if (data.messageId) {
        const already = await tx.processedMessage.findUnique({
          where: { messageId: data.messageId },
        });
        if (already) {
          return this.findById(data.orderId);
        }
      }

      const updated = await tx.order.update({
        where: { id: data.orderId },
        data: {
          status: data.status,
          ...(data.cancelReason !== undefined ? { cancelReason: data.cancelReason } : {}),
        },
        include: { items: true },
      });

      if (data.messageId) {
        await tx.processedMessage.create({
          data: {
            messageId: data.messageId,
            eventType: data.sourceEvent,
          },
        });
      }

      if (data.outboxEvent) {
        await tx.outbox.create({
          data: {
            aggregateType: 'Order',
            aggregateId: updated.id,
            eventType: data.outboxEvent.eventType,
            payload: JSON.parse(JSON.stringify(data.outboxEvent.payload)),
          },
        });
      }

      return new Order({
        id: updated.id,
        userId: updated.userId,
        status: updated.status as OrderStatus,
        total: updated.total,
        cancelReason: updated.cancelReason,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        items: updated.items.map(
          (i) =>
            new OrderItem({
              id: i.id,
              productId: i.productId,
              sku: i.sku,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
            })
        ),
      });
    });
  }
}
