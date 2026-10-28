import { OrderItem, type Order } from '../domain/entities/Order.js';
import { type IOrderRepository } from '../domain/repositories/IOrderRepository.js';

export interface CreateOrderInput {
  userId: string;
  items: Array<{
    productId: string;
    sku: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  simulateOutcome?: 'APPROVED' | 'FAILED';
}

export class CreateOrderUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    if (!input.userId || !input.userId.trim()) {
      throw new Error('ORDER_USER_ID_REQUIRED');
    }
    if (!input.items || input.items.length === 0) {
      throw new Error('ORDER_ITEMS_EMPTY');
    }

    const validatedItems = input.items.map(
      (i) =>
        new OrderItem({
          productId: i.productId.trim(),
          sku: i.sku.trim().toUpperCase(),
          name: i.name.trim(),
          price: i.price,
          quantity: i.quantity,
        })
    );

    const serverCalculatedTotal = Number(
      validatedItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)
    );

    return this.orderRepository.createWithOutbox({
      userId: input.userId.trim(),
      items: validatedItems.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      total: serverCalculatedTotal,
      ...(input.simulateOutcome ? { simulateOutcome: input.simulateOutcome } : {}),
    });
  }
}
