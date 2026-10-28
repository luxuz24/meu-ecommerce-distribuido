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
      items: Array<{
        productId: string;
        sku: string;
        name: string;
        price: number;
        quantity: number;
      }>;
      simulateOutcome?: 'APPROVED' | 'FAILED';
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
            simulateOutcome: {
              type: 'string',
              enum: ['APPROVED', 'FAILED'],
            },
            items: {
              type: 'array',
              minItems: 1,
              maxItems: 50,
              items: {
                type: 'object',
                required: ['productId', 'sku', 'name', 'price', 'quantity'],
                additionalProperties: false,
                properties: {
                  productId: { type: 'string', minLength: 1, maxLength: 120 },
                  sku: { type: 'string', minLength: 2, maxLength: 64 },
                  name: { type: 'string', minLength: 1, maxLength: 200 },
                  price: { type: 'number', minimum: 0, maximum: 1000000 },
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
