import { type PrismaClient } from '@prisma/client';
import { InventoryItem } from '../../../domain/entities/InventoryItem.js';
import {
  StockReservation,
  type ReservationItemEntry,
  type ReservationStatus,
} from '../../../domain/entities/StockReservation.js';
import {
  type IInventoryRepository,
  type ReserveOrderInput,
  type ReserveOrderResult,
  type UpsertStockData,
} from '../../../domain/repositories/IInventoryRepository.js';

export class PrismaInventoryRepository implements IInventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySku(sku: string): Promise<InventoryItem | null> {
    const raw = await this.prisma.inventoryItem.findUnique({
      where: { sku: sku.toUpperCase() },
    });
    if (!raw) return null;
    return new InventoryItem(raw);
  }

  async findAll(): Promise<InventoryItem[]> {
    const rows = await this.prisma.inventoryItem.findMany({
      orderBy: { sku: 'asc' },
    });
    return rows.map((raw) => new InventoryItem(raw));
  }

  async upsertStock(data: UpsertStockData): Promise<InventoryItem> {
    const normalizedSku = data.sku.trim().toUpperCase();
    const raw = await this.prisma.inventoryItem.upsert({
      where: { sku: normalizedSku },
      update: {
        productId: data.productId,
        availableQty: data.availableQty,
      },
      create: {
        productId: data.productId,
        sku: normalizedSku,
        availableQty: data.availableQty,
        reservedQty: 0,
      },
    });
    return new InventoryItem(raw);
  }

  async hasProcessedMessage(messageId: string): Promise<boolean> {
    const found = await this.prisma.processedMessage.findUnique({
      where: { messageId },
    });
    return found !== null;
  }

  async reserveOrderStockWithOutbox(input: ReserveOrderInput): Promise<ReserveOrderResult> {
    return this.prisma.$transaction(async (tx) => {
      if (input.messageId) {
        const alreadyProcessed = await tx.processedMessage.findUnique({
          where: { messageId: input.messageId },
        });
        if (alreadyProcessed) {
          return {
            status: 'ALREADY_PROCESSED',
            orderId: input.orderId,
          };
        }
      }

      const existingReservation = await tx.stockReservation.findUnique({
        where: { orderId: input.orderId },
      });
      if (existingReservation) {
        return {
          status: 'ALREADY_PROCESSED',
          orderId: input.orderId,
        };
      }

      // Check availability for all items first
      for (const reqItem of input.items) {
        const stockRow = await tx.inventoryItem.findUnique({
          where: { sku: reqItem.sku },
        });

        if (!stockRow || stockRow.availableQty < reqItem.quantity) {
          const reason = !stockRow
            ? `SKU_NOT_FOUND:${reqItem.sku}`
            : `INSUFFICIENT_STOCK:${reqItem.sku}`;

          if (input.messageId) {
            await tx.processedMessage.create({
              data: {
                messageId: input.messageId,
                eventType: 'ORDER_CREATED',
              },
            });
          }

          await tx.outbox.create({
            data: {
              aggregateType: 'Inventory',
              aggregateId: input.orderId,
              eventType: 'STOCK_REJECTED',
              payload: {
                orderId: input.orderId,
                reason,
                items: input.items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
              },
            },
          });

          return {
            status: 'STOCK_REJECTED',
            orderId: input.orderId,
            reason,
          };
        }
      }

      // Deduct availableQty and increment reservedQty for each item
      for (const reqItem of input.items) {
        await tx.inventoryItem.update({
          where: { sku: reqItem.sku },
          data: {
            availableQty: { decrement: reqItem.quantity },
            reservedQty: { increment: reqItem.quantity },
          },
        });
      }

      const reservationRow = await tx.stockReservation.create({
        data: {
          orderId: input.orderId,
          status: 'RESERVED',
          items: input.items as unknown as object,
        },
      });

      if (input.messageId) {
        await tx.processedMessage.create({
          data: {
            messageId: input.messageId,
            eventType: 'ORDER_CREATED',
          },
        });
      }

      await tx.outbox.create({
        data: {
          aggregateType: 'Inventory',
          aggregateId: input.orderId,
          eventType: 'STOCK_RESERVED',
          payload: {
            orderId: input.orderId,
            reservationId: reservationRow.id,
            items: input.items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
          },
        },
      });

      return {
        status: 'STOCK_RESERVED',
        orderId: input.orderId,
        reservation: new StockReservation({
          id: reservationRow.id,
          orderId: reservationRow.orderId,
          status: reservationRow.status as ReservationStatus,
          items: reservationRow.items as unknown as ReservationItemEntry[],
          createdAt: reservationRow.createdAt,
        }),
      };
    });
  }

  async releaseOrderReservationWithOutbox(orderId: string, messageId?: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      if (messageId) {
        const alreadyProcessed = await tx.processedMessage.findUnique({
          where: { messageId },
        });
        if (alreadyProcessed) return false;
      }

      const reservation = await tx.stockReservation.findUnique({
        where: { orderId },
      });

      if (!reservation || reservation.status !== 'RESERVED') {
        return false;
      }

      const items = reservation.items as unknown as ReservationItemEntry[];
      for (const item of items) {
        await tx.inventoryItem.update({
          where: { sku: item.sku },
          data: {
            availableQty: { increment: item.quantity },
            reservedQty: { decrement: item.quantity },
          },
        });
      }

      await tx.stockReservation.update({
        where: { orderId },
        data: { status: 'RELEASED' },
      });

      if (messageId) {
        await tx.processedMessage.create({
          data: {
            messageId,
            eventType: 'PAYMENT_FAILED',
          },
        });
      }

      await tx.outbox.create({
        data: {
          aggregateType: 'Inventory',
          aggregateId: orderId,
          eventType: 'STOCK_RELEASED',
          payload: {
            orderId,
            items: items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
          },
        },
      });

      return true;
    });
  }
}
