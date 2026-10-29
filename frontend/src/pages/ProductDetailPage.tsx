import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  DevOnly,
  EndpointBar,
  JsonInspectorDrawer,
} from '../components/telemetry/DevTelemetry';
import { useCart } from '../context/CartContext';
import type { ApiTelemetryRecord, Product } from '../domain/types';
import { ApiError, catalogApi, inventoryApi } from '../services/api';
import { withLiveStock } from '../domain/stock';
import { formatBRL } from './CatalogPage';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [telemetry, setTelemetry] = useState<ApiTelemetryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [copiedId, setCopiedId] = useState(false);
  const [boughtFeedback, setBoughtFeedback] = useState(false);

  const loadProduct = async (targetId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await catalogApi.getProductById(targetId);
      const stock = await inventoryApi.getBySku(res.data.sku).catch(() => null);
      setProduct(stock ? withLiveStock([res.data], [stock.data])[0] ?? res.data : res.data);
      setTelemetry(res.telemetry);
      setQty(1);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.statusCode} — ${err.message}`);
        setTelemetry(err.telemetry);
      } else {
        setError('Erro ao carregar produto.');
      }
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      void loadProduct(id);
    }
  }, [id]);

  const handleSimulate404 = async () => {
    await loadProduct('000000000000000000000000');
  };

  return (
    <div className="flex flex-col w-full gap-space-md">
      {/* Context Bar & Breadcrumbs */}
      <div className="flex flex-col gap-space-xs">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface transition-colors py-1"
          >
            <span className="material-symbols-outlined text-[18px]">
              arrow_back
            </span>
            <span className="font-label-md text-label-md">
              Voltar ao Catálogo
            </span>
          </Link>

          <DevOnly>
            <div className="inline-flex items-center gap-1.5 bg-surface-container-low px-2.5 py-0.5 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim animate-pulse" />
              <span className="font-code-sm text-code-sm text-tertiary">
                catalog-service · gateway :8080
              </span>
              {telemetry && (
                <>
                  <span className="text-outline-variant font-code-sm text-code-sm">
                    ·
                  </span>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    {telemetry.latencyMs}ms
                  </span>
                </>
              )}
            </div>
          </DevOnly>
        </div>

        <div className="flex items-center gap-1.5 text-on-surface-variant font-code-sm text-code-sm">
          <Link to="/" className="hover:text-primary transition-colors">
            Catálogo
          </Link>
          <span>/</span>
          <span className="text-on-surface font-medium truncate">
            {product?.name || id}
          </span>
        </div>
      </div>

      {/* Telemetry Endpoint Bar */}
      <EndpointBar
        method="GET"
        endpoint={`/api/products/${id || ''}`}
        badgeText="HTTP/1.1"
      />

      {loading ? (
        <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm animate-pulse h-80" />
      ) : error || !product ? (
        <div className="bg-error-container text-on-error-container p-space-lg rounded-xl flex flex-col gap-2">
          <div className="flex items-center gap-2 font-headline-sm text-headline-sm">
            <span className="material-symbols-outlined text-[22px]">error</span>
            <span>{error || '404 — Product Not Found'}</span>
          </div>
          <p className="font-body-md text-body-md">
            O produto solicitado não foi encontrado no MongoDB do{' '}
            <code>catalog-service</code>.
          </p>
          <div className="flex items-center gap-2 pt-2">
            {id && (
              <button
                type="button"
                onClick={() => void loadProduct(id)}
                className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md"
              >
                Recarregar ID original
              </button>
            )}
            <Link
              to="/"
              className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md"
            >
              Ir para o Catálogo
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
          {/* Left Column: Media & Technical Metadata */}
          <div className="lg:col-span-6 flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container-high flex flex-col gap-space-sm">
              <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-gradient-to-br from-surface-container-low to-secondary-container/40 flex items-center justify-center">
                <span className="material-symbols-outlined text-[96px] text-primary/30">
                  {product.sku.startsWith('TEC')
                    ? 'keyboard'
                    : product.sku.startsWith('MOU')
                      ? 'mouse'
                      : product.sku.startsWith('MON')
                        ? 'desktop_windows'
                        : 'devices'}
                </span>

                <div className="absolute top-3 left-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-code-sm text-code-sm shadow-sm ${
                      product.stock > 0
                        ? 'bg-surface-container-lowest/90 text-tertiary'
                        : 'bg-error text-on-error'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {product.stock > 0
                      ? `Em estoque (${product.stock} un.)`
                      : 'Esgotado'}
                  </span>
                </div>

                <div className="absolute top-3 right-3">
                  <span className="bg-inverse-surface/85 text-inverse-on-surface font-code-sm text-code-sm px-2.5 py-1 rounded shadow-sm">
                    SKU: {product.sku}
                  </span>
                </div>
              </div>
            </div>

            {/* Technical REST Contract Metadata Card (Dev Mode Only) */}
            <DevOnly>
              <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container-high flex flex-col gap-space-xs">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-[18px]">
                      terminal
                    </span>
                    <span className="font-label-md text-label-md text-on-surface uppercase tracking-wider font-semibold">
                      Metadata Contrato REST
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 bg-surface-container-low text-tertiary font-code-sm text-code-sm px-2 py-0.5 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim" />
                    isActive: {String(product.isActive)}
                  </span>
                </div>

                <div className="bg-surface-container-low rounded-lg p-space-sm flex items-center justify-between gap-space-xs">
                  <div className="flex flex-col min-w-0">
                    <span className="font-code-sm text-code-sm text-on-surface-variant">
                      MongoDB ObjectId
                    </span>
                    <span className="font-code-sm text-code-sm text-on-surface font-medium truncate select-all">
                      {product.id}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(product.id);
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 1500);
                    }}
                    className="p-1.5 bg-surface-container-highest hover:bg-surface-container text-on-surface rounded transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {copiedId ? 'check' : 'content_copy'}
                    </span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    Testar resposta 404 Not Found:
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleSimulate404()}
                    className="bg-surface-container-highest hover:bg-error-container hover:text-on-error-container text-on-surface font-code-sm text-code-sm px-2.5 py-1 rounded transition-colors"
                  >
                    ⚡ Simular 404
                  </button>
                </div>
              </div>
            </DevOnly>
          </div>

          {/* Right Column: Commercial Details & Actions */}
          <div className="lg:col-span-6 flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container-high flex flex-col gap-space-md">
              <div className="flex flex-col gap-1">
                <div className="inline-flex items-center gap-2">
                  <span className="bg-secondary-container text-on-secondary-container font-code-sm text-code-sm px-2 py-0.5 rounded uppercase tracking-wider font-semibold">
                    Hardware / Developer Edition
                  </span>
                  <span className="font-code-sm text-code-sm text-tertiary font-medium">
                    Verificado
                  </span>
                </div>
                <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-semibold tracking-tight mt-1">
                  {product.name}
                </h2>
              </div>

              <div className="bg-surface-container-low p-space-md rounded-lg flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-headline-lg text-headline-lg text-primary font-bold tracking-tight">
                    {formatBRL(product.price)}
                  </span>
                  <span className="bg-tertiary-fixed text-on-tertiary-fixed font-code-sm text-code-sm px-1.5 py-0.5 rounded font-semibold">
                    -5% no PIX
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-tertiary font-body-sm text-body-sm">
                  <span className="material-symbols-outlined text-[16px]">
                    local_shipping
                  </span>
                  <span>
                    {product.stock} unidades prontas para despacho imediato
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <h3 className="font-label-lg text-label-lg text-on-surface font-semibold">
                  Descrição do Produto
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  {product.description}
                </p>
              </div>

              {/* Quantity Selector & CTA */}
              <div className="flex flex-col gap-space-sm pt-space-xs">
                <div className="flex items-center justify-between">
                  <span className="font-label-lg text-label-lg text-on-surface font-medium">
                    Quantidade
                  </span>
                  <div className="inline-flex items-center bg-surface-container-low rounded-lg p-0.5">
                    <button
                      type="button"
                      disabled={qty <= 1}
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="w-8 h-8 flex items-center justify-center rounded bg-surface-container-lowest text-on-surface disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        remove
                      </span>
                    </button>
                    <span className="w-10 text-center font-code-md text-code-md font-semibold text-on-surface">
                      {qty}
                    </span>
                    <button
                      type="button"
                      disabled={qty >= Math.max(1, product.stock)}
                      onClick={() =>
                        setQty((q) => Math.min(product.stock, q + 1))
                      }
                      className="w-8 h-8 flex items-center justify-center rounded bg-surface-container-lowest text-on-surface disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        add
                      </span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={product.stock === 0 || !product.isActive}
                  onClick={() => {
                    addItem(product, qty);
                    setBoughtFeedback(true);
                    setTimeout(() => {
                      setBoughtFeedback(false);
                      navigate('/orders');
                    }, 900);
                  }}
                  className="w-full bg-primary-container hover:bg-primary disabled:opacity-40 text-on-primary py-3 rounded-lg font-label-lg text-label-lg font-medium flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {boughtFeedback ? 'check_circle' : 'bolt'}
                  </span>
                  <span>
                    {boughtFeedback
                      ? 'Item reservado com sucesso!'
                      : `Comprar Agora (${formatBRL(product.price * qty)})`}
                  </span>
                </button>

                <DevOnly>
                  <div className="pt-space-xs flex justify-center">
                    <Link
                      to="/admin/products"
                      className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface font-code-sm text-code-sm bg-surface-container-low hover:bg-surface-container px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        build
                      </span>
                      <span>Editar no Admin (/admin/products)</span>
                    </Link>
                  </div>
                </DevOnly>
              </div>
            </div>
          </div>
        </div>
      )}

      <JsonInspectorDrawer
        telemetry={telemetry}
        defaultEndpointLabel={`GET /api/products/${id || ''}`}
      />
    </div>
  );
};
