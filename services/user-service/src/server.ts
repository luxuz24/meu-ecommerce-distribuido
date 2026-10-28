import 'dotenv/config';
import Fastify from "fastify";
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { prisma } from "./infra/database/prisma.js";
import { userRoutes } from "./infra/http/controllers/UserController.js";
import { ensureAdminUserUseCase } from "./infra/container.js";

const app = Fastify({
    logger: true,
    requestIdHeader: 'x-correlation-id',
});

const start = async () => {
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
            try {
                await prisma.$queryRaw`SELECT 1`;
                return { status: 'up', service: 'user-service', database: 'connected' };
            } catch {
                return reply.status(503).send({ status: 'degraded', service: 'user-service', database: 'disconnected' });
            }
        });

        await app.register(userRoutes);

        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (adminEmail && adminPassword) {
            const result = await ensureAdminUserUseCase.execute(adminEmail, adminPassword);
            app.log.info(`Admin bootstrap (${adminEmail}): ${result}`);
        }

        const port = Number(process.env.PORT) || 3000;
        await app.listen({ port, host: '0.0.0.0' });
        console.log(`User service is running on port ${port}!!!`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
