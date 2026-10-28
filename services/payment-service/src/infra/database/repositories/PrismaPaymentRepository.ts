import { type PrismaClient } from '@prisma/client';
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
    return this.prisma.$transaction(async (tx) => {
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

      const upserted = await tx.payment.upsert({
        where: { orderId: data.orderId },
        update: {
          amount: data.amount,
          status: data.status,
          failureReason: data.failureReason ?? null,
        },
        create: {
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
          aggregateType: 'Payment',
          aggregateId: upserted.id,
          eventType,
          payload: {
            orderId: upserted.orderId,
            paymentId: upserted.id,
            userId: upserted.userId,
            amount: upserted.amount,
            status: upserted.status,
            ...(upserted.failureReason ? { reason: upserted.failureReason } : {}),
          },
        },
      });

      return {
        event: eventType,
        payment: new Payment({
          id: upserted.id,
          orderId: upserted.orderId,
          userId: upserted.userId,
          amount: upserted.amount,
          status: upserted.status as PaymentStatus,
          failureReason: upserted.failureReason,
          createdAt: upserted.createdAt,
        }),
      };
    });
  }
}
