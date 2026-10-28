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
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (input.messageId) {
          const alreadyProcessed = await tx.processedMessage.findUnique({
            where: { messageId: input.messageId },
          });
          if (alreadyProcessed) {
            return { status: 'ALREADY_PROCESSED', orderId: input.orderId };
          }
        }

        const existingReservation = await tx.stockReservation.findUnique({
          where: { orderId: input.orderId },
        });
        if (existingReservation) {
          return { status: 'ALREADY_PROCESSED', orderId: input.orderId };
        }

        // Decremento condicional e atômico: o próprio UPDATE garante availableQty >= quantity.
        // Sem "ler e depois gravar", duas reservas concorrentes nunca disputam o mesmo saldo.
        for (const reqItem of input.items) {
          const { count } = await tx.inventoryItem.updateMany({
            where: { sku: reqItem.sku, availableQty: { gte: reqItem.quantity } },
            data: {
              availableQty: { decrement: reqItem.quantity },
              reservedQty: { increment: reqItem.quantity },
            },
          });
          if (count === 0) {
            // Aborta a transação inteira: decrementos de itens anteriores sofrem rollback
            throw new StockShortage(reqItem.sku);
          }
        }

        const reservationRow = await tx.stockReservation.create({
          data: {
            orderId: input.orderId,
            status: 'RESERVED',
            items: input.items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
          },
        });

        if (input.messageId) {
          await tx.processedMessage.create({
            data: { messageId: input.messageId, eventType: 'ORDER_CREATED' },
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
              ...(input.userId !== undefined ? { userId: input.userId } : {}),
              ...(input.total !== undefined ? { total: input.total } : {}),
              ...(input.simulateOutcome !== undefined
                ? { simulateOutcome: input.simulateOutcome }
                : {}),
              items: input.items.map((i) => ({
                sku: i.sku,
                quantity: i.quantity,
                ...(i.price !== undefined ? { price: i.price } : {}),
                ...(i.name !== undefined ? { name: i.name } : {}),
              })),
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
    } catch (err) {
      if (err instanceof StockShortage) {
        return this.recordRejection(input, err.sku);
      }
      // Mesma mensagem/pedido processado em paralelo por outro consumer: a outra transação venceu
      if (isUniqueViolation(err)) {
        return { status: 'ALREADY_PROCESSED', orderId: input.orderId };
      }
      throw err;
    }
  }

  private async recordRejection(input: ReserveOrderInput, sku: string): Promise<ReserveOrderResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const stockRow = await tx.inventoryItem.findUnique({ where: { sku } });
        const reason = stockRow ? `INSUFFICIENT_STOCK:${sku}` : `SKU_NOT_FOUND:${sku}`;

        if (input.messageId) {
          await tx.processedMessage.create({
            data: { messageId: input.messageId, eventType: 'ORDER_CREATED' },
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

        return { status: 'STOCK_REJECTED' as const, orderId: input.orderId, reason };
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return { status: 'ALREADY_PROCESSED', orderId: input.orderId };
      }
      throw err;
    }
  }

  async releaseOrderReservationWithOutbox(orderId: string, messageId?: string): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (messageId) {
          const alreadyProcessed = await tx.processedMessage.findUnique({
            where: { messageId },
          });
          if (alreadyProcessed) return false;
        }

        // Transição condicional RESERVED -> RELEASED: só uma compensação concorrente vence
        const { count } = await tx.stockReservation.updateMany({
          where: { orderId, status: 'RESERVED' },
          data: { status: 'RELEASED' },
        });
        if (count === 0) return false;

        const reservation = await tx.stockReservation.findUniqueOrThrow({ where: { orderId } });
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

        if (messageId) {
          await tx.processedMessage.create({
            data: { messageId, eventType: 'PAYMENT_FAILED' },
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
    } catch (err) {
      if (isUniqueViolation(err)) return false;
      throw err;
    }
  }
}

class StockShortage extends Error {
  constructor(public readonly sku: string) {
    super(`STOCK_SHORTAGE:${sku}`);
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: unknown }).code === 'P2002'
  );
}
