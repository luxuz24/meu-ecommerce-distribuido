import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { prisma } from './infra/database/prisma.js';
import { orderController, updateOrderStatusUseCase } from './infra/container.js';
import { registerOrderRoutes } from './infra/http/routes/orderRoutes.js';
import { startOrderMessaging } from './infra/messaging/OrderEventWorker.js';

const app = Fastify({ logger: true });

const start = async () => {
  try {
    await app.register(helmet);

    const rawOrigins =
      process.env.CORS_ORIGINS ??
      'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004,http://localhost:8080';
    const allowedOrigins = rawOrigins
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

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

    app.get('/health', async () => {
      return { status: 'up', service: 'order-service' };
    });

    await app.register(
      async (api) => {
        await registerOrderRoutes(api, orderController);
      },
      { prefix: '/api' }
    );

    const port = Number(process.env.PORT) || 3004;
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Order service running on port ${port}`);

    await startOrderMessaging(prisma, updateOrderStatusUseCase);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
