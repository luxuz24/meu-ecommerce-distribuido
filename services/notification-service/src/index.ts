import 'dotenv/config';
import amqp from 'amqplib';

export interface NotificationAction {
  type: 'WELCOME_EMAIL' | 'ORDER_CONFIRMED_EMAIL' | 'PAYMENT_FAILED_ALERT' | 'ORDER_CANCELLED_ALERT';
  recipient: string;
  summary: string;
}

export function parseNotificationEvent(
  routingKey: string,
  rawMessage: string
): NotificationAction | null {
  const eventData = JSON.parse(rawMessage);
  const data = eventData.payload
    ? typeof eventData.payload === 'string'
      ? JSON.parse(eventData.payload)
      : eventData.payload
    : eventData;

  if (!data || typeof data !== 'object') {
    return null;
  }

  if (routingKey === 'user_created') {
    if (!data.email) return null;
    return {
      type: 'WELCOME_EMAIL',
      recipient: String(data.email),
      summary: `Welcome email to ${data.name ?? data.email}`,
    };
  }

  if (routingKey === 'order_confirmed') {
    if (!data.orderId) return null;
    return {
      type: 'ORDER_CONFIRMED_EMAIL',
      recipient: String(data.userId ?? 'customer'),
      summary: `Order #${data.orderId} confirmed (Total: R$ ${data.total ?? 0})`,
    };
  }

  if (routingKey === 'payment_failed') {
    if (!data.orderId) return null;
    return {
      type: 'PAYMENT_FAILED_ALERT',
      recipient: String(data.userId ?? 'customer'),
      summary: `Payment failed for Order #${data.orderId} (${data.reason ?? 'DECLINED'})`,
    };
  }

  if (routingKey === 'order_cancelled') {
    if (!data.orderId) return null;
    return {
      type: 'ORDER_CANCELLED_ALERT',
      recipient: String(data.userId ?? 'customer'),
      summary: `Order #${data.orderId} cancelled (${data.reason ?? 'CANCELLED'})`,
    };
  }

  return null;
}

export const EXCHANGE_NAME = 'ecommerce_events';
export const DLX_EXCHANGE_NAME = 'ecommerce_events_dlx';
export const QUEUE_NAME = 'notification_events_queue';
export const DLQ_QUEUE_NAME = 'notification_events_dlq';
export const ROUTING_KEYS = [
  'user_created',
  'order_confirmed',
  'payment_failed',
  'order_cancelled',
] as const;

export function buildNotificationQueueArguments(): Record<string, string> {
  return {
    'x-dead-letter-exchange': DLX_EXCHANGE_NAME,
    'x-dead-letter-routing-key': DLQ_QUEUE_NAME,
  };
}

async function startConsumer() {
  try {
    const rabbitmqUrl = process.env.RABBITMQ_URL;
    if (!rabbitmqUrl) {
      throw new Error('CRITICAL: RABBITMQ_URL is missing in .env');
    }

    console.log('Connecting to RabbitMQ...');
    const connection = await amqp.connect(rabbitmqUrl);
    const channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    await channel.assertExchange(DLX_EXCHANGE_NAME, 'direct', { durable: true });
    await channel.assertQueue(DLQ_QUEUE_NAME, { durable: true });
    await channel.bindQueue(DLQ_QUEUE_NAME, DLX_EXCHANGE_NAME, DLQ_QUEUE_NAME);

    await channel.assertQueue(QUEUE_NAME, {
      durable: true,
      arguments: buildNotificationQueueArguments(),
    });
    for (const key of ROUTING_KEYS) {
      await channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, key);
    }

    console.log(
      `Listening! Bound Queue "${QUEUE_NAME}" to Exchange "${EXCHANGE_NAME}" for [${ROUTING_KEYS.join(', ')}] (DLQ: "${DLQ_QUEUE_NAME}")`
    );

    await channel.consume(QUEUE_NAME, (message) => {
      if (message !== null) {
        try {
          const routingKey = message.fields.routingKey || 'user_created';
          const rawMessage = message.content.toString();
          const action = parseNotificationEvent(routingKey, rawMessage);

          if (!action) {
            console.error(
              'ERROR: Invalid notification event payload (routing to DLQ):',
              rawMessage
            );
            channel.nack(message, false, false);
            return;
          }

          console.log('=======================================');
          console.log(` [NEW EVENT TRIGGERED: ${action.type}] `);
          console.log(`Recipient: ${action.recipient}`);
          console.log(`Summary: ${action.summary}`);
          console.log('=======================================');

          channel.ack(message);
        } catch (err) {
          console.error('Erro ao processar a mensagem (routing to DLQ):', err);
          channel.nack(message, false, false);
        }
      }
    });
  } catch (error) {
    console.error('Failed to start Notification Service:', error);
  }
}

if (process.env.NODE_ENV !== 'test') {
  void startConsumer();
}
