import 'dotenv/config';
import pg from "pg";
import { type ConfirmChannel } from "amqplib";
import { ResilientRabbitConnection } from "./ResilientRabbit.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const RABBITMQ_URL = process.env.RABBITMQ_URL as string;
if (!RABBITMQ_URL) {
    throw new Error("CRITICAL: Variável de ambiente RABBITMQ_URL não está definida no arquivo .env");
}
const EXCHANGE_NAME = "ecommerce_events";
const POLL_INTERVAL_MS = 1000;
const READINESS_FILE = "/tmp/user-outbox-processor.ready";

const rabbit = new ResilientRabbitConnection(
    RABBITMQ_URL,
    'user-outbox-processor',
    async (channel: ConfirmChannel) => {
        await channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });
    },
    10,
    READINESS_FILE
);

let processing = false;

async function processOutboxEvents() {
    if (processing || !rabbit.isConnected) return;
    processing = true;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        // SKIP LOCKED: várias réplicas do processor podem rodar sem publicar o mesmo evento
        const { rows: events } = await client.query(
            `SELECT * FROM outbox WHERE published = false ORDER BY "createdAt" ASC LIMIT 10 FOR UPDATE SKIP LOCKED;`
        );

        for (const event of events) {
            const routingKey = event.eventType.toLowerCase();
            // Só resolve após o publisher confirm do broker; se rejeitar, a transação faz rollback
            await rabbit.publish(
                EXCHANGE_NAME,
                routingKey,
                Buffer.from(JSON.stringify(event.payload)),
                {
                    persistent: true,
                    messageId: event.id,
                    contentType: 'application/json',
                }
            );
            await client.query(`UPDATE outbox SET published = true WHERE id = $1`, [event.id]);
            console.log(`Published event ${event.id} to exchange ${EXCHANGE_NAME} with routing key ${routingKey}`);
        }
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing outbox events:', (error as Error).message);
    } finally {
        client.release();
        processing = false;
    }
}

async function startWorker() {
    try {
        console.log('Connecting to PostgreSQL...');
        await pool.query('SELECT 1');
        console.log('Connected to PostgreSQL');

        rabbit.start();
        setInterval(processOutboxEvents, POLL_INTERVAL_MS);
        console.log(`Worker started, polling for outbox events every ${POLL_INTERVAL_MS}ms...`);
    } catch (error) {
        console.error('Error starting worker:', error);
        process.exit(1);
    }
}

startWorker();
