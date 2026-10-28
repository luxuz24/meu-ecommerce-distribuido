import { type ConfirmChannel, type ConsumeMessage } from 'amqplib';
import { type PrismaClient } from '@prisma/client';
import {
  type OrderSagaEventType,
  type UpdateOrderStatusUseCase,
} from '../../use-cases/UpdateOrderStatusUseCase.js';
import { ResilientRabbitConnection, startOutboxRelay } from './ResilientRabbit.js';
import { runWithCorrelationId } from '../observability/correlation.js';

const EXCHANGE_NAME = 'ecommerce_events';
const DLX_EXCHANGE_NAME = 'ecommerce_events_dlx';
const ORDER_SAGA_QUEUE = 'order_saga_events';
const ORDER_SAGA_DLQ = 'order_saga_events_dlq';
const SERVICE_NAME = 'order-service';

const ROUTING_KEY_TO_EVENT: Record<string, OrderSagaEventType> = {
  stock_reserved: 'STOCK_RESERVED',
  stock_rejected: 'STOCK_REJECTED',
  payment_approved: 'PAYMENT_APPROVED',
  payment_failed: 'PAYMENT_FAILED',
};

/** Restaura o X-Correlation-ID da mensagem e registra a passagem do evento por este serviço. */
async function traced(msg: ConsumeMessage, handler: () => Promise<void>): Promise<void> {
  const correlationId = msg.properties.correlationId as string | undefined;
  console.log(`[order-service] cid=${correlationId ?? '-'} <- ${msg.fields.routingKey}`);
  await runWithCorrelationId(correlationId, handler);
}

export function startOrderMessaging(
  prisma: PrismaClient,
  updateOrderStatusUseCase: UpdateOrderStatusUseCase
): ResilientRabbitConnection | null {
  const rabbitUrl = process.env.RABBITMQ_URL;
  if (!rabbitUrl) {
    console.warn(`[${SERVICE_NAME}] RABBITMQ_URL not set; skipping RabbitMQ consumer/outbox worker`);
    return null;
  }

  const setupTopology = async (channel: ConfirmChannel): Promise<void> => {
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

    await channel.consume(ORDER_SAGA_QUEUE, (msg) => {
      if (!msg) return;
      void traced(msg, async () => {
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
          console.error(`[${SERVICE_NAME}] Error processing Saga event:`, err);
          channel.nack(msg, false, false);
        }
      });
    });
  };

  const rabbit = new ResilientRabbitConnection(rabbitUrl, SERVICE_NAME, setupTopology);
  rabbit.start();
  startOutboxRelay(prisma, rabbit, EXCHANGE_NAME, SERVICE_NAME);
  return rabbit;
}
