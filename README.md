# MicroStore — Living Architecture & Showcase de Microsserviços 🛒⚡

> Uma plataforma distribuída completa de e-commerce construída como um **caso de uso educacional e interativo** de como arquiteturas orientadas a eventos (EDA) e microsserviços modernos funcionam na prática.

---

## 🧭 O que este projeto demonstra?

Diferente de um monólito tradicional, este sistema divide responsabilidades em **5 microsserviços autônomos**, cada um com seu banco de dados isolado (*Database per Service*), comunicação síncrona via **API Gateway Nginx** e orquestração assíncrona orientada a eventos usando **RabbitMQ**, **Saga Coreografada** e **Transactional Outbox Pattern**.

Além da loja virtual completa no Frontend, a aplicação conta com o painel interativo **`/architecture` (Arquitetura Viva)** que explica visualmente cada decisão arquitetural, fluxo de compensação e padrão de resiliência.

---

## 🏛️ Topologia do Ecossistema Distribuído

```
                                [ CLIENTE / BROWSER ]
                                          │
                 ┌────────────────────────┴────────────────────────┐
                 │                                                 │
        (Porta :3002)                                     (Porta :8080)
┌──────────────────────────────┐                ┌───────────────────────────────────┐
│     MicroStore Frontend      │                │         Nginx API Gateway         │
│   (React 19 + TypeScript)    │                │  (Reverse Proxy / Rate Limiting)  │
└──────────────────────────────┘                └─────────────────┬─────────────────┘
                                                                  │
       ┌──────────────────────────┬───────────────────────────────┼──────────────────────────────┬──────────────────────────┐
       │                          │                               │                              │                          │
       ▼                          ▼                               ▼                              ▼                          ▼
┌──────────────┐          ┌──────────────┐                ┌──────────────┐               ┌──────────────┐           ┌──────────────┐
│ User Service │          │Catalog Service│               │Inventory Srv │               │ Order Service│           │Payment Service│
│ (Porta 3000) │          │ (Porta 3001) │                │ (Porta 3003) │               │ (Porta 3004) │           │ (Porta 3005) │
└──────┬───────┘          └──────┬───────┘                └──────┬───────┘               └──────┬───────┘           └──────┬───────┘
       │                         │                               │                              │                          │
       ▼                         ▼                               ▼                              ▼                          ▼
 💾 PostgreSQL              💾 MongoDB                     💾 PostgreSQL                  💾 PostgreSQL              💾 PostgreSQL
   (user_db)               (catalog_db)                   (inventory_db)                    (order_db)                (payment_db)
       │                                                         │                              │                          │
       │ (Outbox Table)                                          │ (Transactional Events)       │ (Saga Events)            │ (Outbox Table)
       ▼                                                         ▼                              ▼                          ▼
┌──────────────┐                                         ┌────────────────────────────────────────────────────────────────────────┐
│Outbox Worker │                                         │                     RabbitMQ Topic Exchange                            │
└──────┬───────┘                                         │                       ('ecommerce_events')                             │
       │                                                 └──────────────────────────────────┬─────────────────────────────────────┘
       └────────────────────────────────────────────────────────────────────────────────────┘
                                                                  │
                                                                  ▼
                                                 ┌──────────────────────────────────┐
                                                 │       Notification Service       │
                                                 │   (Simula e-mails + DLQ Ativa)   │
                                                 └──────────────────────────────────┘
```

---

## 🧩 Os 5 Microsserviços e suas Responsabilidades

| Microsserviço | Porta | Banco de Dados | Responsabilidade Principal | Padrões Aplicados |
|---|---|---|---|---|
| **User Service** | `:3000` | PostgreSQL (`user_db`) | Cadastro de usuários, hash bcrypt, login com emissão de token JWT (`HS256`) e papéis RBAC (`CUSTOMER` / `ADMIN`). | Transactional Outbox, Clean Architecture |
| **Catalog Service** | `:3001` | MongoDB (`catalog_db`) | Vitrine de produtos NoSQL, busca textual indexada, paginação, sanitização contra injection e CRUD admin. | Clean Architecture, Mongoose Sanitization |
| **Inventory Service** | `:3003` | PostgreSQL (`inventory_db`) | Reserva atômica de estoque por SKU, controle de itens reservados e estorno compensatório. | Saga Participant, Tabela de Idempotência |
| **Order Service** | `:3004` | PostgreSQL (`order_db`) | Orquestração do ciclo de vida do pedido (`PENDING` → `STOCK_RESERVED` → `PAID` / `CANCELLED`), anti-IDOR. | Saga Coordinator, Outbox Pattern |
| **Payment Service** | `:3005` | PostgreSQL (`payment_db`) | Regras antifraude, persistência idempotente e aprovação/recusa simulada para a Saga. | Saga Participant, Anti-fraud Rule |

---

## ⚡ Como Funciona a Saga Coreografada (Passo a Passo)

Em vez de chamadas HTTP bloqueantes em cadeia, a compra funciona via **Coreografia de Eventos no RabbitMQ**:

1. **Pedido Criado (`order_created`)**:
   - O `order-service` recebe a requisição, calcula os totais no servidor, salva o pedido como `PENDING` e insere o evento na tabela `outbox` na mesma transação SQL.
2. **Reserva de Estoque (`stock_reserved` ou `stock_rejected`)**:
   - O `inventory-service` consome o evento. Se houver saldo para todos os itens, reserva as unidades e publica `stock_reserved`. Se não houver saldo, publica `stock_rejected` (cancelando o pedido).
3. **Processamento de Pagamento (`payment_approved` ou `payment_failed`)**:
   - O `payment-service` escuta `stock_reserved`. Se o valor for elegível, aprova e publica `payment_approved`. Caso contrário, publica `payment_failed`.
4. **Fechamento ou Compensação**:
   - **Cenário de Sucesso**: O `order-service` muda o status para `PAID` e o `notification-service` dispara o e-mail de confirmação.
   - **Cenário de Falha (Compensação)**: O `order-service` muda o pedido para `CANCELLED`, e o `inventory-service` **estorna automaticamente o estoque reservado**.

---

## 🛡️ Padrões de Resiliência & Observabilidade

- **Transactional Outbox Pattern**: Garante entrega de eventos sem travar a escrita no banco de dados.
- **Idempotência**: Todos os consumidores de eventos possuem a tabela `processed_messages` para evitar efeitos colaterais caso uma mensagem seja reenviada (*at-least-once delivery*).
- **Dead Letter Exchange (DLQ)**: Mensagens malformadas ou com erro irrecuperável são enviadas para `ecommerce_events_dlx` e retidas nas filas `*_dlq`.
- **Containers Non-Root**: Todos os containers rodam sob o usuário sem privilégios `node:node` para conformidade com AppArmor e hardening Linux.
- **Rastreabilidade Distribuída**: Header `X-Correlation-ID` gerado no Nginx Gateway e propagado através de todos os serviços.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- **Docker** e **Docker Compose** instalados.
- **Node.js 24+** (caso queira rodar scripts ou testes locais).

### 1. Clonar e Iniciar Tudo
```bash
# 1. Clone o repositório
git clone https://github.com/luxuz24/meu-ecommerce-distribuido.git
cd meu-ecommerce-distribuido

# 2. Copie o arquivo de variáveis de ambiente
cp .env.example .env

# 3. Suba todo o ecossistema (5 microsserviços + Gateway + 3 Bancos + Frontend)
docker compose up -d --build
```

### 2. Popular o Banco com Dados de Demonstração
Em outro terminal, execute o seed automático:
```bash
npm run seed:demo
```
> Isso criará imediatamente:
> - **Admin**: `admin@microstore.com` (Senha: `AdminPassword123!`)
> - **Cliente**: `cliente@microstore.com` (Senha: `ClientePassword123!`)
> - 5 produtos completos com estoque sincronizado no `catalog-service` e `inventory-service`.

---

## 🖥️ Portas e Painéis Disponíveis

| Serviço / Painel | URL | Descrição |
|---|---|---|
| **Frontend Loja Virtual** | [http://localhost:3002](http://localhost:3002) | Vitrine, Carrinho, Meus Pedidos e modo Dev/Limpo |
| **Living Architecture Showcase** | [http://localhost:3002/architecture](http://localhost:3002/architecture) | Laboratório interativo explicativo da arquitetura |
| **API Gateway Nginx** | [http://localhost:8080](http://localhost:8080) | Ponto único de entrada com rate limit e proxy |
| **RabbitMQ Management** | [http://localhost:15672](http://localhost:15672) | Fila de eventos (Login: `guest` / `guest`) |
| **Grafo Interativo (HTML)** | `graphify-out/graph.html` | Grafo de conhecimento de código estático (abra no navegador) |
| **Obsidian Knowledge Vault** | `docs/obsidian/` | Pasta pronta para abrir como cofre no aplicativo Obsidian |

---

## 🧪 Testes e Qualidade

O projeto conta com **44 testes unitários automatizados** em Vitest com Fakes In-Memory e validação no CI GitHub Actions:

```bash
# Rodar todos os testes do monorepo
npm test

# Atualizar o grafo de conhecimento após alterações
npm run graph:update
```

---

## 👥 Orquestração Multi-Agente

O desenvolvimento deste ecossistema segue o protocolo documentado em [`docs/07-orquestracao-de-agentes.md`](./docs/07-orquestracao-de-agentes.md), distribuído entre 5 agentes especialistas:
1. `agent-database`: Modelagem Prisma/Mongoose, outbox e migrações.
2. `agent-backend`: Clean Architecture, use cases puros e consumidores RabbitMQ.
3. `agent-frontend`: UI React 19, telemetria isolada em `<DevOnly>` e visual minimalista.
4. `agent-qa-tests`: Testes unitários com Fakes e validação da pipeline CI.
5. `agent-graph`: Manutenção do Grafo de Conhecimento e Vault Obsidian.
