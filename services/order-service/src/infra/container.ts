import { prisma } from './database/prisma.js';
import { PrismaOrderRepository } from './database/repositories/PrismaOrderRepository.js';
import { CreateOrderUseCase } from '../use-cases/CreateOrderUseCase.js';
import {
  GetOrderByIdUseCase,
  ListUserOrdersUseCase,
} from '../use-cases/GetOrderUseCases.js';
import { UpdateOrderStatusUseCase } from '../use-cases/UpdateOrderStatusUseCase.js';
import { OrderController } from './http/controllers/OrderController.js';
import { HttpProductCatalog } from './catalog/HttpProductCatalog.js';

export const orderRepository = new PrismaOrderRepository(prisma);

export const productCatalog = new HttpProductCatalog(
  process.env.CATALOG_SERVICE_URL ?? 'http://localhost:3001'
);

export const createOrderUseCase = new CreateOrderUseCase(orderRepository, productCatalog);
export const listUserOrdersUseCase = new ListUserOrdersUseCase(orderRepository);
export const getOrderByIdUseCase = new GetOrderByIdUseCase(orderRepository);
export const updateOrderStatusUseCase = new UpdateOrderStatusUseCase(orderRepository);

export const orderController = new OrderController(
  createOrderUseCase,
  listUserOrdersUseCase,
  getOrderByIdUseCase,
  updateOrderStatusUseCase
);
