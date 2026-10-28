export interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  price: number;
  isActive: boolean;
}

/**
 * Porta para o catalog-service. O order-service nunca confia em preço/nome/sku
 * enviados pelo cliente: tudo é resolvido aqui, a partir da fonte de verdade.
 */
export interface IProductCatalog {
  findById(productId: string): Promise<CatalogProduct | null>;
}
