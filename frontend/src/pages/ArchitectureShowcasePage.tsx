import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface ServiceCard {
  id: string;
  name: string;
  port: number;
  db: string;
  dbType: 'PostgreSQL' | 'MongoDB';
  role: string;
  endpoints: string[];
  events: { emits: string[]; consumes: string[] };
  color: string;
}

const SERVICES_TOPOLOGY: ServiceCard[] = [
  {
    id: 'user-service',
    name: 'User Service',
    port: 3000,
    db: 'user_db',
    dbType: 'PostgreSQL',
    role: 'Identidade, Cadastro com hash bcrypt, Autenticação JWT (HS256) e RBAC (CUSTOMER / ADMIN).',
    endpoints: ['POST /users', 'POST /login', 'GET /users/me', 'GET /health'],
    events: {
      emits: ['user_created (via Transactional Outbox)'],
      consumes: [],
    },
    color: 'border-blue-500/30 bg-blue-500/5',
  },
  {
    id: 'catalog-service',
    name: 'Catalog Service',
    port: 3001,
    db: 'catalog_db',
    dbType: 'MongoDB',
    role: 'Catálogo de Produtos em NoSQL, busca textual indexada, paginação, sanitização contra NoSQL injection e CRUD protegido por role ADMIN.',
    endpoints: ['GET /api/products', 'GET /api/products/:id', 'POST /api/products (Admin)', 'PATCH /api/products/:id (Admin)', 'DELETE /api/products/:id (Admin)'],
    events: {
      emits: [],
      consumes: [],
    },
    color: 'border-emerald-500/30 bg-emerald-500/5',
  },
  {
    id: 'inventory-service',
    name: 'Inventory Service',
    port: 3003,
    db: 'inventory_db',
    dbType: 'PostgreSQL',
    role: 'Gestão de Estoque e Reserva Atômica. Consome order_created da Saga, reserva itens ou rejeita com fallback transacional e tabela de idempotência.',
    endpoints: ['GET /api/inventory', 'GET /api/inventory/:sku', 'POST /api/inventory/seed (Admin)', 'Evento: order_created → reserva', 'Evento: payment_failed → estorno', 'Evento: order_confirmed → baixa'],
    events: {
      emits: ['stock_reserved', 'stock_rejected'],
      consumes: ['order_created', 'payment_failed (compensação/libera estoque)'],
    },
    color: 'border-amber-500/30 bg-amber-500/5',
  },
  {
    id: 'order-service',
    name: 'Order Service',
    port: 3004,
    db: 'order_db',
    dbType: 'PostgreSQL',
    role: 'Inicia a Saga e aplica seu desfecho na máquina de estados (PENDING → STOCK_RESERVED → PAID / CANCELLED). Preço, nome e SKU resolvidos no catalog-service; anti-IDOR.',
    endpoints: ['POST /api/orders {productId, quantity}', 'GET /api/orders', 'GET /api/orders/:id (dono ou Admin)', 'Eventos: stock_* / payment_* → status'],
    events: {
      emits: ['order_created', 'order_confirmed', 'order_cancelled'],
      consumes: ['stock_reserved', 'stock_rejected', 'payment_approved', 'payment_failed'],
    },
    color: 'border-purple-500/30 bg-purple-500/5',
  },
  {
    id: 'payment-service',
    name: 'Payment Service',
    port: 3005,
    db: 'payment_db',
    dbType: 'PostgreSQL',
    role: 'Processamento de Pagamento com regra antifraude, persistência idempotente na Outbox e simulação de aprovação/recusa para acionar a Saga.',
    endpoints: ['GET /api/payments/:orderId (dono ou Admin)', 'Evento: stock_reserved → cobrança'],
    events: {
      emits: ['payment_approved', 'payment_failed'],
      consumes: ['stock_reserved'],
    },
    color: 'border-pink-500/30 bg-pink-500/5',
  },
];

const SAGA_STEPS = [
  {
    step: 1,
    title: '1. Criação do Pedido (Order Service)',
    desc: 'O cliente clica em "Finalizar Pedido". O Order Service valida o carrinho, calcula o valor real no servidor, insere o pedido com status PENDING e grava o evento order_created na tabela outbox na mesma transação.',
    badge: 'PENDING',
    source: 'order-service',
    target: 'RabbitMQ (ecommerce_events)',
  },
  {
    step: 2,
    title: '2. Reserva Atômica de Estoque (Inventory Service)',
    desc: 'O Inventory Service consome order_created. Se houver saldo para todos os SKUs, reserva os itens e publica stock_reserved. Se faltar estoque, publica stock_rejected.',
    badge: 'STOCK_RESERVED ou STOCK_REJECTED',
    source: 'inventory-service',
    target: 'payment-service & order-service',
  },
  {
    step: 3,
    title: '3. Análise e Pagamento (Payment Service)',
    desc: 'Ao escutar stock_reserved, o Payment Service processa a cobrança. Se aprovado (valores até R$ 50.000), emite payment_approved. Se recusado, emite payment_failed com o motivo.',
    badge: 'PAYMENT_APPROVED ou PAYMENT_FAILED',
    source: 'payment-service',
    target: 'order-service & inventory-service',
  },
  {
    step: 4,
    title: '4. Conclusão ou Compensação da Saga (Order & Notification)',
    desc: 'Se o pagamento for aprovado: o pedido muda para PAID/CONFIRMED e o Notification Service envia o e-mail. Se falhar: o Order Service cancela o pedido e o Inventory Service devolve as unidades reservadas (compensação).',
    badge: 'PAID (Sucesso) ou CANCELLED (Compensação)',
    source: 'order-service',
    target: 'notification-service (DLQ Protegida)',
  },
];

export const ArchitectureShowcasePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'topology' | 'saga' | 'patterns'>('topology');
  const [activeSagaStep, setActiveSagaStep] = useState<number>(1);

  return (
    <div className="flex flex-col w-full gap-space-md">
      {/* Header com propósito educacional */}
      <section className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined text-[24px]">account_tree</span>
            </span>
            <div>
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
                Living Architecture &amp; Showcase
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Guia interativo e caso de uso real de como funciona um ecossistema de microsserviços distribuídos.
              </p>
            </div>
          </div>
          <Link
            to="/orders"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">play_circle</span>
            <span>Testar Saga ao Vivo</span>
          </Link>
        </div>

        {/* Abas */}
        <div className="flex items-center gap-2 border-b border-surface-container pt-3">
          <button
            type="button"
            onClick={() => setActiveTab('topology')}
            className={`px-3 py-2 font-label-md text-label-md border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'topology'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">hub</span>
            <span>1. Topologia &amp; Serviços (5 APIs)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('saga')}
            className={`px-3 py-2 font-label-md text-label-md border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'saga'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">alt_route</span>
            <span>2. Saga Coreografada (Passo a Passo)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('patterns')}
            className={`px-3 py-2 font-label-md text-label-md border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'patterns'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            <span>3. Padrões de Resiliência (Outbox &amp; DLQ)</span>
          </button>
        </div>
      </section>

      {/* Aba 1: Topologia & Serviços */}
      {activeTab === 'topology' && (
        <section className="flex flex-col gap-space-md">
          {/* Gateway & Mensageria Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
            <div className="p-4 rounded-xl border border-surface-container-high bg-surface-container-lowest flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-label-lg text-label-lg font-bold flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-[20px]">dns</span>
                  Nginx API Gateway (:8080)
                </span>
                <span className="font-code-sm text-code-sm bg-surface-container px-2 py-0.5 rounded">
                  Reverse Proxy
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Ponto único de entrada. Faz roteamento de rotas, rate limiting por IP (`limit_req`), balanceamento com algoritmo `least_conn` e injeta o header de rastreamento `X-Correlation-ID`.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-surface-container-high bg-surface-container-lowest flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-label-lg text-label-lg font-bold flex items-center gap-1 text-amber-600">
                  <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
                  RabbitMQ Broker (:5672 / :15672)
                </span>
                <span className="font-code-sm text-code-sm bg-surface-container px-2 py-0.5 rounded">
                  Topic Exchange
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Barramento de eventos assíncronos (`ecommerce_events`). Garante entrega durável, isolamento entre domínios e desvio automático de falhas para a Dead Letter Exchange (`ecommerce_events_dlx`).
              </p>
            </div>
          </div>

          {/* Grid dos 5 Microsserviços */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-sm">
            {SERVICES_TOPOLOGY.map((srv) => (
              <article
                key={srv.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${srv.color}`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                      {srv.name}
                    </h3>
                    <span className="font-code-sm text-code-sm bg-surface-container-lowest px-2 py-0.5 rounded shadow-sm border border-surface-container">
                      :{srv.port}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-code-sm text-code-sm px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                      💾 {srv.dbType} ({srv.db})
                    </span>
                  </div>

                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {srv.role}
                  </p>
                </div>

                <div className="flex flex-col gap-2 border-t border-surface-container/60 pt-2.5">
                  <span className="font-code-sm text-code-sm font-semibold text-on-surface">
                    Principais Endpoints HTTP:
                  </span>
                  <div className="flex flex-col gap-1">
                    {srv.endpoints.map((ep) => (
                      <code
                        key={ep}
                        className="font-code-sm text-code-sm bg-surface-container-lowest px-2 py-0.5 rounded text-on-surface-variant"
                      >
                        {ep}
                      </code>
                    ))}
                  </div>

                  {(srv.events.emits.length > 0 || srv.events.consumes.length > 0) && (
                    <div className="flex flex-col gap-1 mt-1 text-[11px] font-code-sm">
                      {srv.events.emits.length > 0 && (
                        <span className="text-emerald-700">
                          ⬆ Emite: {srv.events.emits.join(', ')}
                        </span>
                      )}
                      {srv.events.consumes.length > 0 && (
                        <span className="text-blue-700">
                          ⬇ Consome: {srv.events.consumes.join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Aba 2: Saga Coreografada */}
      {activeTab === 'saga' && (
        <section className="bg-surface-container-lowest p-space-md rounded-xl border border-surface-container-high flex flex-col gap-space-md">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">
              Como Funciona a Saga Coreografada (Sem Orquestrador Central)
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Em vez de uma API central travar esperando todos os serviços responderem por HTTP síncrono, cada microsserviço reage a eventos e publica suas próprias decisões de domínio.
            </p>
          </div>

          {/* Stepper Interativo */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {SAGA_STEPS.map((s) => (
              <button
                key={s.step}
                type="button"
                onClick={() => setActiveSagaStep(s.step)}
                className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                  activeSagaStep === s.step
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-surface-container bg-surface-container-low hover:bg-surface-container'
                }`}
              >
                <span className="font-code-sm text-code-sm font-bold text-primary">
                  Passo {s.step}
                </span>
                <span className="font-label-md text-label-md font-semibold text-on-surface truncate">
                  {s.title.split('(')[0]}
                </span>
              </button>
            ))}
          </div>

          {/* Detalhe do Passo Selecionado */}
          {(() => {
            const step = SAGA_STEPS.find((s) => s.step === activeSagaStep)!;
            return (
              <div className="p-space-md rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                    {step.title}
                  </h4>
                  <span className="px-2.5 py-1 rounded-lg bg-surface-container-high font-code-sm text-code-sm font-semibold">
                    Status: {step.badge}
                  </span>
                </div>

                <p className="font-body-md text-body-md text-on-surface">
                  {step.desc}
                </p>

                <div className="flex items-center gap-2 pt-2 border-t border-surface-container flex-wrap font-code-sm text-code-sm text-on-surface-variant">
                  <span className="bg-surface-container px-2 py-0.5 rounded">
                    Origem: <strong>{step.source}</strong>
                  </span>
                  <span>➔</span>
                  <span className="bg-surface-container px-2 py-0.5 rounded">
                    Destino: <strong>{step.target}</strong>
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Diagrama de Compensação */}
          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex flex-col gap-2">
            <h4 className="font-label-lg text-label-lg font-bold text-amber-900 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[20px]">undo</span>
              E se o pagamento falhar? (Transação Compensatória)
            </h4>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Em microsserviços não existe <code>ROLLBACK</code> distribuído de banco. Por isso, quando o <code>payment-service</code> emite <code>payment_failed</code>, o <code>inventory-service</code> escuta esse evento e executa a <strong>compensação</strong> (estornando as unidades reservadas na tabela <code>inventory_items</code>), e o <code>order-service</code> marca o pedido como <code>CANCELLED</code>.
            </p>
          </div>
        </section>
      )}

      {/* Aba 3: Padrões de Resiliência */}
      {activeTab === 'patterns' && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container-high flex flex-col gap-2">
            <span className="font-label-lg text-label-lg font-bold text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[20px]">mark_email_read</span>
              1. Transactional Outbox Pattern
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Evita a perda de mensagens quando o banco grava o registro mas o RabbitMQ cai antes do envio.
            </p>
            <div className="bg-surface-container-low p-2.5 rounded-lg font-code-sm text-code-sm text-on-surface flex flex-col gap-1">
              <span>1. Grava no banco e insere evento em <code>outbox</code> na <strong>mesma transação SQL</strong>.</span>
              <span>2. Um worker ou polling em background lê a outbox e publica no RabbitMQ.</span>
              <span>3. Marca <code>published = true</code> após a confirmação.</span>
            </div>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container-high flex flex-col gap-2">
            <span className="font-label-lg text-label-lg font-bold text-emerald-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[20px]">fingerprint</span>
              2. Idempotência com <code>processed_messages</code>
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Como o RabbitMQ garante entrega <em>at least once</em>, a mesma mensagem pode chegar duas vezes em reinicializações de rede.
            </p>
            <div className="bg-surface-container-low p-2.5 rounded-lg font-code-sm text-code-sm text-on-surface flex flex-col gap-1">
              <span>1. Todo evento carrega um <code>messageId</code> único.</span>
              <span>2. O consumidor verifica na tabela <code>processed_messages</code> se o ID já existe.</span>
              <span>3. Se já foi processado, ignora a repetição e faz <code>ack</code> seguro.</span>
            </div>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container-high flex flex-col gap-2">
            <span className="font-label-lg text-label-lg font-bold text-purple-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[20px]">layers</span>
              3. Clean Architecture &amp; SOLID
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Cada microsserviço possui três camadas bem delimitadas, garantindo que o domínio nunca dependa do framework Fastify ou do ORM Prisma.
            </p>
            <div className="bg-surface-container-low p-2.5 rounded-lg font-code-sm text-code-sm text-on-surface flex flex-col gap-1">
              <span>• <strong>domain/</strong>: Entidades, DTOs e Interfaces de Repositório puras.</span>
              <span>• <strong>use-cases/</strong>: Regras de negócio independentes de IO.</span>
              <span>• <strong>infra/</strong>: Prisma, MongoDB, Controllers Fastify e Workers AMQP.</span>
            </div>
          </div>

          <div className="p-space-md rounded-xl bg-surface-container-lowest border border-surface-container-high flex flex-col gap-2">
            <span className="font-label-lg text-label-lg font-bold text-rose-700 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[20px]">crisis_alert</span>
              4. Dead Letter Queue (DLQ) &amp; Observabilidade
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Mensagens malformadas ou com erro irrecuperável nunca travam a fila principal nem causam loop infinito.
            </p>
            <div className="bg-surface-container-low p-2.5 rounded-lg font-code-sm text-code-sm text-on-surface flex flex-col gap-1">
              <span>• Configurada a exchange <code>ecommerce_events_dlx</code> em todos os workers.</span>
              <span>• Ao rejeitar com <code>nack(false, false)</code>, a mensagem vai para a fila <code>*_dlq</code>.</span>
              <span>• O cabeçalho <code>X-Correlation-ID</code> correlaciona todo o rastreamento ponta a ponta.</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
