import { type FastifyInstance, type FastifyRequest, type FastifyReply } from "fastify";
import { createUserUseCase, loginUserUseCase, getUserProfileUseCase } from "../../container.js";
import { authMiddleware } from "../middlewares/AuthMiddleware.js";
import { UserAlreadyExistsError } from "../../../domain/errors/UserAlreadyExistsError.js";
import { InvalidCredentialsError } from "../../../domain/errors/InvalidCredentialsError.js";
import { UserNotFoundError } from "../../../domain/errors/UserNotFoundError.js";

export async function userRoutes(app: FastifyInstance) {
  
  app.post(
    '/users',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
      schema: {
        body: {
          type: 'object',
          required: ['name', 'email', 'password'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 2 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
              role: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { name, email, password } = request.body as any;
      try {
        // Cadastro público nunca escolhe papel: privilégio ADMIN só via bootstrap do servidor
        const user = await createUserUseCase.execute(name, email, password, 'CUSTOMER');
        return reply.status(201).send(user);
      } catch (error: any) {
        if (error instanceof UserAlreadyExistsError) {
          return reply.status(400).send({ error: error.message });
        }
        request.log.error(error);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  app.post(
    '/login',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          additionalProperties: false,
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = request.body as any;
        const result = await loginUserUseCase.execute(data);
        return reply.status(200).send(result);
      } catch (error: any) {
        if (error instanceof InvalidCredentialsError) {
          return reply.status(401).send({ error: error.message });
        }
        
        request.log.error(error);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  app.get('/users/me', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userDataFromToken = (request as any).user;
      const freshUserData = await getUserProfileUseCase.execute(userDataFromToken.userId);

      return reply.status(200).send(freshUserData);
    } catch (error: any) {
      if (error instanceof UserNotFoundError) {
        return reply.status(404).send({ error: error.message });
      }
      request.log.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}
