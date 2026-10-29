import { type FastifyReply, type FastifyRequest } from 'fastify';
import {
  InvalidPaymentError,
  PaymentAccessDeniedError,
  PaymentNotFoundError,
} from '../../../domain/errors/PaymentErrors.js';
import {
  type GetPaymentByOrderIdUseCase,
  type ProcessPaymentUseCase,
} from '../../../use-cases/PaymentUseCases.js';

export class PaymentController {
  constructor(
    private readonly processPaymentUseCase: ProcessPaymentUseCase,
    private readonly getPaymentByOrderIdUseCase: GetPaymentByOrderIdUseCase
  ) {}

  async getByOrderId(
    request: FastifyRequest<{ Params: { orderId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.authUser) {
      reply.status(401).send({ error: 'UNAUTHORIZED' });
      return;
    }

    try {
      const payment = await this.getPaymentByOrderIdUseCase.execute(request.params.orderId, {
        userId: request.authUser.userId,
        role: request.authUser.role,
      });
      reply.status(200).send(payment);
    } catch (err) {
      if (err instanceof PaymentNotFoundError) {
        reply.status(404).send({ error: err.message });
        return;
      }
      if (err instanceof PaymentAccessDeniedError) {
        reply.status(403).send({ error: err.message });
        return;
      }
      throw err;
    }
  }

  async processPayment(
    request: FastifyRequest<{
      Body: {
        orderId: string;
        userId?: string;
        amount: number;
        simulateOutcome?: 'APPROVED' | 'FAILED';
        failureReason?: string;
        messageId?: string;
      };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const result = await this.processPaymentUseCase.execute(request.body);
      reply.status(200).send(result);
    } catch (err) {
      if (err instanceof InvalidPaymentError) {
        reply.status(400).send({ error: err.message });
        return;
      }
      throw err;
    }
  }
}
