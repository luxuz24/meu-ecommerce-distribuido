import { type FastifyReply, type FastifyRequest } from 'fastify';
import { PaymentNotFoundError } from '../../../domain/errors/PaymentErrors.js';
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
    try {
      const payment = await this.getPaymentByOrderIdUseCase.execute(
        request.params.orderId
      );
      reply.status(200).send(payment);
    } catch (err) {
      if (err instanceof PaymentNotFoundError) {
        reply.status(404).send({ error: err.message });
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
    const result = await this.processPaymentUseCase.execute(request.body);
    reply.status(200).send(result);
  }
}
