import { prisma } from './database/prisma.js';
import { PrismaInventoryRepository } from './database/repositories/PrismaInventoryRepository.js';
import { GetStockBySkuUseCase } from '../use-cases/GetStockBySkuUseCase.js';
import { UpsertStockUseCase } from '../use-cases/UpsertStockUseCase.js';
import { ReserveStockUseCase } from '../use-cases/ReserveStockUseCase.js';
import { ReleaseStockUseCase } from '../use-cases/ReleaseStockUseCase.js';
import { ConfirmStockUseCase } from '../use-cases/ConfirmStockUseCase.js';
import { InventoryController } from './http/controllers/InventoryController.js';

export const inventoryRepository = new PrismaInventoryRepository(prisma);

export const getStockBySkuUseCase = new GetStockBySkuUseCase(inventoryRepository);
export const upsertStockUseCase = new UpsertStockUseCase(inventoryRepository);
export const reserveStockUseCase = new ReserveStockUseCase(inventoryRepository);
export const releaseStockUseCase = new ReleaseStockUseCase(inventoryRepository);
export const confirmStockUseCase = new ConfirmStockUseCase(inventoryRepository);

export const inventoryController = new InventoryController(
  getStockBySkuUseCase,
  upsertStockUseCase,
  reserveStockUseCase,
  releaseStockUseCase
);
