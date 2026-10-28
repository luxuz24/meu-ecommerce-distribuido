import { type FastifyReply, type FastifyRequest } from 'fastify';
import { OrderAccessDeniedError, OrderNotFoundError } from '../../../domain/errors/OrderErrors.js';
import { type CreateOrderUseCase } from '../../../use-cases/CreateOrderUseCase.js';
import {
  type GetOrderByIdUseCase,
  type ListUserOrdersUseCase,
} from '../../../use-cases/GetOrderUseCases.js';
import {
  type OrderSagaEventType,
  type UpdateOrderStatusUseCase,
} from '../../../use-cases/UpdateOrderStatusUseCase.js';

export class OrderController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly listUserOrdersUseCase: ListUserOrdersUseCase,
    private readonly getOrderByIdUseCase: GetOrderByIdUseCase,
    private readonly updateOrderStatusUseCase: UpdateOrderStatusUseCase
  ) {}

  async create(
    request: FastifyRequest<{
      Body: {
        items: Array<{
          productId: string;
          sku: string;
          name: string;
          price: number;
          quantity: number;
        }>;
        simulateOutcome?: 'APPROVED' | 'FAILED';
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.authUser) {
      reply.status(401).send({ error: 'UNAUTHORIZED' });
      return;
    }

    const order = await this.createOrderUseCase.execute({
      userId: request.authUser.userId,
      items: request.body.items,
      ...(request.body.simulateOutcome ? { simulateOutcome: request.body.simulateOutcome } : {}),
    });

    reply.status(201).send(order);
  }

  async listMyOrders(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.authUser) {
      reply.status(401).send({ error: 'UNAUTHORIZED' });
      return;
    }

    const orders = await this.listUserOrdersUseCase.execute(request.authUser.userId);
    reply.status(200).send({ items: orders, total: orders.length });
  }

  async getById(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.authUser) {
      reply.status(401).send({ error: 'UNAUTHORIZED' });
      return;
    }

    try {
      const order = await this.getOrderByIdUseCase.execute(
        request.params.id,
        request.authUser.userId,
        request.authUser.role
      );
      reply.status(200).send(order);
    } catch (err) {
      if (err instanceof OrderNotFoundError) {
        reply.status(404).send({ error: err.message });
        return;
      }
      if (err instanceof OrderAccessDeniedError) {
        reply.status(403).send({ error: err.message });
        return;
      }
      throw err;
    }
  }

  async handleSagaTransition(
    request: FastifyRequest<{
      Params: { id: string };
      Body: {
        eventType: OrderSagaEventType;
        reason?: string;
        messageId?: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    const updated = await this.updateOrderStatusUseCase.execute({
      orderId: request.params.id,
      eventType: request.body.eventType,
      ...(request.body.reason !== undefined ? { reason: request.body.reason } : {}),
      ...(request.body.messageId !== undefined ? { messageId: request.body.messageId } : {}),
    });

    if (!updated) {
      reply.status(404).send({ error: `ORDER_NOT_FOUND: ${request.params.id}` });
      return;
    }

    reply.status(200).send(updated);
  }
}
