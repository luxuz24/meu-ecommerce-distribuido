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

async function startConsumer() {
  try {
    const rabbitmqUrl = process.env.RABBITMQ_URL;
    if (!rabbitmqUrl) {
      throw new Error('CRITICAL: RABBITMQ_URL is missing in .env');
    }

    console.log('Connecting to RabbitMQ...');
    const connection = await amqp.connect(rabbitmqUrl);
    const channel = await connection.createChannel();

    const exchangeName = 'ecommerce_events';
    const queueName = 'notification_events_queue';
    const routingKeys = [
      'user_created',
      'order_confirmed',
      'payment_failed',
      'order_cancelled',
    ];

    await channel.assertExchange(exchangeName, 'topic', { durable: true });
    await channel.assertQueue(queueName, { durable: true });
    for (const key of routingKeys) {
      await channel.bindQueue(queueName, exchangeName, key);
    }

    console.log(
      `Listening! Bound Queue "${queueName}" to Exchange "${exchangeName}" for [${routingKeys.join(', ')}]`
    );

    await channel.consume(queueName, (message) => {
      if (message !== null) {
        try {
          const routingKey = message.fields.routingKey || 'user_created';
          const rawMessage = message.content.toString();
          const action = parseNotificationEvent(routingKey, rawMessage);

          if (!action) {
            console.error('ERROR: Invalid notification event payload:', rawMessage);
            channel.ack(message);
            return;
          }

          console.log('=======================================');
          console.log(` [NEW EVENT TRIGGERED: ${action.type}] `);
          console.log(`Recipient: ${action.recipient}`);
          console.log(`Summary: ${action.summary}`);
          console.log('=======================================');

          channel.ack(message);
        } catch (err) {
          console.error('Erro ao processar a mensagem:', err);
          channel.ack(message);
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
