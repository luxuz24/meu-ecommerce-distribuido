import 'dotenv/config';
import Fastify from "fastify";
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { userRoutes } from "./infra/http/controllers/UserController.js";

const app = Fastify({
    logger: true
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
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true,
            maxAge: 600,
        });

        await app.register(rateLimit, {
            max: 100,
            timeWindow: '1 minute',
        });

        app.get('/health', async (request, reply) => {
            return { status: 'up', service: 'user-service' };
        });

        await app.register(userRoutes);

        const port = Number(process.env.PORT) || 3000;
        await app.listen({ port, host: '0.0.0.0' });
        console.log(`User service is running on port ${port}!!!`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
