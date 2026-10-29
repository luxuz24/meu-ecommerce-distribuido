# MicroStore — estudo de caso de microsserviços orientados a eventos

[English](./README.md) | **Português**

[![CI](https://github.com/luxuz24/meu-ecommerce-distribuido/actions/workflows/ci.yml/badge.svg)](https://github.com/luxuz24/meu-ecommerce-distribuido/actions/workflows/ci.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)](./LICENSE)

![Node.js](https://img.shields.io/badge/Node.js_24-5FA04E?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-000000?logo=fastify&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?logo=rabbitmq&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-009639?logo=nginx&logoColor=white)
![Docker](https://img.shields.io/badge/Docker_Compose-2496ED?logo=docker&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?logo=githubactions&logoColor=white)

Um e-commerce dividido em **cinco microsserviços com banco próprio**, que fecham uma compra
por uma **Saga coreografada** sobre RabbitMQ — sem chamadas HTTP em cadeia e sem transação
distribuída.

O objetivo é mostrar, rodando e testado, como resolver os problemas que aparecem quando um
monólito vira um sistema distribuído:

- gravar no banco **e** publicar um evento sem perder nenhum dos dois;
- lidar com mensagens duplicadas;
- desfazer uma reserva quando o pagamento falha, ou quando uma etapa nunca responde;
- impedir que dois pedidos simultâneos vendam a mesma unidade;
- seguir uma única compra através de quatro serviços.

Cada garantia é coberta por um teste ponta a ponta ou de caos que roda no CI contra a stack
real. Os defeitos encontrados no caminho estão em
[Engineering notes](./docs/engineering-notes.md) (em inglês).

---

## Arquitetura

```mermaid
flowchart LR
    B[Browser] --> F[Frontend :3002]
    B -->|toda a API| G[Nginx API Gateway :8080]
    G --> U[user-service] & C[catalog-service] & I[inventory-service] & O[order-service] & P[payment-service]
    O -->|preço / SKU| C
    U --- UDB[(user_db)]
    C --- CDB[(catalog_db · Mongo)]
    I --- IDB[(inventory_db)]
    O --- ODB[(order_db)]
    P --- PDB[(payment_db)]
    UDB -.outbox.-> UOP[user-outbox-processor]
    UOP & I & O & P <-->|ecommerce_events| R{{RabbitMQ}}
    R --> N[notification-service]
```

| Serviço | Banco | Responsabilidade | Papel na Saga |
|---|---|---|---|
| **user-service** | PostgreSQL `user_db` | Cadastro, login JWT (HS256), RBAC `CUSTOMER` / `ADMIN` | — |
| **catalog-service** | MongoDB `catalog_db` | Vitrine, busca textual, CRUD admin | Fonte de verdade do preço |
| **order-service** | PostgreSQL `order_db` | Ciclo de vida do pedido `PENDING → STOCK_RESERVED → PAID / CANCELLED` | Inicia a Saga e aplica o desfecho |
| **inventory-service** | PostgreSQL `inventory_db` | Reserva atômica, estorno, baixa definitiva, expiração | Participante + compensação |
| **payment-service** | PostgreSQL `payment_db` | Cobrança simulada com regra antifraude | Participante |
| **notification-service** | — | Consome eventos e simula e-mails | Observador |

Somente o **gateway (`:8080`)** e o **frontend (`:3002`)** são expostos no host. Os serviços
só são alcançáveis pela rede interna, então rate limit, roteamento e rastreabilidade não
podem ser contornados.

## A Saga de checkout

1. **`order-service`** recebe `{productId, quantity}`, busca preço, nome e SKU no catálogo e
   grava o pedido `PENDING` e o evento `ORDER_CREATED` na **outbox**, na mesma transação.
2. **`inventory-service`** reserva o estoque com um `UPDATE` condicional e publica
   `STOCK_RESERVED`. Se faltar saldo, publica `STOCK_REJECTED` e o pedido é cancelado sem
   cobrança.
3. **`payment-service`** cobra o total calculado pelo servidor e publica `PAYMENT_APPROVED`
   ou `PAYMENT_FAILED`.
4. **Desfecho:**
   - **aprovado:** o pedido vira `PAID` e a reserva vira baixa definitiva (`ORDER_CONFIRMED`);
   - **recusado:** o pedido vira `CANCELLED` e o inventory **estorna a reserva** (compensação);
   - **sem resposta:** a reserva **expira** após `RESERVATION_TTL_SECONDS`, o estoque volta e
     o pedido é cancelado.

O diagrama de sequência completo está em [docs/01](./docs/01-visao-e-arquitetura.md#a-saga-de-checkout).

## Garantias e como são obtidas

| Problema | Solução | Prova |
|---|---|---|
| Gravar e publicar de forma atômica | **Transactional Outbox**; o relay só marca `published` após o *publisher confirm* do broker | Teste de caos (broker parado no meio do fluxo) |
| Mensagens duplicadas (*at-least-once*) | Tabela `processed_messages` + transições de estado condicionais | Unitários + E2E |
| Dois pedidos disputando o mesmo item | `UPDATE … WHERE available_qty >= qty` + `CHECK (available_qty >= 0)` | E2E: 12 pedidos simultâneos por 4 unidades → exatamente 4 pagos |
| Falha no meio da Saga | Compensação: `payment_failed` estorna a reserva | E2E |
| Etapa que nunca responde | Expiração de reservas com sweeper condicional | Teste de caos no CI |
| Confirmação perdida de pedido pago | Expiração de pedido `PAID` reemite `ORDER_CONFIRMED`; o inventory readquire o estoque | Teste de caos no CI |
| Cliente adulterando o preço | Preço resolvido no `catalog-service`; o que vem do cliente é descartado | Unitário + E2E |
| Broker fora do ar | Reconexão com backoff (1 s → 30 s), topologia redeclarada, `/health` em `503` enquanto degradado | Teste de caos |
| Mensagem envenenada | Dead Letter Exchange + uma `*_dlq` por fila | — |
| Seguir uma compra entre serviços | `X-Correlation-ID`: gateway → outbox → propriedade AMQP → `AsyncLocalStorage` | E2E + `grep` nos logs |
| Escalada de privilégio | Cadastro público sempre cria `CUSTOMER`; o ADMIN é provisionado pelo servidor | E2E |

Os trade-offs (coreografia × orquestração, outbox por polling × CDC, entre outros) e as
limitações conhecidas estão em [docs/01](./docs/01-visao-e-arquitetura.md#decisões-arquiteturais-adrs-resumidos).

---

## Rodando localmente

Pré-requisitos: **Docker** com Compose v2 e **Node.js 24+** (para os scripts de seed e testes).

```bash
git clone https://github.com/luxuz24/meu-ecommerce-distribuido.git
cd meu-ecommerce-distribuido
cp .env.example .env

docker compose up -d --build --wait   # sobe 12 containers e espera todos os healthchecks
npm run seed:demo                     # admin, cliente e 5 produtos com estoque
```

| | URL | Credenciais |
|---|---|---|
| Loja | http://localhost:3002 | `cliente@microstore.com` / `ClientePassword123!` |
| Painel admin | http://localhost:3002/admin/products | `admin@microstore.com` / `AdminPassword123!` |
| Página de arquitetura interativa | http://localhost:3002/architecture | — |
| API Gateway | http://localhost:8080 | — |
| RabbitMQ Management | http://localhost:15672 | `guest` / `guest` |

## Roteiro de demonstração

**1. Compra feliz.** Adicione um produto ao carrinho e finalize. O pedido nasce `PENDING` e a
tela acompanha sozinha até `PAID`, em cerca de 3 segundos.

**2. Compensação.** Finalize outra compra marcando **"Simular Falha de Pagamento"**. O pedido
termina `CANCELLED` e o estoque volta ao valor original.

**3. Rastreabilidade.** Cada resposta traz um `X-Correlation-ID`, exibido no inspetor de
telemetria do modo Dev. Com ele você segue a compra entre os serviços:

```bash
docker compose logs -t | grep <correlation-id>
```

```
order-service         POST /api/orders
inventory-service     [inventory-service] cid=… <- order_created
payment-service       [payment-service]   cid=… <- stock_reserved
order-service         [order-service]     cid=… <- payment_failed
inventory-service     [inventory-service] cid=… <- payment_failed   (estorno)
notification-service  Correlation: cid=…
```

**4. Caos: derrube o broker no meio do fluxo.**

```bash
docker stop ecom_rabbitmq
```

Faça uma compra: ela é aceita (`201 PENDING`) e o evento fica guardado na outbox. O endpoint
`/health/order` responde `503` com `"messaging":"disconnected"`.

```bash
docker start ecom_rabbitmq
```

Em poucos segundos os cinco serviços reconectam sozinhos e o pedido criado durante a queda
conclui como `PAID`, sem perder nenhum evento.

**5. Caos: uma etapa que nunca responde.**

```bash
RESERVATION_TTL_SECONDS=15 RESERVATION_SWEEP_INTERVAL_MS=2000 docker compose up -d --wait inventory-service
npm run test:chaos
```

O primeiro script faz o banco do `payment-service` falhar para que a mensagem de pagamento vá
para a DLQ: a reserva expira, o estoque volta e o pedido termina `CANCELLED (RESERVATION_EXPIRED)`.
O segundo simula um pedido pago cuja confirmação se perdeu: a reserva expira, mas o pedido
continua `PAID` e as unidades continuam vendidas.

---

## Qualidade

```bash
npm run lint        # ESLint + typescript-eslint em serviços, frontend e scripts
npm test            # 61 testes unitários (Vitest, fakes in-memory) em serviços + frontend
npm run test:e2e    # 9 cenários ponta a ponta contra a stack em execução
npm run test:chaos  # dois testes de caos: reserva presa e confirmação perdida (requer TTL curto)
```

Os cenários E2E ([`scripts/e2e-saga.ts`](./scripts/e2e-saga.ts)) passam só pelo gateway e
criam os próprios dados, então podem rodar repetidamente:

| Cenário | Verifica |
|---|---|
| Caminho feliz | `PAID`, valor cobrado = total do servidor, reserva convertida em baixa |
| Compensação | Pagamento recusado → `CANCELLED` e estoque integralmente estornado |
| Falta de estoque | `STOCK_REJECTED` → `CANCELLED`, nenhuma cobrança criada |
| Antifraude | Compra acima de R$ 50.000 recusada |
| Integridade de preço | Preço, nome e SKU enviados pelo cliente são ignorados |
| Concorrência | 12 pedidos simultâneos por 4 unidades → exatamente 4 pagos, estoque final 0 |
| SKU duplicado | 8 cadastros simultâneos do mesmo produto → 1 criado, 7 `409 Conflict` |
| Rastreabilidade | `X-Correlation-ID` do cliente preservado pelo gateway |
| Segurança | Cadastro com `role: ADMIN` vira `CUSTOMER`; cliente não força a Saga nem chama endpoints internos |

O **CI** (GitHub Actions) roda em cada pull request:
1. lint;
2. build, testes unitários e `npm audit` (alta/crítica reprova o build) de cada serviço e do frontend;
3. a stack completa do zero, seguida do seed, da suíte E2E e do teste de caos, anexando os
   logs dos containers em caso de falha.

## Documentação

| Documento | Conteúdo |
|---|---|
| [Engineering notes](./docs/engineering-notes.md) | Defeitos encontrados, como foram reproduzidos, corrigidos e provados (em inglês) |
| [Visão e Arquitetura](./docs/01-visao-e-arquitetura.md) | Sequência da Saga, garantias, ADRs, limitações |
| [Contratos de API e Eventos](./docs/04-contratos-api-e-eventos.md) | Endpoints, autorização, eventos e payloads |
| [Convenções de Código](./docs/03-convencoes-de-codigo.md) | Clean Architecture e padrões do monorepo |
| [Fluxo, SOLID e Segurança](./docs/06-fluxo-solid-e-seguranca.md) | Processo de PR, gates do CI e checklist de segurança |

## Licença

MIT — veja [`LICENSE`](./LICENSE).
