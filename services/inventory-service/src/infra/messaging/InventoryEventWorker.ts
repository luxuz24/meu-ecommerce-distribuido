import amqp from 'amqplib';
import { type PrismaClient } from '@prisma/client';
import { type ReserveStockUseCase } from '../../use-cases/ReserveStockUseCase.js';
import { type ReleaseStockUseCase } from '../../use-cases/ReleaseStockUseCase.js';

const EXCHANGE_NAME = 'ecommerce_events';
const ORDER_CREATED_QUEUE = 'inventory_order_created';
const PAYMENT_FAILED_QUEUE = 'inventory_payment_failed';
const OUTBOX_POLL_MS = 3000;

export async function startInventoryMessaging(
  prisma: PrismaClient,
  reserveStockUseCase: ReserveStockUseCase,
  releaseStockUseCase: ReleaseStockUseCase
): Promise<void> {
  const rabbitUrl = process.env.RABBITMQ_URL;
  if (!rabbitUrl) {
    console.warn('[inventory-service] RABBITMQ_URL not set; skipping RabbitMQ consumer/outbox worker');
    return;
  }

  try {
    const conn = await amqp.connect(rabbitUrl);
    const channel = await conn.createChannel();
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

    // 1. Consumer: order_created
    await channel.assertQueue(ORDER_CREATED_QUEUE, { durable: true });
    await channel.bindQueue(ORDER_CREATED_QUEUE, EXCHANGE_NAME, 'order_created');

    await channel.consume(ORDER_CREATED_QUEUE, async (msg) => {
      if (!msg) return;
      try {
        const raw = JSON.parse(msg.content.toString());
        const payload = raw.payload ? (typeof raw.payload === 'string' ? JSON.parse(raw.payload) : raw.payload) : raw;
        const messageId = msg.properties.messageId || payload.messageId || `order_${payload.orderId}`;

        await reserveStockUseCase.execute({
          messageId: String(messageId),
          orderId: String(payload.orderId),
          items: Array.isArray(payload.items)
            ? payload.items.map((i: { sku: string; quantity?: number; qty?: number }) => ({
                sku: String(i.sku),
                quantity: Number(i.quantity ?? i.qty ?? 1),
              }))
            : [],
        });

        channel.ack(msg);
      } catch (err) {
        console.error('[inventory-service] Error processing order_created event:', err);
        channel.nack(msg, false, false);
      }
    });

    // 2. Consumer: payment_failed (compensation)
    await channel.assertQueue(PAYMENT_FAILED_QUEUE, { durable: true });
    await channel.bindQueue(PAYMENT_FAILED_QUEUE, EXCHANGE_NAME, 'payment_failed');

    await channel.consume(PAYMENT_FAILED_QUEUE, async (msg) => {
      if (!msg) return;
      try {
        const raw = JSON.parse(msg.content.toString());
        const payload = raw.payload ? (typeof raw.payload === 'string' ? JSON.parse(raw.payload) : raw.payload) : raw;
        const messageId = msg.properties.messageId || payload.messageId || `payfail_${payload.orderId}`;

        await releaseStockUseCase.execute(String(payload.orderId), String(messageId));
        channel.ack(msg);
      } catch (err) {
        console.error('[inventory-service] Error processing payment_failed event:', err);
        channel.nack(msg, false, false);
      }
    });

    // 3. Outbox Relay Worker
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
        console.error('[inventory-service] Outbox relay error:', err);
      }
    }, OUTBOX_POLL_MS);

    console.log('[inventory-service] Connected to RabbitMQ (order_created & payment_failed consumers + outbox relay)');
  } catch (err) {
    console.warn('[inventory-service] Could not connect to RabbitMQ at startup:', err);
  }
}
