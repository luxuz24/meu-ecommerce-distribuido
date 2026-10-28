import React, { useCallback, useEffect, useState } from 'react';
import {
  DevOnly,
  EndpointBar,
  JsonInspectorDrawer,
} from '../components/telemetry/DevTelemetry';
import { useAuth } from '../context/AuthContext';
import type { ApiTelemetryRecord, Product } from '../domain/types';
import { ApiError, catalogApi, inventoryApi, userApi } from '../services/api';
import { DEMO_ADMIN } from '../config/demoAccounts';
import { formatBRL } from './CatalogPage';

export const AdminProductsPage: React.FC = () => {
  const { user, saveSession } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all');
  const [loading, setLoading] = useState(true);
  const [telemetry, setTelemetry] = useState<ApiTelemetryRecord | null>(null);

  // Mutation Drawer / Form State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formPrice, setFormPrice] = useState('0');
  const [formStock, setFormStock] = useState('0');
  const [formDesc, setFormDesc] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: {
        page: number;
        limit: number;
        q?: string;
        active?: boolean;
      } = {
        page: 1,
        limit: 50,
      };
      if (searchQuery.trim()) params.q = searchQuery.trim();
      if (statusFilter === 'active') params.active = true;
      if (statusFilter === 'inactive') params.active = false;

      const res = await catalogApi.listProducts(params);
      setProducts(res.data.items);
      setTotal(res.data.total);
      setTelemetry(res.telemetry);
    } catch (err) {
      if (err instanceof ApiError) {
        setTelemetry(err.telemetry);
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const openCreateForm = () => {
    setEditingProduct(null);
    setIsCreating(true);
    setFormName('');
    setFormSku(`DEV-GEAR-${Math.floor(100 + Math.random() * 900)}`);
    setFormPrice('399.90');
    setFormStock('20');
    setFormDesc(
      'Equipamento de alta precisão projetado para estações de desenvolvimento.'
    );
    setFormActive(true);
    setFormError(null);
    setFormSuccess(null);
  };

  const openEditForm = (product: Product) => {
    setIsCreating(false);
    setEditingProduct(product);
    setFormName(product.name);
    setFormSku(product.sku);
    setFormPrice(String(product.price));
    setFormStock(String(product.stock));
    setFormDesc(product.description);
    setFormActive(product.isActive);
    setFormError(null);
    setFormSuccess(null);
  };

  const handleSubmitMutation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      if (isCreating) {
        const res = await catalogApi.createProduct({
          name: formName.trim(),
          sku: formSku.trim(),
          price: Number(formPrice),
          stock: Number(formStock),
          description: formDesc.trim(),
        });
        try {
          await inventoryApi.seedStock({
            productId: res.data.id,
            sku: res.data.sku,
            availableQty: Number(formStock),
          });
        } catch {
          // Optional sync with inventory-service when running locally
        }
        setTelemetry(res.telemetry);
        setFormSuccess(`Produto "${res.data.name}" criado com sucesso (201)!`);
        setIsCreating(false);
      } else if (editingProduct) {
        const res = await catalogApi.updateProduct(editingProduct.id, {
          name: formName.trim(),
          price: Number(formPrice),
          stock: Number(formStock),
          description: formDesc.trim(),
          isActive: formActive,
        });
        try {
          await inventoryApi.seedStock({
            productId: res.data.id,
            sku: res.data.sku,
            availableQty: Number(formStock),
          });
        } catch {
          // Optional sync with inventory-service when running locally
        }
        setTelemetry(res.telemetry);
        setEditingProduct(res.data);
        setFormSuccess(
          `Produto "${res.data.name}" atualizado via PATCH com sucesso (200)!`
        );
      }
      await loadProducts();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`${err.statusCode} — ${err.message}`);
        setTelemetry(err.telemetry);
      } else {
        setFormError('Erro ao salvar produto no catalog-service.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSoftDelete = async (product: Product) => {
    setFormError(null);
    setFormSuccess(null);
    try {
      const res = await catalogApi.deleteProduct(product.id);
      setTelemetry(res.telemetry);
      setFormSuccess(
        `Soft Delete executado em "${product.sku}" (DELETE /api/products/${product.id} → 204 No Content, isActive: false).`
      );
      if (editingProduct?.id === product.id) {
        setEditingProduct({ ...product, isActive: false });
        setFormActive(false);
      }
      await loadProducts();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`${err.statusCode} — ${err.message}`);
        setTelemetry(err.telemetry);
      }
    }
  };

  const handleReactivate = async (product: Product) => {
    setFormError(null);
    setFormSuccess(null);
    try {
      const res = await catalogApi.updateProduct(product.id, {
        isActive: true,
      });
      setTelemetry(res.telemetry);
      setFormSuccess(
        `Produto "${product.sku}" reativado via PATCH (isActive: true)!`
      );
      await loadProducts();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(`${err.statusCode} — ${err.message}`);
        setTelemetry(err.telemetry);
      }
    }
  };

  return (
    <div className="flex flex-col w-full gap-space-md">
      {/* 1. SUB-HEADER & TELEMETRIA DO MICROSSERVIÇO */}
      <DevOnly>
        <section className="flex flex-col gap-space-xs bg-surface-container-low p-space-md rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <nav className="flex items-center gap-1.5 font-code-sm text-code-sm text-on-surface-variant truncate">
              <span>Início</span>
              <span>/</span>
              <span>Administração</span>
              <span>/</span>
              <span className="text-primary font-medium">/admin/products</span>
            </nav>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-surface-container-high text-on-surface-variant font-code-sm text-code-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              CRUD Completo
            </span>
          </div>

          <div className="flex items-center gap-space-xs overflow-x-auto no-scrollbar pt-1">
            <div className="inline-flex items-center gap-1.5 bg-surface-container-lowest px-2.5 py-1 rounded-lg shadow-sm whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim animate-ping" />
              <span className="font-code-sm text-code-sm text-on-surface">
                catalog-service :3001
              </span>
              {telemetry && (
                <span className="font-code-sm text-code-sm text-tertiary font-semibold">
                  · {telemetry.latencyMs}ms · {telemetry.statusCode}
                </span>
              )}
            </div>
            <div className="inline-flex items-center gap-1 bg-surface-container-lowest px-2 py-1 rounded-lg shadow-sm whitespace-nowrap">
              <span className="font-code-sm text-code-sm text-on-surface-variant uppercase tracking-wider">
                JWT ROLE:
              </span>
              <span
                className={`font-code-sm text-code-sm font-semibold ${
                  user?.role === 'ADMIN' ? 'text-tertiary' : 'text-error'
                }`}
              >
                {user?.role || 'NÃO AUTENTICADO'}
              </span>
            </div>
            {user?.role !== 'ADMIN' && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await userApi.login(DEMO_ADMIN);
                    saveSession(res.data.tokenJwt, res.data.user, res.telemetry);
                    setFormSuccess(
                      `Sessão ADMIN autenticada (${DEMO_ADMIN.email})! Mutações liberadas.`
                    );
                  } catch {
                    setFormError('Erro ao autenticar sessão Admin automática.');
                  }
                }}
                className="inline-flex items-center gap-1 bg-primary text-on-primary px-2.5 py-1 rounded-lg font-code-sm text-code-sm font-semibold shadow-sm whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[14px]">
                  key
                </span>
                <span>Entrar como ADMIN demo</span>
              </button>
            )}
          </div>
        </section>
      </DevOnly>

      {/* 2. HEADER DO PAINEL & AÇÕES PRINCIPAIS */}
      <section className="flex flex-col gap-space-sm bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-high">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
              Gerenciamento de Catálogo
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Cadastre novos produtos, atualize preços/estoques e gerencie a disponibilidade na loja.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            className="flex items-center justify-between gap-3 bg-primary-container hover:bg-primary text-on-primary py-2.5 px-space-md rounded-lg shadow-sm transition-all"
          >
            <span className="flex items-center gap-1.5 font-label-lg text-label-lg font-medium">
              <span className="material-symbols-outlined text-[20px]">
                add_circle
              </span>
              + Novo Produto
            </span>
            <DevOnly>
              <span className="font-code-sm text-code-sm bg-primary text-on-primary-container px-2 py-0.5 rounded-lg">
                [POST /api/products]
              </span>
            </DevOnly>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">
              search
            </span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por SKU ou Nome... (?q=)"
            className="w-full pl-9 pr-14 py-2 bg-surface-container-low text-on-surface font-body-sm text-body-sm rounded-lg focus:outline-none focus:bg-surface-container-lowest shadow-sm"
          />
          <DevOnly>
            <span className="absolute inset-y-0 right-0 pr-3 flex items-center font-code-sm text-code-sm text-on-surface-variant">
              GET
            </span>
          </DevOnly>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-space-xs overflow-x-auto no-scrollbar pt-1">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-label-md text-label-md whitespace-nowrap transition-colors ${
              statusFilter === 'all'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Todos ({total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg font-label-md text-label-md whitespace-nowrap transition-colors ${
              statusFilter === 'active'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Ativos
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-lg font-label-md text-label-md whitespace-nowrap transition-colors ${
              statusFilter === 'inactive'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Inativos / Soft Deleted
          </button>
        </div>
      </section>

      {/* Banners de Feedback */}
      {formSuccess && (
        <div className="flex items-center gap-2 bg-tertiary-fixed/40 text-on-tertiary-fixed p-3 rounded-xl border border-tertiary/20">
          <span className="material-symbols-outlined text-tertiary text-[20px]">
            check_circle
          </span>
          <span className="font-body-sm text-body-sm font-medium">
            {formSuccess}
          </span>
        </div>
      )}

      {formError && (
        <div className="flex items-center gap-2 bg-error-container text-on-error-container p-3 rounded-xl">
          <span className="material-symbols-outlined text-error text-[20px]">
            error
          </span>
          <span className="font-body-sm text-body-sm font-medium">
            {formError}
          </span>
        </div>
      )}

      {/* Grid Principal: Lista de Produtos + Formulário de Mutação */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* Lista de Produtos */}
        <section className="lg:col-span-7 flex flex-col gap-space-sm">
          <div className="flex items-center justify-between px-space-xs">
            <span className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
              Produtos Cadastrados ({products.length})
            </span>
          </div>

          {loading ? (
            <div className="h-48 rounded-xl bg-surface-container-lowest animate-pulse" />
          ) : products.length === 0 ? (
            <div className="bg-surface-container-lowest p-space-xl rounded-xl text-center text-on-surface-variant border border-surface-container-high">
              Nenhum produto encontrado para este filtro. Clique em{' '}
              <strong>+ Novo Produto</strong> para criar.
            </div>
          ) : (
            products.map((product) => (
              <article
                key={product.id}
                className={`flex flex-col bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-high gap-space-sm ${
                  !product.isActive ? 'opacity-80' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="font-code-sm text-code-sm font-semibold bg-surface-container-low text-on-surface px-2 py-0.5 rounded-lg">
                      {product.sku}
                    </span>
                    <DevOnly>
                      <span className="font-code-sm text-code-sm text-on-surface-variant/80">
                        ID: {product.id.slice(0, 6)}...{product.id.slice(-4)}
                      </span>
                    </DevOnly>
                  </div>
                  {product.isActive ? (
                    <span className="inline-flex items-center gap-1 bg-surface-container-low text-tertiary px-2 py-0.5 rounded-lg font-code-sm text-code-sm font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                      Ativo (isActive: true)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-surface-container-high text-on-surface-variant px-2 py-0.5 rounded-lg font-code-sm text-code-sm font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-outline" />
                      Inativo (isActive: false)
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-space-sm">
                  <div className="w-11 h-11 rounded-lg bg-surface-container-low flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-[22px]">
                      inventory_2
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <h3
                      className={`font-headline-sm text-headline-sm truncate ${
                        product.isActive
                          ? 'text-on-surface'
                          : 'text-on-surface-variant line-through'
                      }`}
                    >
                      {product.name}
                    </h3>
                    <span className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1">
                      {product.description}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-surface-container-low p-2 rounded-lg">
                  <div className="flex flex-col">
                    <span className="font-code-sm text-code-sm text-on-surface-variant">
                      Preço unitário
                    </span>
                    <span className="font-label-lg text-label-lg font-semibold text-on-surface">
                      {formatBRL(product.price)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-code-sm text-code-sm text-on-surface-variant">
                      Estoque disponível
                    </span>
                    <span
                      className={`font-label-lg text-label-lg font-semibold flex items-center gap-1 ${
                        product.stock === 0
                          ? 'text-error'
                          : product.stock <= 5
                            ? 'text-amber-600'
                            : 'text-tertiary'
                      }`}
                    >
                      {product.stock} un.
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-space-xs pt-1">
                  <button
                    type="button"
                    onClick={() => openEditForm(product)}
                    className="w-full flex items-center justify-center gap-1 bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md py-2 px-3 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">
                      edit
                    </span>
                    Editar (PATCH)
                  </button>

                  {product.isActive ? (
                    <button
                      type="button"
                      onClick={() => void handleSoftDelete(product)}
                      className="w-full flex items-center justify-center gap-1 bg-surface-container hover:bg-error-container text-error font-label-md text-label-md py-2 px-3 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        archive
                      </span>
                      Desativar (DELETE)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleReactivate(product)}
                      className="w-full flex items-center justify-center gap-1 bg-secondary-container hover:bg-secondary-fixed text-on-secondary-container font-label-md text-label-md py-2 px-3 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px] text-tertiary">
                        settings_backup_restore
                      </span>
                      Reativar (PATCH)
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </section>

        {/* 4. FORMULÁRIO DE MUTAÇÃO (CRIAR / EDITAR) */}
        <section className="lg:col-span-5">
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-md border border-surface-container-high flex flex-col gap-space-md sticky top-28">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">
                    {isCreating
                      ? 'Novo Produto (POST)'
                      : editingProduct
                        ? 'Mutação de Produto (PATCH)'
                        : 'Selecione um Produto ou Crie Novo'}
                  </h3>
                </div>
                <DevOnly>
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    API Contract v1
                  </span>
                </DevOnly>
              </div>

              {(isCreating || editingProduct) && (
                <EndpointBar
                  method={isCreating ? 'POST' : 'PATCH'}
                  endpoint={
                    isCreating
                      ? '/api/products'
                      : `/api/products/${editingProduct?.id || ''}`
                  }
                />
              )}
            </div>

            {!isCreating && !editingProduct ? (
              <div className="py-8 text-center text-on-surface-variant font-body-sm text-body-sm flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-[32px] text-primary">
                  touch_app
                </span>
                <p>
                  Clique em <strong>Editar (PATCH)</strong> em qualquer produto
                  ao lado ou em <strong>+ Novo Produto</strong> para abrir o
                  formulário de mutação.
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => void handleSubmitMutation(e)}
                className="flex flex-col gap-space-sm"
              >
                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md text-on-surface font-medium flex items-center justify-between">
                    <span>Nome do Produto (name)</span>
                    <DevOnly>
                      <span className="font-code-sm text-code-sm text-on-surface-variant">
                        string · min(1)
                      </span>
                    </DevOnly>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low text-on-surface font-body-md text-body-md rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md text-on-surface font-medium flex items-center justify-between">
                    <span>Código SKU (sku)</span>
                    {!isCreating && (
                      <span className="font-code-sm text-code-sm text-error">
                        Imutável em PATCH (readonly)
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      readOnly={!isCreating}
                      value={formSku}
                      onChange={(e) => setFormSku(e.target.value)}
                      className={`w-full px-3 py-2 font-code-md text-code-md rounded-lg focus:outline-none ${
                        !isCreating
                          ? 'bg-surface-container-high text-on-surface-variant cursor-not-allowed'
                          : 'bg-surface-container-low text-on-surface'
                      }`}
                    />
                    {!isCreating && (
                      <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-[16px]">
                          lock
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-space-sm">
                  <div className="flex flex-col gap-1">
                    <label className="font-label-md text-label-md text-on-surface font-medium">
                      Preço (R$) (price)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-container-low text-on-surface font-code-md text-code-md rounded-lg focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-label-md text-label-md text-on-surface font-medium">
                      Estoque (stock)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={formStock}
                      onChange={(e) => setFormStock(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-container-low text-on-surface font-code-md text-code-md rounded-lg focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md text-on-surface font-medium">
                    Descrição (description)
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-container-low text-on-surface font-body-sm text-body-sm rounded-lg focus:outline-none resize-none"
                  />
                </div>

                {!isCreating && (
                  <div className="flex items-center justify-between p-space-sm bg-surface-container-low rounded-lg">
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md text-on-surface font-medium">
                        Produto Ativo na Loja (isActive)
                      </span>
                      <span className="font-code-sm text-code-sm text-on-surface-variant">
                        Visível para consultas no Catalog API
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formActive}
                      onClick={() => setFormActive((a) => !a)}
                      className={`w-12 h-6 rounded-full relative p-0.5 transition-colors duration-200 ${
                        formActive ? 'bg-primary' : 'bg-outline-variant'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 bg-on-primary rounded-full block shadow-sm transition-transform duration-200 ${
                          formActive ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setEditingProduct(null);
                    }}
                    className="px-3 py-2.5 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg font-medium shadow-sm hover:opacity-95 disabled:opacity-50"
                  >
                    {submitting
                      ? 'Salvando...'
                      : isCreating
                        ? 'Criar Produto (POST)'
                        : 'Salvar Alterações (PATCH)'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>

      <JsonInspectorDrawer
        telemetry={telemetry}
        defaultEndpointLabel="GET /api/products"
      />
    </div>
  );
};
