import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DevOnly,
  EndpointBar,
  JsonInspectorDrawer,
} from '../components/telemetry/DevTelemetry';
import { useCart } from '../context/CartContext';
import type {
  ApiTelemetryRecord,
  CreateProductInput,
  PaginatedProducts,
  Product,
} from '../domain/types';
import { ApiError, catalogApi, inventoryApi, userApi } from '../services/api';
import { DEMO_ADMIN } from '../config/demoAccounts';

const DEMO_SEED_PRODUCTS: CreateProductInput[] = [
  {
    name: 'Teclado Mecânico Wireless Pro',
    description:
      'Switch táctil silencioso, conexão Bluetooth 5.1 e USB-C, layout ABNT2 com case de alumínio usinado.',
    sku: 'TEC-MEC-PRO-001',
    price: 549.9,
    stock: 15,
  },
  {
    name: 'Mouse Ergonômico Vertical Precision',
    description:
      'Sensor óptico de 4000 DPI, redução de tensão muscular e bateria recarregável com autonomia de 90 dias.',
    sku: 'MOU-ERG-OPT-002',
    price: 289.0,
    stock: 3,
  },
  {
    name: 'Monitor Ultrawide 34" IPS 144Hz',
    description:
      'Resolução 3440x1440, suporte Type-C 90W Power Delivery e calibração profissional Delta E < 2.',
    sku: 'MON-4K-DEV-003',
    price: 3199.0,
    stock: 0,
  },
  {
    name: 'Dock Station Thunderbolt 4 Dual 4K',
    description:
      '12 portas integradas: HDMI 2.1, DisplayPort, Gigabit Ethernet e leitor SD UHS-II de alta velocidade.',
    sku: 'HUB-TB4-PRO-004',
    price: 899.0,
    stock: 42,
  },
];

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export const CatalogPage: React.FC = () => {
  const { addItem } = useCart();
  const [data, setData] = useState<PaginatedProducts>({
    items: [],
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 0,
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(12);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'instock'>(
    'active'
  );
  const [telemetry, setTelemetry] = useState<ApiTelemetryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: {
        page: number;
        limit: number;
        q?: string;
        active?: boolean;
      } = {
        page,
        limit,
      };
      if (searchQuery.trim()) {
        params.q = searchQuery.trim();
      }
      if (activeFilter === 'active' || activeFilter === 'instock') {
        params.active = true;
      }

      const res = await catalogApi.listProducts(params);
      setData(res.data);
      setTelemetry(res.telemetry);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setTelemetry(err.telemetry);
      } else {
        setError('Não foi possível conectar ao catalog-service (:3001).');
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, activeFilter]);

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  const handleSeedDemoProducts = async () => {
    setSeeding(true);
    let adminToken = localStorage.getItem('microstore_jwt_token');
    if (!adminToken) {
      try {
        const loginRes = await userApi.login(DEMO_ADMIN);
        adminToken = loginRes.data.tokenJwt;
      } catch {
        // Ignore
      }
    }

    for (const item of DEMO_SEED_PRODUCTS) {
      try {
        const created = await catalogApi.createProduct(item, adminToken);
        await inventoryApi.seedStock(
          {
            productId: created.data.id,
            sku: created.data.sku,
            availableQty: item.stock,
          },
          adminToken
        );
      } catch {
        // Ignora caso o SKU já exista no banco
      }
    }
    setSeeding(false);
    await fetchCatalog();
  };

  const displayedItems: Product[] =
    activeFilter === 'instock'
      ? data.items.filter((p) => p.stock > 0)
      : data.items;

  const currentEndpointString = `/api/products?page=${page}&limit=${limit}${
    searchQuery.trim() ? `&q=${encodeURIComponent(searchQuery.trim())}` : ''
  }${activeFilter !== 'all' ? '&active=true' : ''}`;

  return (
    <div className="flex flex-col w-full gap-space-md">
      {/* Hero Banner Compacto & Técnico */}
      <section className="flex flex-col bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container-high">
        <DevOnly>
          <div className="flex items-center justify-between mb-space-xs">
            <span className="inline-flex items-center gap-1.5 bg-secondary-container text-on-secondary-container font-code-sm text-code-sm px-2 py-0.5 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              catalog-service :3001
            </span>
            {telemetry && (
              <span className="font-code-sm text-code-sm text-tertiary flex items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded-lg">
                <span className="material-symbols-outlined text-[14px]">
                  bolt
                </span>
                {telemetry.latencyMs}ms Latência
              </span>
            )}
          </div>
        </DevOnly>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface tracking-tight">
              Hardware &amp; Periféricos para Desenvolvedores
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
              Equipamentos de alta performance para engenharia de software e setups modernos.
            </p>
          </div>
          <DevOnly>
            <button
              type="button"
              onClick={() => void handleSeedDemoProducts()}
              disabled={seeding}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary-container hover:bg-primary-fixed text-on-secondary-fixed font-code-sm text-code-sm font-semibold transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                database
              </span>
              <span>
                {seeding ? 'Populando...' : 'Seed 4 Produtos Stitch'}
              </span>
            </button>
          </DevOnly>
        </div>

        <div className="mt-space-sm">
          <EndpointBar method="GET" endpoint={currentEndpointString} />
        </div>
      </section>

      {/* Toolbar de Busca & Filtros */}
      <section className="flex flex-col gap-space-sm">
        <div className="relative w-full">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">search</span>
          </span>
          <input
            id="catalog-search"
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nome do produto ou código SKU..."
            className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant font-body-md text-body-md pl-10 pr-14 py-2.5 rounded-xl shadow-sm border border-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
          <DevOnly>
            <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant font-code-sm text-code-sm">
              ?q=
            </span>
          </DevOnly>
        </div>

        {/* Filtros Horizontais */}
        <div className="flex items-center gap-space-xs overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => {
              setActiveFilter('all');
              setPage(1);
            }}
            className={`shrink-0 px-3 py-1.5 font-label-md text-label-md rounded-lg transition-colors flex items-center gap-1.5 ${
              activeFilter === 'all'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Todos
            <span className="font-code-sm text-code-sm bg-surface-container-highest text-on-surface px-1.5 py-0.2 rounded-full">
              {data.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveFilter('instock');
              setPage(1);
            }}
            className={`shrink-0 px-3 py-1.5 font-label-md text-label-md rounded-lg transition-colors flex items-center gap-1.5 ${
              activeFilter === 'instock'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container shadow-sm'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">check</span>
            Apenas em estoque
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveFilter('active');
              setPage(1);
            }}
            className={`shrink-0 px-3 py-1.5 font-label-md text-label-md rounded-lg transition-colors flex items-center gap-1.5 ${
              activeFilter === 'active'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container shadow-sm'
            }`}
          >
            Somente ativos
            <DevOnly>
              <span className="font-code-sm text-code-sm opacity-80">
                (active=true)
              </span>
            </DevOnly>
          </button>
        </div>

        {/* Status & Telemetria da Lista */}
        <div className="flex items-center justify-between px-1 text-on-surface-variant">
          <span className="font-body-sm text-body-sm">
            Exibindo{' '}
            <strong className="text-on-surface font-medium">
              {displayedItems.length}
            </strong>{' '}
            de {data.total} produtos
          </span>
          <DevOnly>
            <span className="font-code-sm text-code-sm flex items-center gap-1 bg-surface-container px-2 py-0.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim" />
              mongodb: catalog_db
            </span>
          </DevOnly>
        </div>
      </section>

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded-xl bg-error-container text-on-error-container flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">error</span>
            <span className="font-body-sm text-body-sm">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void fetchCatalog()}
            className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface font-label-md text-label-md"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Grid de Produtos */}
      {loading ? (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-72 rounded-xl bg-surface-container-lowest p-space-md animate-pulse flex flex-col justify-between border border-surface-container"
            >
              <div className="h-36 bg-surface-container rounded-lg" />
              <div className="h-5 bg-surface-container rounded w-2/3" />
              <div className="h-4 bg-surface-container rounded w-full" />
              <div className="h-9 bg-surface-container rounded w-full" />
            </div>
          ))}
        </section>
      ) : displayedItems.length === 0 ? (
        <section className="bg-surface-container-lowest rounded-xl p-space-xl text-center shadow-sm border border-surface-container-high flex flex-col items-center gap-space-sm">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant">
            inventory_2
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface">
            Nenhum produto encontrado
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
            Não encontramos produtos para os filtros atuais. Você pode limpar a
            busca ou popular os 4 produtos de referência do Stitch.
          </p>
          <div className="flex items-center gap-2 pt-1">
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-lg text-label-lg"
              >
                Limpar busca
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleSeedDemoProducts()}
              disabled={seeding}
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg shadow-sm"
            >
              {seeding ? 'Populando...' : 'Popular 4 Produtos Demo'}
            </button>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
          {displayedItems.map((product) => {
            const isOutOfStock = product.stock === 0;
            const isLowStock = product.stock > 0 && product.stock <= 5;
            const isAdded = addedId === product.id;

            return (
              <article
                key={product.id}
                className={`flex flex-col bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high overflow-hidden transition-all duration-200 hover:shadow-md ${
                  !product.isActive || isOutOfStock ? 'opacity-90' : ''
                }`}
              >
                {/* Visual Box */}
                <div className="relative w-full h-40 bg-gradient-to-br from-surface-container-low to-secondary-container/40 flex items-center justify-center overflow-hidden">
                  <span className="material-symbols-outlined text-[56px] text-primary/30 select-none">
                    {product.sku.startsWith('TEC')
                      ? 'keyboard'
                      : product.sku.startsWith('MOU')
                        ? 'mouse'
                        : product.sku.startsWith('MON')
                          ? 'desktop_windows'
                          : 'dock'}
                  </span>

                  {/* SKU Badge */}
                  <div className="absolute top-2.5 left-2.5 flex items-center bg-surface-container-lowest/90 backdrop-blur-md px-2 py-0.5 rounded-lg shadow-sm">
                    <span className="font-code-sm text-code-sm text-on-surface font-medium select-all">
                      {product.sku}
                    </span>
                  </div>

                  {/* Stock / Active Badge */}
                  {!product.isActive ? (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-surface-container-highest text-on-surface-variant px-2 py-0.5 rounded-lg shadow-sm">
                      <span className="font-code-sm text-code-sm font-medium">
                        Inativo
                      </span>
                    </div>
                  ) : isOutOfStock ? (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-error text-on-error px-2 py-0.5 rounded-lg shadow-sm">
                      <span className="material-symbols-outlined text-[12px]">
                        block
                      </span>
                      <span className="font-code-sm text-code-sm font-medium">
                        Esgotado
                      </span>
                    </div>
                  ) : isLowStock ? (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-amber-500 text-on-primary px-2 py-0.5 rounded-lg shadow-sm">
                      <span className="material-symbols-outlined text-[12px]">
                        schedule
                      </span>
                      <span className="font-code-sm text-code-sm font-medium">
                        Últimas {product.stock} un.
                      </span>
                    </div>
                  ) : (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-tertiary text-on-tertiary px-2 py-0.5 rounded-lg shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed" />
                      <span className="font-code-sm text-code-sm font-medium">
                        Em estoque ({product.stock} un.)
                      </span>
                    </div>
                  )}
                </div>

                {/* Info & Actions */}
                <div className="flex flex-col flex-1 p-space-md gap-space-xs justify-between">
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface line-clamp-1">
                      {product.name}
                    </h3>
                    <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2 mt-1">
                      {product.description}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="font-headline-md text-headline-md text-on-surface tracking-tight font-semibold">
                        {formatBRL(product.price)}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        à vista
                      </span>
                      <DevOnly>
                        <span className="ml-auto font-code-sm text-code-sm text-on-surface-variant bg-surface-container-low px-1.5 py-0.5 rounded">
                          stock: {product.stock}
                        </span>
                      </DevOnly>
                    </div>

                    <div className="flex items-center gap-space-xs mt-space-sm pt-space-xs">
                      <Link
                        to={`/products/${product.id}`}
                        className="flex-1 py-2 bg-surface-container-low text-on-surface hover:bg-surface-container font-label-lg text-label-lg rounded-lg text-center transition-colors"
                      >
                        Ver detalhes
                      </Link>
                      <button
                        type="button"
                        disabled={isOutOfStock || !product.isActive}
                        onClick={() => {
                          addItem(product, 1);
                          setAddedId(product.id);
                          setTimeout(() => setAddedId(null), 1500);
                        }}
                        className={`flex-1 py-2 font-label-lg text-label-lg rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 ${
                          isOutOfStock || !product.isActive
                            ? 'bg-surface-container-highest text-on-surface-variant cursor-not-allowed'
                            : isAdded
                              ? 'bg-tertiary text-on-tertiary'
                              : 'bg-primary text-on-primary hover:opacity-95 active:scale-95'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {isOutOfStock
                            ? 'notifications'
                            : isAdded
                              ? 'check'
                              : 'add_shopping_cart'}
                        </span>
                        <span>
                          {isOutOfStock
                            ? 'Indisponível'
                            : isAdded
                              ? 'Adicionado'
                              : '+ Adicionar'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Paginação */}
      <section className="flex flex-col gap-space-sm bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-high">
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed text-on-surface font-label-md text-label-md rounded-lg flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">
              chevron_left
            </span>
            Anterior
          </button>

          <div className="flex items-center gap-1 font-code-sm text-code-sm">
            {Array.from(
              { length: Math.max(1, data.totalPages) },
              (_, idx) => idx + 1
            ).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold transition-colors ${
                  p === page
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={page >= Math.max(1, data.totalPages)}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container disabled:opacity-40 disabled:cursor-not-allowed text-on-surface font-label-md text-label-md rounded-lg flex items-center gap-1 transition-colors"
          >
            Próxima
            <span className="material-symbols-outlined text-[16px]">
              chevron_right
            </span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-1 text-on-surface-variant">
          <span className="font-body-sm text-body-sm">
            Página {data.page} de {Math.max(1, data.totalPages)} (Total:{' '}
            {data.total})
          </span>
          <select
            aria-label="Itens por página"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="bg-surface-container-low px-2.5 py-1 rounded-lg font-code-sm text-code-sm text-on-surface focus:outline-none"
          >
            <option value={6}>6 itens por pág.</option>
            <option value={12}>12 itens por pág.</option>
            <option value={24}>24 itens por pág.</option>
          </select>
        </div>
      </section>

      {/* Drawer Dobrável de Telemetria (Exclusivo Dev Mode) */}
      <JsonInspectorDrawer
        telemetry={telemetry}
        defaultEndpointLabel={currentEndpointString}
      />
    </div>
  );
};
