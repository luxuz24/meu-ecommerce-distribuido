import type { InventoryItemRecord, Product } from './types';

/**
 * O campo `stock` do catálogo é só o valor de cadastro; o saldo que a Saga reserva e baixa
 * vive no inventory-service. A vitrine mostra o `availableQty` real quando ele existe e só
 * cai para o valor do catálogo se o SKU ainda não tiver estoque provisionado.
 */
export function withLiveStock(
  products: Product[],
  inventory: Pick<InventoryItemRecord, 'sku' | 'availableQty'>[]
): Product[] {
  const available = new Map(inventory.map((i) => [i.sku.toUpperCase(), i.availableQty]));
  return products.map((p) => {
    const live = available.get(p.sku.toUpperCase());
    return live === undefined ? p : { ...p, stock: live };
  });
}
