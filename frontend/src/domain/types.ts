export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string;
  role?: UserRole;
}

export interface LoginResponse {
  tokenJwt: string;
  user: User;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  sku: string;
  price: number;
  stock: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateProductInput {
  name: string;
  description: string;
  sku: string;
  price: number;
  stock: number;
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  isActive?: boolean;
}

export interface InventoryItemRecord {
  id: string;
  productId: string;
  sku: string;
  availableQty: number;
  reservedQty: number;
  updatedAt: string;
}

export interface ReserveStockResponse {
  status: 'STOCK_RESERVED' | 'STOCK_REJECTED' | 'ALREADY_PROCESSED';
  orderId: string;
  reason?: string;
}

export type OrderStatus = 'PENDING' | 'STOCK_RESERVED' | 'PAID' | 'CANCELLED';

export interface OrderItem {
  id?: string;
  productId: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  status: 'APPROVED' | 'FAILED';
  failureReason?: string | null;
  createdAt: string;
}

export interface ProcessPaymentResponse {
  event: 'PAYMENT_APPROVED' | 'PAYMENT_FAILED' | 'ALREADY_PROCESSED';
  payment: PaymentRecord;
}

export interface ApiTelemetryRecord {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  endpoint: string;
  service: string;
  statusCode: number;
  latencyMs: number;
  responseBody: unknown;
  timestamp: string;
}
