import { type FastifyInstance } from 'fastify';
import { type OrderController } from '../controllers/OrderController.js';
import { requireAdminAuth, requireUserAuth } from '../middlewares/AuthMiddleware.js';
import { type OrderSagaEventType } from '../../../use-cases/UpdateOrderStatusUseCase.js';

export async function registerOrderRoutes(
  app: FastifyInstance,
  controller: OrderController
): Promise<void> {
  app.post<{
    Body: {
      items: Array<{ productId: string; quantity: number }>;
      simulatePaymentFailure?: boolean;
    };
  }>(
    '/orders',
    {
      preHandler: [requireUserAuth],
      schema: {
        body: {
          type: 'object',
          required: ['items'],
          additionalProperties: false,
          properties: {
            simulatePaymentFailure: { type: 'boolean' },
            items: {
              type: 'array',
              minItems: 1,
              maxItems: 50,
              items: {
                type: 'object',
                required: ['productId', 'quantity'],
                additionalProperties: false,
                properties: {
                  productId: { type: 'string', minLength: 1, maxLength: 120 },
                  quantity: { type: 'integer', minimum: 1, maximum: 1000 },
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => controller.create(req, reply)
  );

  app.get(
    '/orders',
    {
      preHandler: [requireUserAuth],
    },
    async (req, reply) => controller.listMyOrders(req, reply)
  );

  app.get<{ Params: { id: string } }>(
    '/orders/:id',
    {
      preHandler: [requireUserAuth],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: {
            id: { type: 'string', minLength: 1, maxLength: 120 },
          },
        },
      },
    },
    async (req, reply) => controller.getById(req, reply)
  );

  app.patch<{
    Params: { id: string };
    Body: {
      eventType: OrderSagaEventType;
      reason?: string;
      messageId?: string;
    };
  }>(
    '/orders/:id/saga-event',
    {
      preHandler: [requireAdminAuth],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: {
            id: { type: 'string', minLength: 1, maxLength: 120 },
          },
        },
        body: {
          type: 'object',
          required: ['eventType'],
          additionalProperties: false,
          properties: {
            eventType: {
              type: 'string',
              enum: [
                'STOCK_RESERVED',
                'STOCK_REJECTED',
                'PAYMENT_APPROVED',
                'PAYMENT_FAILED',
                'RESERVATION_EXPIRED',
              ],
            },
            reason: { type: 'string', maxLength: 250 },
            messageId: { type: 'string', maxLength: 120 },
          },
        },
      },
    },
    async (req, reply) => controller.handleSagaTransition(req, reply)
  );
}
