import { type ConfirmChannel } from 'amqplib';
import { type PrismaClient } from '@prisma/client';
import { type ReserveStockUseCase } from '../../use-cases/ReserveStockUseCase.js';
import { type ReleaseStockUseCase } from '../../use-cases/ReleaseStockUseCase.js';
import { type ConfirmStockUseCase } from '../../use-cases/ConfirmStockUseCase.js';
import { ResilientRabbitConnection, startOutboxRelay } from './ResilientRabbit.js';

const EXCHANGE_NAME = 'ecommerce_events';
const DLX_EXCHANGE_NAME = 'ecommerce_events_dlx';
const ORDER_CREATED_QUEUE = 'inventory_order_created';
const ORDER_CREATED_DLQ = 'inventory_order_created_dlq';
const PAYMENT_FAILED_QUEUE = 'inventory_payment_failed';
const PAYMENT_FAILED_DLQ = 'inventory_payment_failed_dlq';
const ORDER_CONFIRMED_QUEUE = 'inventory_order_confirmed';
const ORDER_CONFIRMED_DLQ = 'inventory_order_confirmed_dlq';
const SERVICE_NAME = 'inventory-service';

function parsePayload(content: Buffer) {
  const raw = JSON.parse(content.toString());
  return raw.payload ? (typeof raw.payload === 'string' ? JSON.parse(raw.payload) : raw.payload) : raw;
}

export function startInventoryMessaging(
  prisma: PrismaClient,
  reserveStockUseCase: ReserveStockUseCase,
  releaseStockUseCase: ReleaseStockUseCase,
  confirmStockUseCase: ConfirmStockUseCase
): ResilientRabbitConnection | null {
  const rabbitUrl = process.env.RABBITMQ_URL;
  if (!rabbitUrl) {
    console.warn(`[${SERVICE_NAME}] RABBITMQ_URL not set; skipping RabbitMQ consumer/outbox worker`);
    return null;
  }

  const setupTopology = async (channel: ConfirmChannel): Promise<void> => {
    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    await channel.assertExchange(DLX_EXCHANGE_NAME, 'direct', { durable: true });

    await channel.assertQueue(ORDER_CREATED_DLQ, { durable: true });
    await channel.bindQueue(ORDER_CREATED_DLQ, DLX_EXCHANGE_NAME, ORDER_CREATED_DLQ);
    await channel.assertQueue(PAYMENT_FAILED_DLQ, { durable: true });
    await channel.bindQueue(PAYMENT_FAILED_DLQ, DLX_EXCHANGE_NAME, PAYMENT_FAILED_DLQ);
    await channel.assertQueue(ORDER_CONFIRMED_DLQ, { durable: true });
    await channel.bindQueue(ORDER_CONFIRMED_DLQ, DLX_EXCHANGE_NAME, ORDER_CONFIRMED_DLQ);

    // 1. Consumer: order_created
    await channel.assertQueue(ORDER_CREATED_QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DLX_EXCHANGE_NAME,
        'x-dead-letter-routing-key': ORDER_CREATED_DLQ,
      },
    });
    await channel.bindQueue(ORDER_CREATED_QUEUE, EXCHANGE_NAME, 'order_created');

    await channel.consume(ORDER_CREATED_QUEUE, async (msg) => {
      if (!msg) return;
      try {
        const payload = parsePayload(msg.content);
        const messageId = msg.properties.messageId || payload.messageId || `order_${payload.orderId}`;

        await reserveStockUseCase.execute({
          messageId: String(messageId),
          orderId: String(payload.orderId),
          ...(payload.userId ? { userId: String(payload.userId) } : {}),
          ...(typeof payload.total === 'number' ? { total: payload.total } : {}),
          ...(payload.simulateOutcome ? { simulateOutcome: payload.simulateOutcome } : {}),
          items: Array.isArray(payload.items)
            ? payload.items.map((i: { sku: string; quantity?: number; qty?: number; price?: number; name?: string }) => ({
                sku: String(i.sku),
                quantity: Number(i.quantity ?? i.qty ?? 1),
                ...(typeof i.price === 'number' ? { price: i.price } : {}),
                ...(i.name ? { name: String(i.name) } : {}),
              }))
            : [],
        });

        channel.ack(msg);
      } catch (err) {
        console.error(`[${SERVICE_NAME}] Error processing order_created event:`, err);
        channel.nack(msg, false, false);
      }
    });

    // 2. Consumer: payment_failed (compensation)
    await channel.assertQueue(PAYMENT_FAILED_QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DLX_EXCHANGE_NAME,
        'x-dead-letter-routing-key': PAYMENT_FAILED_DLQ,
      },
    });
    await channel.bindQueue(PAYMENT_FAILED_QUEUE, EXCHANGE_NAME, 'payment_failed');

    await channel.consume(PAYMENT_FAILED_QUEUE, async (msg) => {
      if (!msg) return;
      try {
        const payload = parsePayload(msg.content);
        const messageId = msg.properties.messageId || payload.messageId || `payfail_${payload.orderId}`;

        await releaseStockUseCase.execute(String(payload.orderId), String(messageId));
        channel.ack(msg);
      } catch (err) {
        console.error(`[${SERVICE_NAME}] Error processing payment_failed event:`, err);
        channel.nack(msg, false, false);
      }
    });

    // 3. Consumer: order_confirmed (reserva vira baixa definitiva)
    await channel.assertQueue(ORDER_CONFIRMED_QUEUE, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': DLX_EXCHANGE_NAME,
        'x-dead-letter-routing-key': ORDER_CONFIRMED_DLQ,
      },
    });
    await channel.bindQueue(ORDER_CONFIRMED_QUEUE, EXCHANGE_NAME, 'order_confirmed');

    await channel.consume(ORDER_CONFIRMED_QUEUE, async (msg) => {
      if (!msg) return;
      try {
        const payload = parsePayload(msg.content);
        const messageId = msg.properties.messageId || payload.messageId || `confirmed_${payload.orderId}`;

        await confirmStockUseCase.execute(String(payload.orderId), String(messageId));
        channel.ack(msg);
      } catch (err) {
        console.error(`[${SERVICE_NAME}] Error processing order_confirmed event:`, err);
        channel.nack(msg, false, false);
      }
    });
  };

  const rabbit = new ResilientRabbitConnection(rabbitUrl, SERVICE_NAME, setupTopology);
  rabbit.start();
  // 4. Outbox Relay Worker
  startOutboxRelay(prisma, rabbit, EXCHANGE_NAME, SERVICE_NAME);
  return rabbit;
}
