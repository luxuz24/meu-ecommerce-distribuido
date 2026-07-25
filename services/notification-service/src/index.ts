import 'dotenv/config';
import amqp from 'amqplib';

async function startConsumer() {
  try {
    const rabbitmqUrl = process.env.RABBITMQ_URL;
    if (!rabbitmqUrl) {
      throw new Error("CRITICAL: RABBITMQ_URL is missing in .env");
    }

    console.log(" Connecting to RabbitMQ...");
    const connection = await amqp.connect(rabbitmqUrl);
    const channel = await connection.createChannel();

    const exchangeName = 'ecommerce_events';
    const routingKey = 'user_created';
    const queueName = 'notification_user_created';

    await channel.assertExchange(exchangeName, 'topic', { durable: true });
    await channel.assertQueue(queueName, { durable: true });
    await channel.bindQueue(queueName, exchangeName, routingKey);

    console.log(` Listening! Bound Queue "${queueName}" to Exchange "${exchangeName}"`);

    channel.consume(queueName, (message) => {
      if (message !== null) {
        try {
          const rawMessage = message.content.toString();
          const eventData = JSON.parse(rawMessage);
          
          
          console.log('\n RAW EVENT DATA:', eventData);

          
          let user;
          
          if (eventData.payload) {
            
            user = typeof eventData.payload === 'string' ? JSON.parse(eventData.payload) : eventData.payload;
          } else {
            
            user = eventData;
          }

          
          if (!user || !user.email) {
            console.error(" ERROR: Invalid user data received:", user);
            channel.ack(message); 
            return;
          }

          console.log('=======================================');
          console.log(' [NEW EVENT TRIGGERED] ');
          console.log('Action: Simulating Welcome Email');
          console.log(`To: ${user.email}`);
          console.log(`Name: ${user.name}`);
          console.log('=======================================');

          setTimeout(() => {
            console.log(` Welcome email successfully sent to ${user.email}!`);
            channel.ack(message);
          }, 2000);

        } catch (err) {
          console.error(" Erro ao processar a mensagem:", err);
          channel.ack(message); 
        }
      }
    });

  } catch (error) {
    console.error(" Failed to start Notification Service:", error);
  }
}

startConsumer();