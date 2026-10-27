import { describe, expect, it, vi } from 'vitest';
import { formatBRL } from '../pages/CatalogPage';
import { ApiError, catalogApi, userApi } from '../services/api';

describe('Frontend MVP — Domain & API Client', () => {
  it('should format BRL currency values correctly', () => {
    const formatted = formatBRL(549.9);
    expect(formatted).toContain('549,90');
  });

  it('should attach telemetry metadata on successful catalogApi.listProducts call', async () => {
    const mockPayload = {
      items: [
        {
          id: '680e1a2b3c4d5e6f7a8b9c0d',
          name: 'Teclado Mecânico Wireless Pro',
          description: 'Switch táctil silencioso',
          sku: 'TEC-MEC-PRO-001',
          price: 549.9,
          stock: 15,
          isActive: true,
        },
      ],
      total: 1,
      page: 1,
      limit: 12,
      totalPages: 1,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      })
    );

    const res = await catalogApi.listProducts({
      page: 1,
      limit: 12,
      q: 'Teclado',
      active: true,
    });

    expect(res.data.total).toBe(1);
    expect(res.data.items[0]?.sku).toBe('TEC-MEC-PRO-001');
    expect(res.telemetry.method).toBe('GET');
    expect(res.telemetry.endpoint).toBe(
      '/api/products?page=1&limit=12&q=Teclado&active=true'
    );
    expect(res.telemetry.statusCode).toBe(200);
    expect(res.telemetry.latencyMs).toBeGreaterThanOrEqual(1);

    vi.unstubAllGlobals();
  });

  it('should throw structured ApiError with telemetry on 401 login failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'INVALID_CREDENTIALS!' }),
      })
    );

    await expect(
      userApi.login({ email: 'dev@microstore.io', password: 'wrong' })
    ).rejects.toThrow(ApiError);

    try {
      await userApi.login({ email: 'dev@microstore.io', password: 'wrong' });
    } catch (err) {
      const apiErr = err as ApiError;
      expect(apiErr.statusCode).toBe(401);
      expect(apiErr.message).toBe('INVALID_CREDENTIALS!');
      expect(apiErr.telemetry.endpoint).toBe('/login');
    }

    vi.unstubAllGlobals();
  });
});
