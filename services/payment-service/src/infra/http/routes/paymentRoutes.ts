import { type FastifyInstance } from 'fastify';
import { type PaymentController } from '../controllers/PaymentController.js';
import { requireAdminAuth, requireUserAuth } from '../middlewares/AuthMiddleware.js';

export async function registerPaymentRoutes(
  app: FastifyInstance,
  controller: PaymentController
): Promise<void> {
  app.get<{ Params: { orderId: string } }>(
    '/payments/:orderId',
    {
      preHandler: [requireUserAuth],
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
    async (req, reply) => controller.getByOrderId(req, reply)
  );

  app.post<{
    Body: {
      orderId: string;
      userId?: string;
      amount: number;
      simulateOutcome?: 'APPROVED' | 'FAILED';
      failureReason?: string;
      messageId?: string;
    };
  }>(
    '/payments/process',
    {
      preHandler: [requireAdminAuth],
      schema: {
        body: {
          type: 'object',
          required: ['orderId', 'amount'],
          additionalProperties: false,
          properties: {
            orderId: { type: 'string', minLength: 1, maxLength: 120 },
            userId: { type: 'string', minLength: 1, maxLength: 120 },
            amount: { type: 'number', minimum: 0, maximum: 10000000 },
            simulateOutcome: {
              type: 'string',
              enum: ['APPROVED', 'FAILED'],
            },
            failureReason: { type: 'string', maxLength: 250 },
            messageId: { type: 'string', maxLength: 120 },
          },
        },
      },
    },
    async (req, reply) => controller.processPayment(req, reply)
  );
}
