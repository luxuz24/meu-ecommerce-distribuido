import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import mongoose from 'mongoose';
import { connectDB } from './infra/database/mongo.js';
import { productRoutes } from './infra/http/routes/product.routes.js';

const app = Fastify({
    logger: true,
    requestIdHeader: 'x-correlation-id',
    // Atrás do API Gateway: o IP real do cliente vem no X-Forwarded-For. Sem isso o rate
    // limit por IP enxergaria só o Nginx e viraria um limite global para todos os usuários.
    trustProxy: 'loopback, uniquelocal',
});

async function start() {
    try {
        await app.register(helmet);

        const rawOrigins = process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001,http://localhost:3002';
        const allowedOrigins = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);

        await app.register(cors, {
            origin: (origin, cb) => {
                if (!origin || allowedOrigins.includes(origin)) {
                    cb(null, true);
                    return;
                }
                cb(new Error('Not allowed by CORS'), false);
            },
            methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
            exposedHeaders: ['X-Correlation-ID'],
            credentials: true,
            maxAge: 600,
        });

        await app.register(rateLimit, {
            max: 100,
            timeWindow: '1 minute',
        });

        app.addHook('onSend', async (request, reply) => {
            reply.header('x-correlation-id', request.id);
        });

        app.setErrorHandler((error: Error & { statusCode?: number; validation?: unknown }, request, reply) => {
            request.log.error({ err: error, correlationId: request.id }, 'Unhandled request error');
            const statusCode = error.validation ? 400 : (error.statusCode ?? 500);
            reply.status(statusCode).send({
                error: statusCode === 500 ? 'Internal Server Error' : error.message,
                correlationId: request.id,
            });
        });

        app.get('/health', async (request, reply) => {
            const isConnected = mongoose.connection.readyState === 1;
            if (!isConnected) {
                return reply.status(503).send({
                    status: 'degraded',
                    service: 'catalog-service',
                    database: 'disconnected',
                    timestamp: new Date(),
                });
            }
            return {
                status: 'OK',
                service: 'catalog-service',
                database: 'connected',
                timestamp: new Date(),
            };
        });

        await app.register(productRoutes, { prefix: 'api' });

        console.log("initializing catalog-service...");
        await connectDB();
        const port = Number(process.env.PORT) || 3001;
        await app.listen({ port, host: '0.0.0.0' });
        console.log(`catalog-service is running on port ${port}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

start();
