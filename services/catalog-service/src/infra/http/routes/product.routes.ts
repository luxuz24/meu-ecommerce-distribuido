import { type FastifyInstance } from 'fastify';
import { productController } from '../../container.js';
import { requireAdminAuth } from '../middlewares/AuthMiddleware.js';

export async function productRoutes(app: FastifyInstance) {
  app.post(
    '/products',
    {
      preHandler: [requireAdminAuth],
      schema: {
        body: {
          type: 'object',
          required: ['name', 'description', 'sku', 'price', 'stock'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 2 },
            description: { type: 'string', minLength: 2 },
            sku: { type: 'string', minLength: 2 },
            price: { type: 'number', minimum: 0 },
            stock: { type: 'number', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      return productController.create(request, reply);
    }
  );

  app.get(
    '/products',
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            q: { type: 'string', maxLength: 100 },
            active: { type: 'boolean', default: true },
          },
        },
      },
    },
    async (request, reply) => {
      return productController.list(request, reply);
    }
  );

  app.get(
    '/products/:id',
    {
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: {
            id: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      return productController.getById(request, reply);
    }
  );

  app.patch(
    '/products/:id',
    {
      preHandler: [requireAdminAuth],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: {
            id: { type: 'string', minLength: 1 },
          },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          minProperties: 1,
          properties: {
            name: { type: 'string', minLength: 2 },
            description: { type: 'string', minLength: 2 },
            price: { type: 'number', minimum: 0 },
            stock: { type: 'number', minimum: 0 },
            isActive: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      return productController.update(request, reply);
    }
  );

  app.delete(
    '/products/:id',
    {
      preHandler: [requireAdminAuth],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: {
            id: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      return productController.remove(request, reply);
    }
  );
}
