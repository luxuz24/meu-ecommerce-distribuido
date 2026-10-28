import { CatalogUnavailableError } from '../../domain/errors/OrderErrors.js';
import {
  type CatalogProduct,
  type IProductCatalog,
} from '../../domain/services/IProductCatalog.js';

const REQUEST_TIMEOUT_MS = 3000;

export class HttpProductCatalog implements IProductCatalog {
  constructor(private readonly baseUrl: string) {}

  async findById(productId: string): Promise<CatalogProduct | null> {
    let response: Response;
    try {
      response = await fetch(
        `${this.baseUrl}/api/products/${encodeURIComponent(productId)}`,
        { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }
      );
    } catch {
      throw new CatalogUnavailableError();
    }

    // IDs inválidos para o Mongo também retornam 400/404: tratamos como produto inexistente
    if (response.status === 404 || response.status === 400) return null;
    if (!response.ok) throw new CatalogUnavailableError();

    const body = (await response.json()) as Partial<CatalogProduct>;
    if (typeof body.price !== 'number' || !body.sku || !body.name || !body.id) {
      throw new CatalogUnavailableError();
    }

    return {
      id: String(body.id),
      sku: String(body.sku),
      name: String(body.name),
      price: body.price,
      isActive: body.isActive !== false,
    };
  }
}
