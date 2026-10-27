import type {
  ApiTelemetryRecord,
  CreateProductInput,
  LoginResponse,
  PaginatedProducts,
  Product,
  UpdateProductInput,
  User,
} from '../domain/types';

export const USER_API_URL =
  import.meta.env.VITE_USER_API_URL || 'http://localhost:3000';
export const CATALOG_API_URL =
  import.meta.env.VITE_CATALOG_API_URL || 'http://localhost:3001';

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
      '/health'
    ),

  register: (payload: { name: string; email: string; password: string }) =>
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
      '/health'
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

  createProduct: (payload: CreateProductInput) =>
    requestWithTelemetry<Product>(
      'catalog-service:3001',
      CATALOG_API_URL,
      'POST',
      '/api/products',
      { body: payload }
    ),

  updateProduct: (id: string, payload: UpdateProductInput) =>
    requestWithTelemetry<Product>(
      'catalog-service:3001',
      CATALOG_API_URL,
      'PATCH',
      `/api/products/${id}`,
      { body: payload }
    ),

  deleteProduct: (id: string) =>
    requestWithTelemetry<null>(
      'catalog-service:3001',
      CATALOG_API_URL,
      'DELETE',
      `/api/products/${id}`
    ),
};
