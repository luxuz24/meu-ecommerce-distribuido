import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryItem } from '../domain/entities/InventoryItem.js';
import { StockReservation } from '../domain/entities/StockReservation.js';
import { InventoryItemNotFoundError } from '../domain/errors/InventoryErrors.js';
import {
  type IInventoryRepository,
  type ReserveOrderInput,
  type ReserveOrderResult,
  type UpsertStockData,
} from '../domain/repositories/IInventoryRepository.js';
import { UpsertStockUseCase } from './UpsertStockUseCase.js';
import { GetStockBySkuUseCase } from './GetStockBySkuUseCase.js';
import { ReserveStockUseCase } from './ReserveStockUseCase.js';
import { ConfirmStockUseCase } from './ConfirmStockUseCase.js';
import { ReleaseStockUseCase } from './ReleaseStockUseCase.js';
import { verifyTokenHeader } from '../infra/http/middlewares/AuthMiddleware.js';
import jwt from 'jsonwebtoken';

class InMemoryInventoryRepository implements IInventoryRepository {
  private items = new Map<string, InventoryItem>();
  private reservations = new Map<string, StockReservation>();
  private processedMessages = new Set<string>();
  public outboxEvents: Array<{ eventType: string; payload: unknown }> = [];

  async findBySku(sku: string): Promise<InventoryItem | null> {
    return this.items.get(sku.toUpperCase()) ?? null;
  }

  async findAll(): Promise<InventoryItem[]> {
    return Array.from(this.items.values());
  }

  async upsertStock(data: UpsertStockData): Promise<InventoryItem> {
    const sku = data.sku.toUpperCase();
    const existing = this.items.get(sku);
    const updated = new InventoryItem({
      id: existing?.id ?? `inv_${sku}`,
      productId: data.productId,
      sku,
      availableQty: data.availableQty,
      reservedQty: existing?.reservedQty ?? 0,
    });
    this.items.set(sku, updated);
    return updated;
  }

  async hasProcessedMessage(messageId: string): Promise<boolean> {
    return this.processedMessages.has(messageId);
  }

  async reserveOrderStockWithOutbox(input: ReserveOrderInput): Promise<ReserveOrderResult> {
    if (input.messageId && this.processedMessages.has(input.messageId)) {
      return { status: 'ALREADY_PROCESSED', orderId: input.orderId };
    }
    if (this.reservations.has(input.orderId)) {
      return { status: 'ALREADY_PROCESSED', orderId: input.orderId };
    }

    for (const reqItem of input.items) {
      const current = this.items.get(reqItem.sku);
      if (!current || current.availableQty < reqItem.quantity) {
        const reason = !current
          ? `SKU_NOT_FOUND:${reqItem.sku}`
          : `INSUFFICIENT_STOCK:${reqItem.sku}`;
        if (input.messageId) this.processedMessages.add(input.messageId);
        this.outboxEvents.push({
          eventType: 'STOCK_REJECTED',
          payload: { orderId: input.orderId, reason },
        });
        return {
          status: 'STOCK_REJECTED',
          orderId: input.orderId,
          reason,
        };
      }
    }

    for (const reqItem of input.items) {
      const current = this.items.get(reqItem.sku)!;
      this.items.set(
        reqItem.sku,
        new InventoryItem({
          id: current.id,
          productId: current.productId,
          sku: current.sku,
          availableQty: current.availableQty - reqItem.quantity,
          reservedQty: current.reservedQty + reqItem.quantity,
        })
      );
    }

    const reservation = new StockReservation({
      id: `res_${input.orderId}`,
      orderId: input.orderId,
      status: 'RESERVED',
      items: input.items,
    });
    this.reservations.set(input.orderId, reservation);
    if (input.messageId) this.processedMessages.add(input.messageId);

    this.outboxEvents.push({
      eventType: 'STOCK_RESERVED',
      payload: { orderId: input.orderId, reservationId: reservation.id, items: input.items },
    });

    return {
      status: 'STOCK_RESERVED',
      orderId: input.orderId,
      reservation,
    };
  }

  async confirmOrderReservation(orderId: string, messageId?: string): Promise<boolean> {
    if (messageId && this.processedMessages.has(messageId)) return false;
    const existing = this.reservations.get(orderId);
    if (!existing || existing.status !== 'RESERVED') return false;

    for (const item of existing.items) {
      const current = this.items.get(item.sku);
      if (current) {
        this.items.set(
          item.sku,
          new InventoryItem({
            id: current.id,
            productId: current.productId,
            sku: current.sku,
            availableQty: current.availableQty,
            reservedQty: current.reservedQty - item.quantity,
          })
        );
      }
    }
    this.reservations.set(
      orderId,
      new StockReservation({ id: existing.id, orderId, status: 'CONFIRMED', items: existing.items })
    );
    if (messageId) this.processedMessages.add(messageId);
    return true;
  }

  async releaseOrderReservationWithOutbox(orderId: string, messageId?: string): Promise<boolean> {
    if (messageId && this.processedMessages.has(messageId)) {
      return false;
    }
    const existing = this.reservations.get(orderId);
    if (!existing || existing.status !== 'RESERVED') {
      return false;
    }

    for (const item of existing.items) {
      const current = this.items.get(item.sku);
      if (current) {
        this.items.set(
          item.sku,
          new InventoryItem({
            id: current.id,
            productId: current.productId,
            sku: current.sku,
            availableQty: current.availableQty + item.quantity,
            reservedQty: current.reservedQty - item.quantity,
          })
        );
      }
    }

    this.reservations.set(
      orderId,
      new StockReservation({
        id: existing.id,
        orderId: existing.orderId,
        status: 'RELEASED',
        items: existing.items,
      })
    );

    if (messageId) this.processedMessages.add(messageId);
    this.outboxEvents.push({
      eventType: 'STOCK_RELEASED',
      payload: { orderId, items: existing.items },
    });
    return true;
  }
}

describe('Inventory Service Use Cases & Saga Stock Reservation', () => {
  let repo: InMemoryInventoryRepository;
  let upsertUseCase: UpsertStockUseCase;
  let getBySkuUseCase: GetStockBySkuUseCase;
  let reserveUseCase: ReserveStockUseCase;
  let releaseUseCase: ReleaseStockUseCase;

  beforeEach(() => {
    repo = new InMemoryInventoryRepository();
    upsertUseCase = new UpsertStockUseCase(repo);
    getBySkuUseCase = new GetStockBySkuUseCase(repo);
    reserveUseCase = new ReserveStockUseCase(repo);
    releaseUseCase = new ReleaseStockUseCase(repo);
  });

  it('should upsert and retrieve stock by normalized SKU', async () => {
    await upsertUseCase.execute({
      productId: 'prod-01',
      sku: 'key-chron-k2',
      availableQty: 15,
    });

    const item = await getBySkuUseCase.execute('KEY-CHRON-K2');
    expect(item.sku).toBe('KEY-CHRON-K2');
    expect(item.availableQty).toBe(15);
    expect(item.reservedQty).toBe(0);
  });

  it('should throw InventoryItemNotFoundError for unknown SKU', async () => {
    await expect(getBySkuUseCase.execute('UNKNOWN-SKU')).rejects.toThrow(
      InventoryItemNotFoundError
    );
  });

  it('should reserve stock atomically and emit STOCK_RESERVED to outbox', async () => {
    await upsertUseCase.execute({
      productId: 'prod-01',
      sku: 'SKU-MOUSE-01',
      availableQty: 10,
    });

    const res = await reserveUseCase.execute({
      messageId: 'msg-101',
      orderId: 'order-101',
      items: [{ sku: 'SKU-MOUSE-01', quantity: 3 }],
    });

    expect(res.status).toBe('STOCK_RESERVED');
    const updated = await getBySkuUseCase.execute('SKU-MOUSE-01');
    expect(updated.availableQty).toBe(7);
    expect(updated.reservedQty).toBe(3);
    expect(repo.outboxEvents).toHaveLength(1);
    expect(repo.outboxEvents[0]?.eventType).toBe('STOCK_RESERVED');
  });

  it('should reject stock reservation when available quantity is insufficient and emit STOCK_REJECTED', async () => {
    await upsertUseCase.execute({
      productId: 'prod-02',
      sku: 'SKU-MONITOR-4K',
      availableQty: 2,
    });

    const res = await reserveUseCase.execute({
      messageId: 'msg-102',
      orderId: 'order-102',
      items: [{ sku: 'SKU-MONITOR-4K', quantity: 5 }],
    });

    expect(res.status).toBe('STOCK_REJECTED');
    expect(res.reason).toContain('INSUFFICIENT_STOCK');
    const unchanged = await getBySkuUseCase.execute('SKU-MONITOR-4K');
    expect(unchanged.availableQty).toBe(2);
    expect(unchanged.reservedQty).toBe(0);
    expect(repo.outboxEvents[0]?.eventType).toBe('STOCK_REJECTED');
  });

  it('should enforce idempotency and ignore duplicate ORDER_CREATED messageId', async () => {
    await upsertUseCase.execute({
      productId: 'prod-01',
      sku: 'SKU-HEADSET',
      availableQty: 10,
    });

    const first = await reserveUseCase.execute({
      messageId: 'msg-dup-01',
      orderId: 'order-200',
      items: [{ sku: 'SKU-HEADSET', quantity: 4 }],
    });
    const duplicate = await reserveUseCase.execute({
      messageId: 'msg-dup-01',
      orderId: 'order-200',
      items: [{ sku: 'SKU-HEADSET', quantity: 4 }],
    });

    expect(first.status).toBe('STOCK_RESERVED');
    expect(duplicate.status).toBe('ALREADY_PROCESSED');

    const item = await getBySkuUseCase.execute('SKU-HEADSET');
    expect(item.availableQty).toBe(6);
    expect(item.reservedQty).toBe(4);
  });

  it('should release reserved stock upon PAYMENT_FAILED compensation', async () => {
    await upsertUseCase.execute({
      productId: 'prod-03',
      sku: 'SKU-CHAIR',
      availableQty: 5,
    });

    await reserveUseCase.execute({
      messageId: 'msg-300',
      orderId: 'order-300',
      items: [{ sku: 'SKU-CHAIR', quantity: 2 }],
    });

    const released = await releaseUseCase.execute('order-300', 'msg-payfail-300');
    expect(released).toBe(true);

    const restored = await getBySkuUseCase.execute('SKU-CHAIR');
    expect(restored.availableQty).toBe(5);
    expect(restored.reservedQty).toBe(0);
  });

  it('should turn a reservation into a final stock deduction on ORDER_CONFIRMED', async () => {
    const confirmUseCase = new ConfirmStockUseCase(repo);
    await upsertUseCase.execute({ productId: 'p1', sku: 'SKU-OK', availableQty: 10 });
    await reserveUseCase.execute({ orderId: 'o-paid', items: [{ sku: 'SKU-OK', quantity: 4 }] });

    expect(await confirmUseCase.execute('o-paid', 'msg-confirm-1')).toBe(true);
    // Reentrega da mesma mensagem e compensação tardia não podem mexer no estoque
    expect(await confirmUseCase.execute('o-paid', 'msg-confirm-1')).toBe(false);
    expect(await releaseUseCase.execute('o-paid', 'late-payment-failed')).toBe(false);

    const stock = await getBySkuUseCase.execute('SKU-OK');
    expect(stock.availableQty).toBe(6);
    expect(stock.reservedQty).toBe(0);
  });

  it('should validate HS256 JWT token for Admin inventory seeding', () => {
    const secret = 'test-inventory-secret';
    const token = jwt.sign(
      { userId: 'u-admin', email: 'admin@microstore.io', role: 'ADMIN' },
      secret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    const decoded = verifyTokenHeader(`Bearer ${token}`, secret);
    expect(decoded.role).toBe('ADMIN');
  });
});
