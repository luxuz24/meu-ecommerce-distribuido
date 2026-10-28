import { type InventoryItem } from '../entities/InventoryItem.js';
import { type ReservationItemEntry, type StockReservation } from '../entities/StockReservation.js';

export interface UpsertStockData {
  productId: string;
  sku: string;
  availableQty: number;
}

export interface ReserveOrderInput {
  messageId?: string;
  orderId: string;
  userId?: string;
  total?: number;
  items: Array<ReservationItemEntry & { price?: number; name?: string }>;
  simulateOutcome?: 'APPROVED' | 'FAILED';
}

export interface ReserveOrderResult {
  status: 'STOCK_RESERVED' | 'STOCK_REJECTED' | 'ALREADY_PROCESSED';
  orderId: string;
  reason?: string;
  reservation?: StockReservation;
}

export interface IInventoryRepository {
  findBySku(sku: string): Promise<InventoryItem | null>;
  findAll(): Promise<InventoryItem[]>;
  upsertStock(data: UpsertStockData): Promise<InventoryItem>;
  hasProcessedMessage(messageId: string): Promise<boolean>;
  reserveOrderStockWithOutbox(input: ReserveOrderInput): Promise<ReserveOrderResult>;
  releaseOrderReservationWithOutbox(orderId: string, messageId?: string): Promise<boolean>;
  confirmOrderReservation(orderId: string, messageId?: string): Promise<boolean>;
}
