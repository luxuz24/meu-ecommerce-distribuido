import type {
  ApiTelemetryRecord,
  CreateProductInput,
  InventoryItemRecord,
  LoginResponse,
  Order,
  PaginatedProducts,
  PaymentRecord,
  ProcessPaymentResponse,
  Product,
  ReserveStockResponse,
  UpdateProductInput,
  User,
} from '../domain/types';

// Todo o tráfego do browser passa pelo API Gateway (Nginx): rate limit, roteamento
// e X-Correlation-ID ficam num único ponto de entrada.
export const API_GATEWAY_URL =
  import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8080';
export const USER_API_URL = API_GATEWAY_URL;
export const CATALOG_API_URL = API_GATEWAY_URL;
export const INVENTORY_API_URL = API_GATEWAY_URL;
export const ORDER_API_URL = API_GATEWAY_URL;
export const PAYMENT_API_URL = API_GATEWAY_URL;

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly telemetry: ApiTelemetryRecord;

  constructor(
    message: string,
    statusCode: number,
    telemetry: ApiTelemetryRecord
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.telemetry = telemetry;
  }
}

export interface ApiResult<T> {
  data: T;
  telemetry: ApiTelemetryRecord;
}

async function requestWithTelemetry<T>(
  service: string,
  baseUrl: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  options?: {
    body?: unknown;
    token?: string | null;
  }
): Promise<ApiResult<T>> {
  const start = performance.now();
  const headers: Record<string, string> = {};

  if (options?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options?.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const requestInit: RequestInit = {
    method,
    headers,
  };

  if (options?.body !== undefined) {
    requestInit.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${path}`, requestInit);

  const latencyMs = Math.max(1, Math.round(performance.now() - start));
  let responseBody: unknown = null;

  if (response.status !== 204) {
    try {
      responseBody = await response.json();
    } catch {
      responseBody = null;
    }
  }

  const telemetry: ApiTelemetryRecord = {
    method,
    endpoint: path,
    service,
    statusCode: response.status,
    latencyMs,
    ...(response.headers.get('x-correlation-id')
      ? { correlationId: response.headers.get('x-correlation-id') as string }
      : {}),
    responseBody,
    timestamp: new Date().toISOString(),
  };

  if (!response.ok) {
    const errObj = responseBody as { error?: string; message?: string } | null;
    const message =
      errObj?.error ||
      errObj?.message ||
      `HTTP ${response.status} on ${method} ${path}`;
    throw new ApiError(message, response.status, telemetry);
  }

  return {
    data: responseBody as T,
    telemetry,
  };
}

export const userApi = {
  checkHealth: () =>
    requestWithTelemetry<{ status: string; service: string }>(
      'user-service:3000',
      USER_API_URL,
      'GET',
      '/health/user'
    ),

  register: (payload: {
    name: string;
    email: string;
    password: string;
  }) =>
    requestWithTelemetry<User>('user-service:3000', USER_API_URL, 'POST', '/users', {
      body: payload,
    }),

  login: (payload: { email: string; password: string }) =>
    requestWithTelemetry<LoginResponse>(
      'user-service:3000',
      USER_API_URL,
      'POST',
      '/login',
      { body: payload }
    ),

  getMe: (token: string) =>
    requestWithTelemetry<User>('user-service:3000', USER_API_URL, 'GET', '/users/me', {
      token,
    }),
};

export const catalogApi = {
  checkHealth: () =>
    requestWithTelemetry<{ status: string; service: string }>(
      'catalog-service:3001',
      CATALOG_API_URL,
      'GET',
      '/health/catalog'
    ),

  listProducts: (params: {
    page?: number;
    limit?: number;
    q?: string;
    active?: boolean;
  }) => {
    const search = new URLSearchParams();
    if (params.page !== undefined) search.set('page', String(params.page));
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    if (params.q && params.q.trim() !== '') search.set('q', params.q.trim());
    if (params.active !== undefined) search.set('active', String(params.active));

    const queryString = search.toString();
    const path = `/api/products${queryString ? `?${queryString}` : ''}`;

    return requestWithTelemetry<PaginatedProducts>(
      'catalog-service:3001',
      CATALOG_API_URL,
      'GET',
      path
    );
  },

  getProductById: (id: string) =>
    requestWithTelemetry<Product>(
      'catalog-service:3001',
      CATALOG_API_URL,
      'GET',
      `/api/products/${id}`
    ),

  createProduct: (payload: CreateProductInput, token?: string | null) =>
    requestWithTelemetry<Product>(
      'catalog-service:3001',
      CATALOG_API_URL,
      'POST',
      '/api/products',
      {
        body: payload,
        token:
          token ??
          (typeof localStorage !== 'undefined'
            ? localStorage.getItem('microstore_jwt_token')
            : null),
      }
    ),

  updateProduct: (
    id: string,
    payload: UpdateProductInput,
    token?: string | null
  ) =>
    requestWithTelemetry<Product>(
      'catalog-service:3001',
      CATALOG_API_URL,
      'PATCH',
      `/api/products/${id}`,
      {
        body: payload,
        token:
          token ??
          (typeof localStorage !== 'undefined'
            ? localStorage.getItem('microstore_jwt_token')
            : null),
      }
    ),

  deleteProduct: (id: string, token?: string | null) =>
    requestWithTelemetry<null>(
      'catalog-service:3001',
      CATALOG_API_URL,
      'DELETE',
      `/api/products/${id}`,
      {
        token:
          token ??
          (typeof localStorage !== 'undefined'
            ? localStorage.getItem('microstore_jwt_token')
            : null),
      }
    ),
};

export const inventoryApi = {
  checkHealth: () =>
    requestWithTelemetry<{ status: string; service: string }>(
      'inventory-service:3003',
      INVENTORY_API_URL,
      'GET',
      '/health/inventory'
    ),

  getBySku: (sku: string) =>
    requestWithTelemetry<InventoryItemRecord>(
      'inventory-service:3003',
      INVENTORY_API_URL,
      'GET',
      `/api/inventory/${encodeURIComponent(sku)}`
    ),

  seedStock: (
    payload: { productId: string; sku: string; availableQty: number },
    token?: string | null
  ) =>
    requestWithTelemetry<InventoryItemRecord>(
      'inventory-service:3003',
      INVENTORY_API_URL,
      'POST',
      '/api/inventory/seed',
      {
        body: payload,
        token:
          token ??
          (typeof localStorage !== 'undefined'
            ? localStorage.getItem('microstore_jwt_token')
            : null),
      }
    ),

  reserveOrderStock: (payload: {
    orderId: string;
    items: Array<{ sku: string; quantity: number }>;
  }) =>
    requestWithTelemetry<ReserveStockResponse>(
      'inventory-service:3003',
      INVENTORY_API_URL,
      'POST',
      '/api/inventory/reserve',
      { body: payload }
    ),
};

export const orderApi = {
  checkHealth: () =>
    requestWithTelemetry<{ status: string; service: string }>(
      'order-service:3004',
      ORDER_API_URL,
      'GET',
      '/health/order'
    ),

  createOrder: (
    payload: {
      items: Array<{
        productId: string;
        quantity: number;
      }>;
      simulatePaymentFailure?: boolean;
    },
    token?: string | null
  ) =>
    requestWithTelemetry<Order>(
      'order-service:3004',
      ORDER_API_URL,
      'POST',
      '/api/orders',
      {
        body: payload,
        token:
          token ??
          (typeof localStorage !== 'undefined'
            ? localStorage.getItem('microstore_jwt_token')
            : null),
      }
    ),

  listMyOrders: (token?: string | null) =>
    requestWithTelemetry<{ items: Order[]; total: number }>(
      'order-service:3004',
      ORDER_API_URL,
      'GET',
      '/api/orders',
      {
        token:
          token ??
          (typeof localStorage !== 'undefined'
            ? localStorage.getItem('microstore_jwt_token')
            : null),
      }
    ),

  getOrderById: (id: string, token?: string | null) =>
    requestWithTelemetry<Order>(
      'order-service:3004',
      ORDER_API_URL,
      'GET',
      `/api/orders/${id}`,
      {
        token:
          token ??
          (typeof localStorage !== 'undefined'
            ? localStorage.getItem('microstore_jwt_token')
            : null),
      }
    ),

  triggerSagaEvent: (
    id: string,
    payload: {
      eventType:
        | 'STOCK_RESERVED'
        | 'STOCK_REJECTED'
        | 'PAYMENT_APPROVED'
        | 'PAYMENT_FAILED';
      reason?: string;
    },
    token?: string | null
  ) =>
    requestWithTelemetry<Order>(
      'order-service:3004',
      ORDER_API_URL,
      'PATCH',
      `/api/orders/${id}/saga-event`,
      {
        body: payload,
        token:
          token ??
          (typeof localStorage !== 'undefined'
            ? localStorage.getItem('microstore_jwt_token')
            : null),
      }
    ),
};

export const paymentApi = {
  checkHealth: () =>
    requestWithTelemetry<{ status: string; service: string }>(
      'payment-service:3005',
      PAYMENT_API_URL,
      'GET',
      '/health/payment'
    ),

  getByOrderId: (orderId: string) =>
    requestWithTelemetry<PaymentRecord>(
      'payment-service:3005',
      PAYMENT_API_URL,
      'GET',
      `/api/payments/${encodeURIComponent(orderId)}`
    ),

  processPayment: (payload: {
    orderId: string;
    userId?: string;
    amount: number;
    simulateOutcome?: 'APPROVED' | 'FAILED';
    failureReason?: string;
  }) =>
    requestWithTelemetry<ProcessPaymentResponse>(
      'payment-service:3005',
      PAYMENT_API_URL,
      'POST',
      '/api/payments/process',
      { body: payload }
    ),
};
