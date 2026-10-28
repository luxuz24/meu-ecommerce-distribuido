import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { prisma } from './infra/database/prisma.js';
import {
  inventoryController,
  reserveStockUseCase,
  releaseStockUseCase,
  confirmStockUseCase,
} from './infra/container.js';
import { registerInventoryRoutes } from './infra/http/routes/inventoryRoutes.js';
import { startInventoryMessaging } from './infra/messaging/InventoryEventWorker.js';

const app = Fastify({
  logger: true,
  requestIdHeader: 'x-correlation-id',
});

const start = async () => {
  try {
    // Conecta em background com retry: o HTTP sobe mesmo com o broker ainda indisponível
    const rabbit = startInventoryMessaging(
      prisma,
      reserveStockUseCase,
      releaseStockUseCase,
      confirmStockUseCase
    );

    await app.register(helmet);

    const rawOrigins =
      process.env.CORS_ORIGINS ??
      'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:8080';
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

    app.get('/health', async (_request, reply) => {
      const messaging = rabbit?.isConnected ? 'connected' : 'disconnected';
      let database = 'connected';
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch {
        database = 'disconnected';
      }
      const healthy = database === 'connected' && messaging === 'connected';
      return reply
        .status(healthy ? 200 : 503)
        .send({ status: healthy ? 'up' : 'degraded', service: 'inventory-service', database, messaging });
    });

    await app.register(
      async (api) => {
        await registerInventoryRoutes(api, inventoryController);
      },
      { prefix: '/api' }
    );

    const port = Number(process.env.PORT) || 3003;
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Inventory service running on port ${port}`);

  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
