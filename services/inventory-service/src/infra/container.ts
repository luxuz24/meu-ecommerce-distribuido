import { prisma } from './database/prisma.js';
import { PrismaInventoryRepository } from './database/repositories/PrismaInventoryRepository.js';
import { GetStockBySkuUseCase } from '../use-cases/GetStockBySkuUseCase.js';
import { UpsertStockUseCase } from '../use-cases/UpsertStockUseCase.js';
import {
  DEFAULT_RESERVATION_TTL_MS,
  ReserveStockUseCase,
} from '../use-cases/ReserveStockUseCase.js';
import { ExpireReservationsUseCase } from '../use-cases/ExpireReservationsUseCase.js';
import { ReleaseStockUseCase } from '../use-cases/ReleaseStockUseCase.js';
import { ConfirmStockUseCase } from '../use-cases/ConfirmStockUseCase.js';
import { InventoryController } from './http/controllers/InventoryController.js';

export const inventoryRepository = new PrismaInventoryRepository(prisma);

export const getStockBySkuUseCase = new GetStockBySkuUseCase(inventoryRepository);
export const upsertStockUseCase = new UpsertStockUseCase(inventoryRepository);
const ttlSeconds = Number(process.env.RESERVATION_TTL_SECONDS);
export const reservationTtlMs =
  Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds * 1000 : DEFAULT_RESERVATION_TTL_MS;

export const reserveStockUseCase = new ReserveStockUseCase(inventoryRepository, reservationTtlMs);
export const releaseStockUseCase = new ReleaseStockUseCase(inventoryRepository);
export const confirmStockUseCase = new ConfirmStockUseCase(inventoryRepository);
export const expireReservationsUseCase = new ExpireReservationsUseCase(inventoryRepository);

export const inventoryController = new InventoryController(
  getStockBySkuUseCase,
  upsertStockUseCase,
  reserveStockUseCase,
  releaseStockUseCase
);
