import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DevOnly,
  EndpointBar,
  JsonInspectorDrawer,
} from '../components/telemetry/DevTelemetry';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import type { ApiTelemetryRecord, Order, OrderStatus } from '../domain/types';
import { ApiError, orderApi } from '../services/api';
import { formatBRL } from './CatalogPage';

function statusBadgeStyle(status: OrderStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'PAID':
      return {
        label: 'PAGO / CONFIRMADO (PAID)',
        className: 'bg-tertiary text-on-tertiary',
      };
    case 'STOCK_RESERVED':
      return {
        label: 'ESTOQUE RESERVADO (STOCK_RESERVED)',
        className: 'bg-secondary-container text-on-secondary-container',
      };
    case 'CANCELLED':
      return {
        label: 'CANCELADO (CANCELLED)',
        className: 'bg-error-container text-on-error-container',
      };
    default:
      return {
        label: 'AGUARDANDO SAGA (PENDING)',
        className: 'bg-amber-500/20 text-amber-800',
      };
  }
}

export const OrdersPage: React.FC = () => {
  const { user, tokenJwt: token } = useAuth();
  const { items, totalPrice, updateQuantity, removeItem, clearCart } =
    useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [telemetry, setTelemetry] = useState<ApiTelemetryRecord | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoadingOrders(true);
    try {
      const res = await orderApi.listMyOrders(token);
      setOrders(res.data.items);
      setTelemetry(res.telemetry);
    } catch (err) {
      if (err instanceof ApiError) {
        setTelemetry(err.telemetry);
      }
    } finally {
      setLoadingOrders(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const handleCheckout = async () => {
    if (!token || !user) {
      setFeedback({
        type: 'error',
        message: 'Faça login antes de finalizar o pedido (POST /api/orders requer JWT).',
      });
      return;
    }
    if (items.length === 0) return;

    setSubmittingCheckout(true);
    setFeedback(null);
    try {
      const res = await orderApi.createOrder(
        {
          ...(simulateFailure ? { simulatePaymentFailure: true } : {}),
          // Preço, nome e SKU são resolvidos pelo order-service no catálogo
          items: items.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
          })),
        },
        token
      );
      setTelemetry(res.telemetry);
      clearCart();
      setFeedback({
        type: 'success',
        message: `Pedido #${res.data.id.slice(0, 8)} criado (PENDING)! A Saga Coreografada está processando no RabbitMQ...`,
      });
      await fetchOrders();
    } catch (err) {
      if (err instanceof ApiError) {
        setFeedback({
          type: 'error',
          message: `${err.statusCode} — ${err.message}`,
        });
        setTelemetry(err.telemetry);
      } else {
        setFeedback({
          type: 'error',
          message: 'Não foi possível conectar ao order-service (:3004).',
        });
      }
    } finally {
      setSubmittingCheckout(false);
    }
  };

  return (
    <div className="flex flex-col w-full gap-space-md">
      {/* Header & Dev Telemetry */}
      <section className="flex flex-col gap-space-xs bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-high">
        <DevOnly>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 bg-secondary-container text-on-secondary-container font-code-sm text-code-sm px-2.5 py-0.5 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
              order-service :3004 · Saga Coreografada (Outbox + RabbitMQ)
            </span>
            {telemetry && (
              <span className="font-code-sm text-code-sm text-tertiary">
                {telemetry.method} {telemetry.endpoint} · {telemetry.statusCode}{' '}
                ({telemetry.latencyMs}ms)
              </span>
            )}
          </div>
        </DevOnly>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
              Carrinho &amp; Meus Pedidos
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Finalize sua compra e acompanhe em tempo real a reserva de estoque
              e confirmação do pagamento.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md"
          >
            <span className="material-symbols-outlined text-[18px]">
              storefront
            </span>
            <span>Continuar Comprando</span>
          </Link>
        </div>

        <EndpointBar method="POST" endpoint="/api/orders" />
      </section>

      {feedback && (
        <div
          className={`p-3 rounded-xl flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-tertiary-fixed/40 text-on-tertiary-fixed border border-tertiary/20'
              : 'bg-error-container text-on-error-container'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {feedback.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <span className="font-body-sm text-body-sm font-medium">
            {feedback.message}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* Coluna Esquerda: Carrinho / Checkout */}
        <section className="lg:col-span-5 flex flex-col gap-space-sm">
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  shopping_cart
                </span>
                <span>Seu Carrinho ({items.length})</span>
              </h3>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="font-code-sm text-code-sm text-error hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="py-8 text-center text-on-surface-variant flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-[36px] opacity-50">
                  remove_shopping_cart
                </span>
                <p className="font-body-sm text-body-sm">
                  Seu carrinho está vazio. Adicione produtos na vitrine para
                  iniciar um pedido.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col divide-y divide-surface-container">
                  {items.map(({ product, quantity }) => (
                    <div
                      key={product.id}
                      className="py-3 flex items-center justify-between gap-2"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-label-lg text-label-lg text-on-surface truncate">
                          {product.name}
                        </span>
                        <span className="font-code-sm text-code-sm text-on-surface-variant">
                          {product.sku} · {formatBRL(product.price)} un.
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(product.id, quantity - 1)
                          }
                          className="w-7 h-7 rounded bg-surface-container text-on-surface flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-code-sm text-code-sm font-semibold">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(product.id, quantity + 1)
                          }
                          className="w-7 h-7 rounded bg-surface-container text-on-surface flex items-center justify-center"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(product.id)}
                          className="p-1 text-error hover:bg-error-container rounded"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-surface-container-low p-3 rounded-lg flex items-center justify-between">
                  <span className="font-label-lg text-label-lg text-on-surface-variant">
                    Total Calculado
                  </span>
                  <span className="font-headline-sm text-headline-sm text-primary font-bold">
                    {formatBRL(totalPrice)}
                  </span>
                </div>

                <DevOnly>
                  <label className="flex items-center gap-2 p-2.5 rounded-lg border border-surface-container bg-surface-container-lowest cursor-pointer">
                    <input
                      type="checkbox"
                      checked={simulateFailure}
                      onChange={(e) => setSimulateFailure(e.target.checked)}
                      className="w-4 h-4 rounded text-error focus:ring-error"
                    />
                    <span className="font-code-sm text-code-sm text-on-surface">
                      Simular Falha de Pagamento (Testar Compensação da Saga)
                    </span>
                  </label>
                </DevOnly>

                {!user ? (
                  <Link
                    to="/auth"
                    className="w-full py-2.5 px-4 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg text-center shadow-sm"
                  >
                    Entrar para Finalizar Pedido
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={submittingCheckout}
                    onClick={() => void handleCheckout()}
                    className="w-full py-3 px-4 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg font-medium shadow-sm hover:opacity-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      bolt
                    </span>
                    <span>
                      {submittingCheckout
                        ? 'Criando Pedido (Outbox)...'
                        : `Finalizar Pedido (${formatBRL(totalPrice)})`}
                    </span>
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        {/* Coluna Direita: Histórico de Pedidos e Status da Saga */}
        <section className="lg:col-span-7 flex flex-col gap-space-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              Meus Pedidos ({orders.length})
            </h3>
            {token && (
              <button
                type="button"
                onClick={() => void fetchOrders()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container text-on-surface font-code-sm text-code-sm"
              >
                <span className="material-symbols-outlined text-[15px]">
                  refresh
                </span>
                <span>Atualizar Saga</span>
              </button>
            )}
          </div>

          {!user ? (
            <div className="bg-surface-container-lowest p-space-xl rounded-xl text-center text-on-surface-variant border border-surface-container-high">
              Autentique-se em <Link to="/auth" className="text-primary underline">/auth</Link> para visualizar o histórico de pedidos da sua conta.
            </div>
          ) : loadingOrders ? (
            <div className="h-44 rounded-xl bg-surface-container-lowest animate-pulse" />
          ) : orders.length === 0 ? (
            <div className="bg-surface-container-lowest p-space-xl rounded-xl text-center text-on-surface-variant border border-surface-container-high">
              Você ainda não possui pedidos registrados no <code>order_db</code>.
            </div>
          ) : (
            orders.map((order) => {
              const badge = statusBadgeStyle(order.status);
              return (
                <article
                  key={order.id}
                  className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-space-sm"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-code-sm text-code-sm font-semibold bg-surface-container-low px-2 py-0.5 rounded">
                        #{order.id.slice(0, 8)}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {new Date(order.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-lg font-code-sm text-code-sm font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {order.cancelReason && (
                    <div className="text-error font-code-sm text-code-sm bg-error-container/40 px-2.5 py-1 rounded">
                      Motivo do cancelamento: {order.cancelReason}
                    </div>
                  )}

                  <div className="flex flex-col gap-1 bg-surface-container-low p-2.5 rounded-lg">
                    {order.items.map((item, idx) => (
                      <div
                        key={item.id ?? idx}
                        className="flex items-center justify-between font-body-sm text-body-sm"
                      >
                        <span>
                          {item.quantity}x {item.name}{' '}
                          <code className="text-on-surface-variant">
                            ({item.sku})
                          </code>
                        </span>
                        <span className="font-medium">
                          {formatBRL(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t border-surface-container pt-1.5 mt-1 flex items-center justify-between font-label-lg text-label-lg font-bold">
                      <span>Total do Pedido</span>
                      <span className="text-primary">
                        {formatBRL(order.total)}
                      </span>
                    </div>
                  </div>

                  {/* Controles e Informações da Saga Coreografada */}
                  <DevOnly>
                    <div className="border-t border-surface-container pt-2 flex items-center justify-between text-on-surface-variant font-code-sm text-code-sm">
                      <span className="flex items-center gap-1 text-primary">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                        Saga processada exclusivamente via RabbitMQ (Event-Driven)
                      </span>
                      <span>Order #{order.id.slice(0, 8)}</span>
                    </div>
                  </DevOnly>
                </article>
              );
            })
          )}
        </section>
      </div>

      <JsonInspectorDrawer
        telemetry={telemetry}
        defaultEndpointLabel="GET /api/orders"
      />
    </div>
  );
};
