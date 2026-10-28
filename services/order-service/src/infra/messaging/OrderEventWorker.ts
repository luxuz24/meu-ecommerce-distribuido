import amqp from 'amqplib';
import { type PrismaClient } from '@prisma/client';
import {
  type OrderSagaEventType,
  type UpdateOrderStatusUseCase,
} from '../../use-cases/UpdateOrderStatusUseCase.js';

const EXCHANGE_NAME = 'ecommerce_events';
const DLX_EXCHANGE_NAME = 'ecommerce_events_dlx';
const ORDER_SAGA_QUEUE = 'order_saga_events';
const ORDER_SAGA_DLQ = 'order_saga_events_dlq';
const OUTBOX_POLL_MS = 3000;

const ROUTING_KEY_TO_EVENT: Record<string, OrderSagaEventType> = {
  stock_reserved: 'STOCK_RESERVED',
  stock_rejected: 'STOCK_REJECTED',
  payment_approved: 'PAYMENT_APPROVED',
  payment_failed: 'PAYMENT_FAILED',
};

export async function startOrderMessaging(
  prisma: PrismaClient,
  updateOrderStatusUseCase: UpdateOrderStatusUseCase
): Promise<void> {
  const rabbitUrl = process.env.RABBITMQ_URL;
  if (!rabbitUrl) {
    console.warn('[order-service] RABBITMQ_URL not set; skipping RabbitMQ consumer/outbox worker');
    return;
  }

  try {
    const conn = await amqp.connect(rabbitUrl);
    const channel = await conn.createChannel();
    // Backpressure: no máximo N mensagens não confirmadas em processamento simultâneo
    await channel.prefetch(10);
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    await channel.assertExchange(DLX_EXCHANGE_NAME, 'direct', { durable: true });

    await channel.assertQueue(ORDER_SAGA_DLQ, { durable: true });
    await channel.bindQueue(ORDER_SAGA_DLQ, DLX_EXCHANGE_NAME, ORDER_SAGA_DLQ);

    await channel.assertQueue(ORDER_SAGA_QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DLX_EXCHANGE_NAME,
        'x-dead-letter-routing-key': ORDER_SAGA_DLQ,
      },
    });
    for (const key of Object.keys(ROUTING_KEY_TO_EVENT)) {
      await channel.bindQueue(ORDER_SAGA_QUEUE, EXCHANGE_NAME, key);
    }

    await channel.consume(ORDER_SAGA_QUEUE, async (msg) => {
      if (!msg) return;
      try {
        const routingKey = msg.fields.routingKey;
        const eventType = ROUTING_KEY_TO_EVENT[routingKey];
        if (!eventType) {
          channel.ack(msg);
          return;
        }

        const raw = JSON.parse(msg.content.toString());
        const payload = raw.payload
          ? typeof raw.payload === 'string'
            ? JSON.parse(raw.payload)
            : raw.payload
          : raw;

        const messageId =
          msg.properties.messageId || payload.messageId || `${routingKey}_${payload.orderId}`;

        await updateOrderStatusUseCase.execute({
          eventType,
          orderId: String(payload.orderId),
          messageId: String(messageId),
          ...(payload.reason ? { reason: String(payload.reason) } : {}),
        });

        channel.ack(msg);
      } catch (err) {
        console.error('[order-service] Error processing Saga event:', err);
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
        console.error('[order-service] Outbox relay error:', err);
      }
    }, OUTBOX_POLL_MS);

    console.log('[order-service] Connected to RabbitMQ (Saga consumer + Outbox relay)');
  } catch (err) {
    console.warn('[order-service] Could not connect to RabbitMQ at startup:', err);
  }
}
