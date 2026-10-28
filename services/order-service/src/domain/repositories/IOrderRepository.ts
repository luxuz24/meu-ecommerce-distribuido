import { type Order, type OrderStatus } from '../entities/Order.js';

export interface CreateOrderItemData {
  productId: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CreateOrderData {
  userId: string;
  items: CreateOrderItemData[];
  total: number;
  simulateOutcome?: 'APPROVED' | 'FAILED';
}

export interface UpdateOrderStatusData {
  orderId: string;
  status: OrderStatus;
  cancelReason?: string;
  messageId?: string;
  sourceEvent: string;
  outboxEvent?: {
    eventType: 'ORDER_CONFIRMED' | 'ORDER_CANCELLED';
    payload: Record<string, unknown>;
  };
}

export interface IOrderRepository {
  createWithOutbox(data: CreateOrderData): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findByUserId(userId: string): Promise<Order[]>;
  updateStatusWithOutbox(data: UpdateOrderStatusData): Promise<Order | null>;
}
