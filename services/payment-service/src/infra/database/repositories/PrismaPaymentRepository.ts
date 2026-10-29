import { type PrismaClient } from '@prisma/client';
import { currentCorrelationId } from '../../observability/correlation.js';
import { Payment, type PaymentStatus } from '../../../domain/entities/Payment.js';
import {
  type IPaymentRepository,
  type ProcessPaymentData,
  type ProcessPaymentResult,
} from '../../../domain/repositories/IPaymentRepository.js';

export class PrismaPaymentRepository implements IPaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByOrderId(orderId: string): Promise<Payment | null> {
    const raw = await this.prisma.payment.findUnique({
      where: { orderId },
    });
    if (!raw) return null;

    return new Payment({
      id: raw.id,
      orderId: raw.orderId,
      userId: raw.userId,
      amount: raw.amount,
      status: raw.status as PaymentStatus,
      failureReason: raw.failureReason,
      createdAt: raw.createdAt,
    });
  }

  async processWithOutbox(data: ProcessPaymentData): Promise<ProcessPaymentResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (data.messageId) {
          const already = await tx.processedMessage.findUnique({
            where: { messageId: data.messageId },
          });
          if (already) {
            const existing = await tx.payment.findUnique({
              where: { orderId: data.orderId },
            });
            if (existing) {
              return {
                event: 'ALREADY_PROCESSED',
                payment: new Payment({
                  id: existing.id,
                  orderId: existing.orderId,
                  userId: existing.userId,
                  amount: existing.amount,
                  status: existing.status as PaymentStatus,
                  failureReason: existing.failureReason,
                  createdAt: existing.createdAt,
                }),
              };
            }
          }
        }

        // Pagamento decidido é imutável: um segundo processamento do mesmo pedido (outro
        // messageId, rota admin) não troca o resultado nem publica um novo evento.
        const decided = await tx.payment.findUnique({ where: { orderId: data.orderId } });
        if (decided) {
          return {
            event: 'ALREADY_PROCESSED',
            payment: new Payment({
              id: decided.id,
              orderId: decided.orderId,
              userId: decided.userId,
              amount: decided.amount,
              status: decided.status as PaymentStatus,
              failureReason: decided.failureReason,
              createdAt: decided.createdAt,
            }),
          };
        }

        const created = await tx.payment.create({
          data: {
            orderId: data.orderId,
            userId: data.userId,
            amount: data.amount,
            status: data.status,
            failureReason: data.failureReason ?? null,
          },
        });

        if (data.messageId) {
          await tx.processedMessage.create({
            data: {
              messageId: data.messageId,
              eventType: 'STOCK_RESERVED',
            },
          });
        }

        const eventType =
          data.status === 'APPROVED' ? 'PAYMENT_APPROVED' : 'PAYMENT_FAILED';

        await tx.outbox.create({
          data: {
            correlationId: currentCorrelationId(),
            aggregateType: 'Payment',
            aggregateId: created.id,
            eventType,
            payload: {
              orderId: created.orderId,
              paymentId: created.id,
              userId: created.userId,
              amount: created.amount,
              status: created.status,
              ...(created.failureReason ? { reason: created.failureReason } : {}),
            },
          },
        });

        return {
          event: eventType,
          payment: new Payment({
            id: created.id,
            orderId: created.orderId,
            userId: created.userId,
            amount: created.amount,
            status: created.status as PaymentStatus,
            failureReason: created.failureReason,
            createdAt: created.createdAt,
          }),
        };
      });
    } catch (err) {
      // Entrega concorrente do mesmo pedido/mensagem: a outra transação venceu a chave
      // única (orderId ou messageId). Efeito único garantido; isto não é erro para a DLQ.
      if ((err as { code?: unknown }).code === 'P2002') {
        const winner = await this.prisma.payment.findUnique({ where: { orderId: data.orderId } });
        if (winner) {
          return {
            event: 'ALREADY_PROCESSED',
            payment: new Payment({
              id: winner.id,
              orderId: winner.orderId,
              userId: winner.userId,
              amount: winner.amount,
              status: winner.status as PaymentStatus,
              failureReason: winner.failureReason,
              createdAt: winner.createdAt,
            }),
          };
        }
      }
      throw err;
    }
  }
}
