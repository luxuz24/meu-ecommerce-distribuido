import amqp from 'amqplib';
import { type PrismaClient } from '@prisma/client';
import { type ProcessPaymentUseCase } from '../../use-cases/PaymentUseCases.js';

const EXCHANGE_NAME = 'ecommerce_events';
const STOCK_RESERVED_QUEUE = 'payment_stock_reserved';
const OUTBOX_POLL_MS = 3000;

export async function startPaymentMessaging(
  prisma: PrismaClient,
  processPaymentUseCase: ProcessPaymentUseCase
): Promise<void> {
  const rabbitUrl = process.env.RABBITMQ_URL;
  if (!rabbitUrl) {
    console.warn('[payment-service] RABBITMQ_URL not set; skipping RabbitMQ consumer/outbox worker');
    return;
  }

  try {
    const conn = await amqp.connect(rabbitUrl);
    const channel = await conn.createChannel();
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

    await channel.assertQueue(STOCK_RESERVED_QUEUE, { durable: true });
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
        console.error('[payment-service] Error processing stock_reserved event:', err);
        channel.nack(msg, false, false);
      }
    });

    setInterval(async () => {
      try {
        const pending = await prisma.outbox.findMany({
          where: { published: false },
          orderBy: { createdAt: 'asc' },
          take: 20,
        });

        for (const event of pending) {
          const routingKey = event.eventType.toLowerCase();
          const published = channel.publish(
            EXCHANGE_NAME,
            routingKey,
            Buffer.from(JSON.stringify(event.payload)),
            {
              persistent: true,
              messageId: event.id,
            }
          );

          if (published) {
            await prisma.outbox.update({
              where: { id: event.id },
              data: { published: true },
            });
          }
        }
      } catch (err) {
        console.error('[payment-service] Outbox relay error:', err);
      }
    }, OUTBOX_POLL_MS);

    console.log('[payment-service] Connected to RabbitMQ (stock_reserved consumer + outbox relay)');
  } catch (err) {
    console.warn('[payment-service] Could not connect to RabbitMQ at startup:', err);
  }
}
