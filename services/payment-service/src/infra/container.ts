import { prisma } from './database/prisma.js';
import { PrismaPaymentRepository } from './database/repositories/PrismaPaymentRepository.js';
import {
  GetPaymentByOrderIdUseCase,
  ProcessPaymentUseCase,
} from '../use-cases/PaymentUseCases.js';
import { PaymentController } from './http/controllers/PaymentController.js';

export const paymentRepository = new PrismaPaymentRepository(prisma);

export const processPaymentUseCase = new ProcessPaymentUseCase(paymentRepository);
export const getPaymentByOrderIdUseCase = new GetPaymentByOrderIdUseCase(
  paymentRepository
);

export const paymentController = new PaymentController(
  processPaymentUseCase,
  getPaymentByOrderIdUseCase
);
