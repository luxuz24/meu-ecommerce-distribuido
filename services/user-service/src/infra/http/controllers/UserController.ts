import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import pg from 'pg';
import { PrismaPg } from "@prisma/adapter-pg";

import { LoginUserUseCase } from "../../../use-cases/LoginUseCase.js";
import { CreateUserUseCase } from "../../../use-cases/CreateUserUseCase.js";
import { authMiddleware } from "../middlewares/AuthMiddleware.js";
import { GetUserProfileUseCase } from '../../../use-cases/GetUserProfileUseCase.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const createUserUseCase = new CreateUserUseCase(prisma);
const loginUserUseCase = new LoginUserUseCase(prisma);
const getUserProfileUseCase = new GetUserProfileUseCase(prisma);

export async function userRoutes(app: FastifyInstance) {
  
  app.post(
    '/users',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'email', 'password'],
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
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { name, email, password } = request.body as any;
      try {
        const user = await createUserUseCase.execute(name, email, password);
        return reply.status(201).send(user);
      } catch (error: any) {
        if (error.message === 'USER_ALREADY_EXISTS') {
          return reply.status(400).send({ error: 'User with this email already exists' });
        }
        request.log.error(error);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  app.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = request.body as any;
      const result = await loginUserUseCase.execute(data);
      return reply.status(200).send(result);
    } catch (error: any) {
      if (error.message === 'INVALID_CREDENTIALS!') {
        return reply.status(401).send({ error: 'INVALID_CREDENTIALS!' });
      }
      
      console.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  app.get('/users/me', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userDataFromToken = (request as any).user;
      const freshUserData = await getUserProfileUseCase.execute(userDataFromToken.userId);

      return reply.status(200).send(freshUserData);
    } catch (error: any) {
      if (error.message === 'USER_NOT_FOUND') {
        return reply.status(404).send({ error: 'USER_NOT_FOUND' });
      }
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

}