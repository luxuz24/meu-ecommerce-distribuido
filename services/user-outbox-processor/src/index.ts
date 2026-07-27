import 'dotenv/config'; 
import pg from "pg";
import amqp from "amqplib";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const RABBITMQ_URL = process.env.RABBITMQ_URL as string;
if (!RABBITMQ_URL) {
    throw new Error("CRITICAL: Variável de ambiente RABBITMQ_URL não está definida no arquivo .env");
}
const EXCHANGE_NAME = "ecommerce_events";
const POLL_INTERVAL_MS = 5000;

let rabbitChannel: amqp.Channel;

async function processOutboxEvents() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const { rows: events } = await client.query(
            `SELECT * FROM outbox WHERE published = false ORDER BY "createdAt" ASC LIMIT 10 FOR UPDATE SKIP LOCKED;`
        );

        if (events.length > 0) {
            console.log(`Processing ${events.length} outbox events...`);
            for (const event of events) {
                const routingKey = event.eventType.toLowerCase();
                const messageBuffer = Buffer.from(JSON.stringify(event.payload));
                
                const published = rabbitChannel.publish(
                    EXCHANGE_NAME,
                    routingKey,
                    messageBuffer,
                    { 
                        persistent: true,
                        messageId: event.id,
                    }
                );

                if (published) {
                    console.log(`Published event ${event.id} to exchange ${EXCHANGE_NAME} with routing key ${routingKey}`);
                    await client.query(
                        `UPDATE outbox SET published = true WHERE id = $1`,
                        [event.id]
                    );
                } else {
                    console.error(`Failed to publish event ${event.id}`);
                
                    throw new Error(`Failed to Broker publish`);
                } 
            }
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing outbox events:', error);
    } finally {
        client.release();
    }
}

async function startWorker() {
    try {
        console.log('Connecting to PostgreSQL...');
        await pool.query('SELECT 1');
        console.log('Connected to PostgreSQL');

        console.log('Connecting to RabbitMQ...');
        const rabbitConnection = await amqp.connect(RABBITMQ_URL);
        rabbitChannel = await rabbitConnection.createChannel();

        await rabbitChannel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
        console.log('Connected to RabbitMQ and exchange asserted');
        console.log('Worker started, polling for outbox events every 5 seconds...');

        setInterval(processOutboxEvents, POLL_INTERVAL_MS);
    } catch (error) {
        console.error('Error starting worker:', error);
        process.exit(1);
    }
}

startWorker();