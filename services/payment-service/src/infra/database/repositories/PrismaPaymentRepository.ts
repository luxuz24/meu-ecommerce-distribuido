import { type Payment as PaymentRow, type PrismaClient } from '@prisma/client';
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
    return raw ? toDomain(raw) : null;
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
                payment: toDomain(existing),
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
            payment: toDomain(decided),
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
              // A mesma chave serve ao evento stock_reserved e à rota admin
              eventType: 'PAYMENT_PROCESSING',
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
          payment: toDomain(created),
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
            payment: toDomain(winner),
          };
        }
      }
      throw err;
    }
  }
}

function toDomain(row: PaymentRow): Payment {
  return new Payment({
    id: row.id,
    orderId: row.orderId,
    userId: row.userId,
    amount: row.amount,
    status: row.status as PaymentStatus,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
  });
}
