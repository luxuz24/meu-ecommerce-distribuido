import { type Order } from '../domain/entities/Order.js';
import { OrderAccessDeniedError, OrderNotFoundError } from '../domain/errors/OrderErrors.js';
import { type IOrderRepository } from '../domain/repositories/IOrderRepository.js';

export class ListUserOrdersUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(userId: string): Promise<Order[]> {
    return this.orderRepository.findByUserId(userId);
  }
}

export class GetOrderByIdUseCase {
  constructor(private readonly orderRepository: IOrderRepository) {}

  async execute(orderId: string, requesterUserId: string, requesterRole: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError(orderId);
    }

    if (order.userId !== requesterUserId && requesterRole !== 'ADMIN') {
      throw new OrderAccessDeniedError(orderId);
    }

    return order;
  }
}
