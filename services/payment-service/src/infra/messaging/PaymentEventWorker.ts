import { type ConfirmChannel } from 'amqplib';
import { type PrismaClient } from '@prisma/client';
import { type ProcessPaymentUseCase } from '../../use-cases/PaymentUseCases.js';
import { ResilientRabbitConnection, startOutboxRelay } from './ResilientRabbit.js';

const EXCHANGE_NAME = 'ecommerce_events';
const DLX_EXCHANGE_NAME = 'ecommerce_events_dlx';
const STOCK_RESERVED_QUEUE = 'payment_stock_reserved';
const STOCK_RESERVED_DLQ = 'payment_stock_reserved_dlq';
const SERVICE_NAME = 'payment-service';

export function startPaymentMessaging(
  prisma: PrismaClient,
  processPaymentUseCase: ProcessPaymentUseCase
): ResilientRabbitConnection | null {
  const rabbitUrl = process.env.RABBITMQ_URL;
  if (!rabbitUrl) {
    console.warn(`[${SERVICE_NAME}] RABBITMQ_URL not set; skipping RabbitMQ consumer/outbox worker`);
    return null;
  }

  const setupTopology = async (channel: ConfirmChannel): Promise<void> => {
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    await channel.assertExchange(DLX_EXCHANGE_NAME, 'direct', { durable: true });

    await channel.assertQueue(STOCK_RESERVED_DLQ, { durable: true });
    await channel.bindQueue(STOCK_RESERVED_DLQ, DLX_EXCHANGE_NAME, STOCK_RESERVED_DLQ);

    await channel.assertQueue(STOCK_RESERVED_QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DLX_EXCHANGE_NAME,
        'x-dead-letter-routing-key': STOCK_RESERVED_DLQ,
      },
    });
    await channel.bindQueue(STOCK_RESERVED_QUEUE, EXCHANGE_NAME, 'stock_reserved');

    await channel.consume(STOCK_RESERVED_QUEUE, async (msg) => {
      if (!msg) return;
      try {
        const raw = JSON.parse(msg.content.toString());
        const payload = raw.payload
          ? typeof raw.payload === 'string'
            ? JSON.parse(raw.payload)
            : raw.payload
          : raw;

        const messageId =
          msg.properties.messageId ||
          payload.messageId ||
          `stock_reserved_${payload.orderId}`;

        const calculatedAmount =
          typeof payload.total === 'number'
            ? payload.total
            : typeof payload.amount === 'number'
              ? payload.amount
              : Array.isArray(payload.items)
                ? payload.items.reduce(
                    (acc: number, i: { price?: number; quantity?: number }) =>
                      acc + Number(i.price ?? 0) * Number(i.quantity ?? 1),
                    0
                  )
                : 0;

        await processPaymentUseCase.execute({
          orderId: String(payload.orderId),
          userId: String(payload.userId ?? 'SYSTEM'),
          amount: Number(calculatedAmount),
          messageId: String(messageId),
          ...(payload.simulateOutcome === 'FAILED'
            ? { simulateOutcome: 'FAILED' }
            : {}),
        });

        channel.ack(msg);
      } catch (err) {
        console.error(`[${SERVICE_NAME}] Error processing stock_reserved event:`, err);
        channel.nack(msg, false, false);
      }
    });
  };

  const rabbit = new ResilientRabbitConnection(rabbitUrl, SERVICE_NAME, setupTopology);
  rabbit.start();
  startOutboxRelay(prisma, rabbit, EXCHANGE_NAME, SERVICE_NAME);
  return rabbit;
}
