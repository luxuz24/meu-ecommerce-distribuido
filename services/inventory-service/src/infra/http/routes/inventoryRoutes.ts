import { type FastifyInstance } from 'fastify';
import { type InventoryController } from '../controllers/InventoryController.js';
import { requireAdminAuth } from '../middlewares/AuthMiddleware.js';

export async function registerInventoryRoutes(
  app: FastifyInstance,
  controller: InventoryController
): Promise<void> {
  app.get('/inventory', async (req, reply) => controller.listAll(req, reply));

  app.get<{ Params: { sku: string } }>(
    '/inventory/:sku',
    {
      schema: {
        params: {
          type: 'object',
          required: ['sku'],
          additionalProperties: false,
          properties: {
            sku: { type: 'string', minLength: 2, maxLength: 64 },
          },
        },
      },
    },
    async (req, reply) => controller.getBySku(req, reply)
  );

  app.post<{ Body: { productId: string; sku: string; availableQty: number } }>(
    '/inventory/seed',
    {
      preHandler: [requireAdminAuth],
      schema: {
        body: {
          type: 'object',
          required: ['productId', 'sku', 'availableQty'],
          additionalProperties: false,
          properties: {
            productId: { type: 'string', minLength: 1, maxLength: 120 },
            sku: { type: 'string', minLength: 2, maxLength: 64 },
            availableQty: { type: 'integer', minimum: 0, maximum: 1000000 },
          },
        },
      },
    },
    async (req, reply) => controller.upsertStock(req, reply)
  );

  app.post<{
    Body: {
      messageId?: string;
      orderId: string;
      items: Array<{ sku: string; quantity: number }>;
    };
  }>(
    '/inventory/reserve',
    {
      schema: {
        body: {
          type: 'object',
          required: ['orderId', 'items'],
          additionalProperties: false,
          properties: {
            messageId: { type: 'string', minLength: 1, maxLength: 120 },
            orderId: { type: 'string', minLength: 1, maxLength: 120 },
            items: {
              type: 'array',
              minItems: 1,
              maxItems: 50,
              items: {
                type: 'object',
                required: ['sku', 'quantity'],
                additionalProperties: false,
                properties: {
                  sku: { type: 'string', minLength: 2, maxLength: 64 },
                  quantity: { type: 'integer', minimum: 1, maximum: 10000 },
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => controller.reserveOrderStock(req, reply)
  );

  app.post<{
    Params: { orderId: string };
    Body?: { messageId?: string };
  }>(
    '/inventory/release/:orderId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['orderId'],
          additionalProperties: false,
          properties: {
            orderId: { type: 'string', minLength: 1, maxLength: 120 },
          },
        },
      },
    },
    async (req, reply) => controller.releaseOrderStock(req, reply)
  );
}
