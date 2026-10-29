import { describe, expect, it } from 'vitest';
import { withLiveStock } from '../domain/stock';
import type { Product } from '../domain/types';

const product = (sku: string, stock: number) =>
  ({ id: sku, sku, name: sku, description: '', price: 1, stock, isActive: true }) as Product;

describe('withLiveStock', () => {
  it('shows the inventory balance instead of the static catalog value', () => {
    const [mouse] = withLiveStock([product('MSE-ULTR-62', 60)], [{ sku: 'MSE-ULTR-62', availableQty: 59 }]);
    expect(mouse?.stock).toBe(59);
  });

  it('matches SKUs case-insensitively and keeps the catalog value when there is no inventory row', () => {
    const result = withLiveStock(
      [product('kb-1234', 50), product('NEW-SKU', 7)],
      [{ sku: 'KB-1234', availableQty: 0 }]
    );
    expect(result.map((p) => p.stock)).toEqual([0, 7]);
  });
});
