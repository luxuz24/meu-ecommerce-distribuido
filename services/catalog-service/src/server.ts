import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { connectDB } from './infra/database/mongo.js';
import { productRoutes } from './infra/http/routes/product.routes.js';

const app = Fastify({ logger: true });

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
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true,
            maxAge: 600,
        });

        await app.register(rateLimit, {
            max: 100,
            timeWindow: '1 minute',
        });

        app.get('/health', async (request, reply) => {
            return { status: 'OK', service: 'catalog-service', timestamp: new Date() };
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
