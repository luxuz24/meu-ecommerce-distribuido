import { describe, it, expect, beforeEach } from 'vitest';
import { Order, OrderItem } from '../domain/entities/Order.js';
import { OrderAccessDeniedError, OrderNotFoundError } from '../domain/errors/OrderErrors.js';
import {
  type CreateOrderData,
  type IOrderRepository,
  type UpdateOrderStatusData,
} from '../domain/repositories/IOrderRepository.js';
import { CreateOrderUseCase } from './CreateOrderUseCase.js';
import { GetOrderByIdUseCase, ListUserOrdersUseCase } from './GetOrderUseCases.js';
import { UpdateOrderStatusUseCase } from './UpdateOrderStatusUseCase.js';
import { ProductUnavailableError } from '../domain/errors/OrderErrors.js';
import { type CatalogProduct, type IProductCatalog } from '../domain/services/IProductCatalog.js';
import { verifyOrderJwt } from '../infra/http/middlewares/AuthMiddleware.js';
import jwt from 'jsonwebtoken';

class FakeProductCatalog implements IProductCatalog {
  private readonly products = new Map<string, CatalogProduct>([
    ['p1', { id: 'p1', sku: 'tec-mec-pro-001', name: 'Teclado Mecânico Wireless Pro', price: 549.9, isActive: true }],
    ['p2', { id: 'p2', sku: 'mou-erg-opt-002', name: 'Mouse Ergonômico', price: 289.0, isActive: true }],
    ['p3', { id: 'p3', sku: 'MON-4K-DEV-003', name: 'Monitor 4K', price: 3199, isActive: true }],
    ['p-off', { id: 'p-off', sku: 'OLD-001', name: 'Produto Descontinuado', price: 10, isActive: false }],
  ]);

  async findById(productId: string): Promise<CatalogProduct | null> {
    return this.products.get(productId) ?? null;
  }
}

class InMemoryOrderRepository implements IOrderRepository {
  private orders = new Map<string, Order>();
  private processedMessages = new Set<string>();
  public outboxEvents: Array<{ eventType: string; payload: unknown }> = [];

  public lastCreateData: CreateOrderData | undefined;

  async createWithOutbox(data: CreateOrderData): Promise<Order> {
    this.lastCreateData = data;
    const id = `ord_${this.orders.size + 1}`;
    const order = new Order({
      id,
      userId: data.userId,
      status: 'PENDING',
      items: data.items.map(
        (i, idx) =>
          new OrderItem({
            id: `item_${idx + 1}`,
            productId: i.productId,
            sku: i.sku,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
          })
      ),
      total: data.total,
    });

    this.orders.set(id, order);
    this.outboxEvents.push({
      eventType: 'ORDER_CREATED',
      payload: {
        orderId: order.id,
        userId: order.userId,
        total: order.total,
        items: order.items,
      },
    });
    return order;
  }

  async findById(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }

  async findByUserId(userId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter((o) => o.userId === userId);
  }

  async updateStatusWithOutbox(data: UpdateOrderStatusData): Promise<Order | null> {
    if (data.messageId && this.processedMessages.has(data.messageId)) {
      return this.orders.get(data.orderId) ?? null;
    }

    const existing = this.orders.get(data.orderId);
    if (!existing) return null;

    const updated = new Order({
      id: existing.id,
      userId: existing.userId,
      status: data.status,
      items: existing.items,
      total: existing.total,
      cancelReason: data.cancelReason ?? existing.cancelReason,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    });

    this.orders.set(existing.id, updated);
    if (data.messageId) {
      this.processedMessages.add(data.messageId);
    }
    if (data.outboxEvent) {
      this.outboxEvents.push({
        eventType: data.outboxEvent.eventType,
        payload: data.outboxEvent.payload,
      });
    }

    return updated;
  }
}

describe('Order Service Use Cases & Saga State Machine', () => {
  let repo: InMemoryOrderRepository;
  let createOrderUseCase: CreateOrderUseCase;
  let listUserOrdersUseCase: ListUserOrdersUseCase;
  let getOrderByIdUseCase: GetOrderByIdUseCase;
  let updateOrderStatusUseCase: UpdateOrderStatusUseCase;

  beforeEach(() => {
    repo = new InMemoryOrderRepository();
    createOrderUseCase = new CreateOrderUseCase(repo, new FakeProductCatalog());
    listUserOrdersUseCase = new ListUserOrdersUseCase(repo);
    getOrderByIdUseCase = new GetOrderByIdUseCase(repo);
    updateOrderStatusUseCase = new UpdateOrderStatusUseCase(repo);
  });

  it('should calculate order total on server and emit ORDER_CREATED to outbox', async () => {
    const order = await createOrderUseCase.execute({
      userId: 'user-123',
      items: [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
    });

    expect(order.status).toBe('PENDING');
    expect(order.total).toBe(1388.8);
    expect(order.items[0]?.sku).toBe('TEC-MEC-PRO-001');
    expect(repo.outboxEvents).toHaveLength(1);
    expect(repo.outboxEvents[0]?.eventType).toBe('ORDER_CREATED');
  });

  it('should ignore client-supplied prices and use catalog prices (anti price tampering)', async () => {
    const tampered = {
      userId: 'attacker',
      items: [{ productId: 'p3', quantity: 1, price: 0.01, name: 'Hacked', sku: 'FAKE' }],
    } as unknown as Parameters<CreateOrderUseCase['execute']>[0];

    const order = await createOrderUseCase.execute(tampered);

    expect(order.total).toBe(3199);
    expect(order.items[0]?.price).toBe(3199);
    expect(order.items[0]?.sku).toBe('MON-4K-DEV-003');
    expect(order.items[0]?.name).toBe('Monitor 4K');
  });

  it('should merge repeated lines of the same product into a single item', async () => {
    const order = await createOrderUseCase.execute({
      userId: 'user-123',
      items: [
        { productId: 'p2', quantity: 1 },
        { productId: 'p2', quantity: 2 },
      ],
    });

    expect(order.items).toHaveLength(1);
    expect(order.items[0]?.quantity).toBe(3);
    expect(order.total).toBe(867);
  });

  it('should reject unknown or inactive products', async () => {
    await expect(
      createOrderUseCase.execute({ userId: 'u', items: [{ productId: 'ghost', quantity: 1 }] })
    ).rejects.toBeInstanceOf(ProductUnavailableError);
    await expect(
      createOrderUseCase.execute({ userId: 'u', items: [{ productId: 'p-off', quantity: 1 }] })
    ).rejects.toBeInstanceOf(ProductUnavailableError);
  });

  it('should only forward a FAILED outcome when payment failure is simulated', async () => {
    await createOrderUseCase.execute({ userId: 'u', items: [{ productId: 'p1', quantity: 1 }] });
    expect(repo.lastCreateData?.simulateOutcome).toBeUndefined();

    await createOrderUseCase.execute({
      userId: 'u',
      items: [{ productId: 'p1', quantity: 1 }],
      simulatePaymentFailure: true,
    });
    expect(repo.lastCreateData?.simulateOutcome).toBe('FAILED');
  });

  it('should never move a CANCELLED order to PAID', async () => {
    const created = await createOrderUseCase.execute({
      userId: 'u',
      items: [{ productId: 'p1', quantity: 1 }],
    });
    await updateOrderStatusUseCase.execute({ orderId: created.id, eventType: 'STOCK_REJECTED' });
    const afterLatePayment = await updateOrderStatusUseCase.execute({
      orderId: created.id,
      eventType: 'PAYMENT_APPROVED',
    });

    expect(afterLatePayment?.status).toBe('CANCELLED');
  });

  it('should transition PENDING -> STOCK_RESERVED -> PAID and emit ORDER_CONFIRMED', async () => {
    const created = await createOrderUseCase.execute({
      userId: 'user-123',
      items: [
        { productId: 'p1', quantity: 1 },
      ],
    });

    const reserved = await updateOrderStatusUseCase.execute({
      orderId: created.id,
      eventType: 'STOCK_RESERVED',
      messageId: 'msg-stock-1',
    });
    expect(reserved?.status).toBe('STOCK_RESERVED');

    const paid = await updateOrderStatusUseCase.execute({
      orderId: created.id,
      eventType: 'PAYMENT_APPROVED',
      messageId: 'msg-pay-1',
    });
    expect(paid?.status).toBe('PAID');
    expect(repo.outboxEvents.at(-1)?.eventType).toBe('ORDER_CONFIRMED');
  });

  it('should cancel order on STOCK_REJECTED and emit ORDER_CANCELLED with reason', async () => {
    const created = await createOrderUseCase.execute({
      userId: 'user-123',
      items: [
        { productId: 'p3', quantity: 2 },
      ],
    });

    const cancelled = await updateOrderStatusUseCase.execute({
      orderId: created.id,
      eventType: 'STOCK_REJECTED',
      reason: 'INSUFFICIENT_STOCK:MON-4K-DEV-003',
      messageId: 'msg-reject-1',
    });

    expect(cancelled?.status).toBe('CANCELLED');
    expect(cancelled?.cancelReason).toBe('INSUFFICIENT_STOCK:MON-4K-DEV-003');
    expect(repo.outboxEvents.at(-1)?.eventType).toBe('ORDER_CANCELLED');
  });

  it('should enforce ownership check when getting order by ID (prevent IDOR)', async () => {
    const created = await createOrderUseCase.execute({
      userId: 'owner-user',
      items: [
        { productId: 'p1', quantity: 1 },
      ],
    });

    await expect(
      getOrderByIdUseCase.execute(created.id, 'intruder-user', 'CUSTOMER')
    ).rejects.toThrow(OrderAccessDeniedError);

    const adminView = await getOrderByIdUseCase.execute(created.id, 'admin-user', 'ADMIN');
    expect(adminView.id).toBe(created.id);

    const userOrders = await listUserOrdersUseCase.execute('owner-user');
    expect(userOrders).toHaveLength(1);
  });

  it('should throw OrderNotFoundError for unknown order ID', async () => {
    await expect(
      getOrderByIdUseCase.execute('non-existent', 'owner-user', 'CUSTOMER')
    ).rejects.toThrow(OrderNotFoundError);
  });

  it('should verify valid HS256 JWT token for customer checkout', () => {
    const secret = 'test-order-jwt-secret';
    const token = jwt.sign(
      { userId: 'u-customer-1', email: 'dev@microstore.io', role: 'CUSTOMER' },
      secret,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    const decoded = verifyOrderJwt(`Bearer ${token}`, secret);
    expect(decoded.userId).toBe('u-customer-1');
    expect(decoded.role).toBe('CUSTOMER');
  });
});
