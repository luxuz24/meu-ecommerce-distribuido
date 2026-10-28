# Graph Report - ecommerce_micro  (2026-10-28)

## Corpus Check
- 95 files · ~27,231 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 28 file(s) not represented in the graph (top: (none) 18, .example 6, .css 1)

## Summary
- 862 nodes · 1449 edges · 58 communities (48 shown, 10 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5c4d88f0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- User
- CreateProductUseCase.test.ts
- CatalogPage.tsx
- user-service/src/infra/container.ts
- catalog-service/package.json
- user-outbox-processor/package.json
- steps
- frontend/package.json
- notification-service/package.json
- 3. Segurança (obrigatório)
- compilerOptions
- scripts
- compilerOptions
- devDependencies
- compilerOptions
- postgres
- Meu E-Commerce Distribuído 🛒⚡
- dependencies
- compilerOptions
- compilerOptions
- mongodb
- rabbitmq
- services
- User.ts
- 03 — Convenções e Regras para Agentes
- 07 — Orquestração de Agentes por Tarefa
- 3. Regras Obrigatórias (SOLID, Clean Architecture e Segurança)
- 3. Regras Obrigatórias do `agent-frontend`
- user-service/package.json
- api-gateway
- notification-service
- ITokenService
- context
- catalog-service
- frontend
- 01 — Visão e Arquitetura
- user-service
- 05 — Plano do Frontend
- 04 — Contratos de API e Eventos
- Agente Especialista: Backend & Arquitetura Limpa (`agent-backend`)
- Agente Especialista: Grafo de Conhecimento & Obsidian (`agent-graph`)
- scripts
- Docs — Guia para Agentes de Desenvolvimento
- init-databases.sh
- IUserRepository
- prisma.ts
- user-service/src/infra/container.ts
- 20260722053928_setup_user_and_outbox_schema/migration.sql
- dotenv@^17.4.2
- vitest@^5.0.5
- LoginUseCase.test.ts

## God Nodes (most connected - your core abstractions)
1. `Product` - 26 edges
2. `User` - 25 edges
3. `IProductRepository` - 22 edges
4. `IUserRepository` - 22 edges
5. `compilerOptions` - 18 edges
6. `scripts` - 17 edges
7. `IPasswordHasher` - 17 edges
8. `DevOnly()` - 16 edges
9. `compilerOptions` - 16 edges
10. `compilerOptions` - 14 edges

## Surprising Connections (you probably didn't know these)
- `2. Estratégia de Testes do Monorepo` --references--> `ApiError`  [INFERRED]
  docs/agents/agent-qa-tests.md → frontend/src/services/api.ts
- `Estado real da Clean Architecture` --references--> `IProductRepository`  [INFERRED]
  docs/01-visao-e-arquitetura.md → services/catalog-service/src/domain/repositories/IProductRepository.ts
- `Estado real da Clean Architecture` --references--> `MongoProductRepository`  [INFERRED]
  docs/01-visao-e-arquitetura.md → services/catalog-service/src/infra/database/repositories/MongoProductRepository.ts
- `2. SOLID aplicado ao projeto` --references--> `MongoProductRepository`  [INFERRED]
  docs/06-fluxo-solid-e-seguranca.md → services/catalog-service/src/infra/database/repositories/MongoProductRepository.ts
- `Fase 2 — Catalog completo` --references--> `requireAdminAuth()`  [INFERRED]
  docs/02-planejamento-roadmap.md → services/catalog-service/src/infra/http/middlewares/AuthMiddleware.ts

## Import Cycles
- None detected.

## Communities (58 total, 10 thin omitted)

### Community 0 - "User"
Cohesion: 0.18
Nodes (7): User, CreateOutboxData, CreateUserData, PrismaUserRepository, InMemoryUserRepository, InMemoryUserRepository, InMemoryUserRepository

### Community 1 - "CreateProductUseCase.test.ts"
Cohesion: 0.07
Nodes (28): Product, ProductProps, InvalidProductDataError, ProductAlreadyExistsError, ProductNotFoundError, CreateProductDTO, IProductRepository, ListProductsParams (+20 more)

### Community 2 - "CatalogPage.tsx"
Cohesion: 0.14
Nodes (39): App(), AppLayout(), DevOnly(), EndpointBar(), JsonInspectorDrawer(), AuthContext, AuthContextValue, AuthProvider() (+31 more)

### Community 3 - "user-service/src/infra/container.ts"
Cohesion: 0.06
Nodes (31): 02 — Planejamento e Roadmap, A. O que já foi feito, B. O que falta (por fase), C. Ordem sugerida de execução, catalog-service (MongoDB), D. Definition of Done (qualquer tarefa), Fase 0.5 — Segurança e entrada (ver `06-fluxo-solid-e-seguranca.md`), Fase 0 — Higiene e fundação (fazer primeiro) (+23 more)

### Community 4 - "catalog-service/package.json"
Cohesion: 0.07
Nodes (39): mongoose, author, dependencies, dotenv@^17.4.2, fastify@^5.10.0, @fastify/cors@^11.3.1, @fastify/helmet@^13.2.0, @fastify/rate-limit@^11.2.1 (+31 more)

### Community 5 - "user-outbox-processor/package.json"
Cohesion: 0.07
Nodes (33): author, dependencies, amqplib@^2.0.1, dotenv@^17.4.2, pg@^8.22.0, description, devDependencies, tsx@^4.23.1 (+25 more)

### Community 6 - "steps"
Cohesion: 0.08
Nodes (32): name, runs-on, steps, name, runs-on, steps, jobs, docker-build (+24 more)

### Community 7 - "frontend/package.json"
Cohesion: 0.07
Nodes (34): dependencies, react@^19.0.0, react-dom@^19.0.0, react-router-dom@^7.1.5, devDependencies, autoprefixer@^10.4.20, postcss@^8.5.1, tailwindcss@^3.4.17 (+26 more)

### Community 8 - "notification-service/package.json"
Cohesion: 0.08
Nodes (29): author, dependencies, amqplib@^2.0.1, dotenv@^17.4.2, description, devDependencies, tsx@^4.23.1, @types/amqplib@^0.10.8 (+21 more)

### Community 9 - "3. Segurança (obrigatório)"
Cohesion: 0.10
Nodes (20): 06 — Fluxo de Trabalho, SOLID e Segurança para Agentes, 1. Fluxo de trabalho (obrigatório), 3.10 Mensageria, 3.11 Observabilidade e auditoria, 3.1 Prevenção de SQL/NoSQL Injection, 3.2 Validação e sanitização de entrada, 3.3 CORS (`@fastify/cors`), 3.4 Rate limit (`@fastify/rate-limit`) (+12 more)

### Community 10 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, declaration, declarationMap, exactOptionalPropertyTypes, isolatedModules, jsx, module, moduleDetection (+11 more)

### Community 11 - "scripts"
Cohesion: 0.09
Nodes (21): description, name, private, scripts, build, build:catalog, build:frontend, build:notification (+13 more)

### Community 12 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+9 more)

### Community 13 - "devDependencies"
Cohesion: 0.12
Nodes (17): prisma, @types/bcrypt, devDependencies, prisma@^7.9.0, tsx@^4.23.1, @types/amqplib@^0.10.8, @types/bcrypt@^6.0.0, @types/jsonwebtoken@^9.0.10 (+9 more)

### Community 14 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, exactOptionalPropertyTypes, isolatedModules, module, moduleDetection, noUncheckedIndexedAccess, outDir, rootDir (+8 more)

### Community 15 - "postgres"
Cohesion: 0.12
Nodes (16): POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, interval, retries, test, timeout, container_name (+8 more)

### Community 16 - "Meu E-Commerce Distribuído 🛒⚡"
Cohesion: 0.13
Nodes (14): 1. Health Checks, 1. Subir tudo com Docker Compose (Recomendado), 2. Criar Usuário (Dispara Outbox + RabbitMQ + Notificação), 2. Rodar Serviços Localmente (Modo Desenvolvimento), 3. Login e Obtenção do Token JWT, 4. Consultar Perfil Autenticado (`/users/me`), 5. Cadastrar Produto no Catálogo (MongoDB), 📊 Acesso aos Painéis Administrativos (+6 more)

### Community 17 - "dependencies"
Cohesion: 0.13
Nodes (15): @fastify/jwt, dependencies, amqplib@^2.0.1, fastify@^5.10.0, @fastify/cors@^11.3.1, @fastify/helmet@^13.2.0, @fastify/jwt@^10.2.0, jsonwebtoken@^9.0.3 (+7 more)

### Community 18 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, module, moduleResolution, outDir, rootDir (+6 more)

### Community 19 - "compilerOptions"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, rootDir, skipLibCheck (+4 more)

### Community 20 - "mongodb"
Cohesion: 0.20
Nodes (10): MONGO_INITDB_ROOT_PASSWORD, MONGO_INITDB_ROOT_USERNAME, container_name, environment, image, networks, ports, restart (+2 more)

### Community 21 - "rabbitmq"
Cohesion: 0.20
Nodes (10): RABBITMQ_DEFAULT_PASS, RABBITMQ_DEFAULT_USER, container_name, environment, image, networks, ports, restart (+2 more)

### Community 22 - "services"
Cohesion: 0.22
Nodes (8): driver, networks, ecom_network, services, volumes, mongo_data, pg_data, rabbitmq_data

### Community 23 - "User.ts"
Cohesion: 0.29
Nodes (6): UserProps, UserRole, UserNotFoundError, GetUserProfileUseCase, UserProfileResponse, LoginUserResponse

### Community 25 - "03 — Convenções e Regras para Agentes"
Cohesion: 0.22
Nodes (8): 03 — Convenções e Regras para Agentes, Docker / Ambiente, Estrutura de pastas por serviço, Git, Mensageria, Não fazer, Testes, TypeScript / Node

### Community 26 - "07 — Orquestração de Agentes por Tarefa"
Cohesion: 0.22
Nodes (9): 07 — Orquestração de Agentes por Tarefa, 1. Os 5 Agentes Especialistas, 2. Fluxo de Orquestração por Tarefa (Pipeline de 7 Etapas), 3. Matriz de Orquestração pelas Próximas Tarefas do Roadmap, 4. Protocolo de Handoff entre Agentes, Tarefa A — Fase 4.1: Microsserviço de Estoque (`inventory-service` + `inventory_db`), Tarefa B — Fase 4.2: Microsserviço de Pedidos (`order-service` + `order_db`), Tarefa C — Fase 4.3: Microsserviço de Pagamento (`payment-service` + `payment_db`) (+1 more)

### Community 27 - "3. Regras Obrigatórias (SOLID, Clean Architecture e Segurança)"
Cohesion: 0.22
Nodes (9): 1. Missão e Escopo, 2. Mapa de Bancos de Dados do Ecossistema, 3.1. Inversão de Dependência (DIP), 3.2. Prevenção contra SQL Injection e NoSQL Injection, 3.3. Transactional Outbox Pattern, 3.4. Idempotência de Consumidores (`processed_messages`), 3. Regras Obrigatórias (SOLID, Clean Architecture e Segurança), 4. Checklist de Entrega do `agent-database` (+1 more)

### Community 28 - "3. Regras Obrigatórias do `agent-frontend`"
Cohesion: 0.22
Nodes (9): 1. Missão e Escopo, 2. Arquitetura do Frontend (`frontend/src/`), 3.1. Isolamento Estrito: Modo Dev Telemetry (`<DevOnly>`) vs. Modo Loja Limpa, 3.2. Pasta `Front_referencias` Não Versionada, 3.3. Design System (*Distributed Commerce Minimalist*), 3.4. Segurança e Contratos de API, 3. Regras Obrigatórias do `agent-frontend`, 4. Checklist de Entrega do `agent-frontend` (+1 more)

### Community 29 - "user-service/package.json"
Cohesion: 0.18
Nodes (10): author, @fastify/rate-limit@^11.2.1, description, @fastify/rate-limit, keywords, license, main, name (+2 more)

### Community 30 - "api-gateway"
Cohesion: 0.25
Nodes (8): container_name, depends_on, image, networks, ports, restart, volumes, api-gateway

### Community 31 - "notification-service"
Cohesion: 0.25
Nodes (8): rabbitmq, container_name, depends_on, environment, networks, restart, condition, notification-service

### Community 32 - "ITokenService"
Cohesion: 0.16
Nodes (10): 1. Missão e Escopo, 2. Estratégia de Testes do Monorepo, 3. Regras Obrigatórias para Criação de Testes, 4. Comandos de Verificação Obrigatórios antes de Abrir PR, 5. Checklist de Gate de Qualidade (Definition of Done), Agente Especialista: Testes Unitários, Automatizados & QA (`agent-qa-tests`), ITokenService, TokenPayload (+2 more)

### Community 33 - "context"
Cohesion: 0.23
Nodes (12): context, dockerfile, build, build, build, user-outbox-processor, build, container_name (+4 more)

### Community 34 - "catalog-service"
Cohesion: 0.29
Nodes (7): container_name, depends_on, environment, networks, ports, restart, catalog-service

### Community 35 - "frontend"
Cohesion: 0.29
Nodes (7): container_name, depends_on, environment, networks, ports, restart, frontend

### Community 36 - "01 — Visão e Arquitetura"
Cohesion: 0.29
Nodes (6): 01 — Visão e Arquitetura, Débitos técnicos conhecidos, Fluxo implementado (Outbox), Infraestrutura (docker-compose), Mapa do repositório, O que é

### Community 37 - "user-service"
Cohesion: 0.20
Nodes (10): postgres, condition, user-service, depends_on, container_name, depends_on, environment, networks (+2 more)

### Community 38 - "05 — Plano do Frontend"
Cohesion: 0.33
Nodes (6): 05 — Plano do Frontend, Diretriz de Telemetria de Desenvolvimento vs. Produção Limpa, Fases do frontend, Objetivo, Regras, Stack implementada

### Community 39 - "04 — Contratos de API e Eventos"
Cohesion: 0.40
Nodes (5): 04 — Contratos de API e Eventos, catalog-service — `http://localhost:3001` (prefixo `/api`, ou via Gateway `http://localhost:8080/api`), Eventos (RabbitMQ — exchange `ecommerce_events`, topic), order / payment / inventory 🕓, user-service — `http://localhost:3000` (ou via Gateway `http://localhost:8080`)

### Community 40 - "Agente Especialista: Backend & Arquitetura Limpa (`agent-backend`)"
Cohesion: 0.40
Nodes (5): 1. Missão e Escopo, 2. Estrutura Obrigatória de Cada Microsserviço, 3. Regras Obrigatórias (SOLID & Segurança), 4. Checklist de Entrega do `agent-backend`, Agente Especialista: Backend & Arquitetura Limpa (`agent-backend`)

### Community 41 - "Agente Especialista: Grafo de Conhecimento & Obsidian (`agent-graph`)"
Cohesion: 0.22
Nodes (9): 1. Missão e Escopo, 2. Arquitetura do Grafo e do Vault Obsidian no Projeto, 3.1 Atualização Completa do Grafo + Vault Obsidian + HTML, 3.2 Consultas de Impacto Arquitetural (Pré-Tarefa e Code Review), 3.3 Hooks Automáticos do Git, 3. Ferramentas e Comandos do `agent-graph`, 4. Regras Obrigatórias do `agent-graph`, 5. Checklist de Entrega do `agent-graph` (em toda Task/PR) (+1 more)

### Community 42 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, start, test

### Community 43 - "Docs — Guia para Agentes de Desenvolvimento"
Cohesion: 0.50
Nodes (4): Comandos rápidos, Docs — Guia para Agentes de Desenvolvimento, Perfis dos 5 Agentes Especialistas (`docs/agents/`), Regras de manutenção

### Community 46 - "IUserRepository"
Cohesion: 0.16
Nodes (5): Estado real da Clean Architecture, Clean Architecture (obrigatório em código novo/refatorado), 2. SOLID aplicado ao projeto, IUserRepository, CreateUserUseCase

### Community 47 - "prisma.ts"
Cohesion: 0.25
Nodes (7): @prisma/adapter-pg, @prisma/client, @prisma/adapter-pg@^7.9.0, @prisma/client@^7.9.0, adapter, pool, prisma

### Community 48 - "user-service/src/infra/container.ts"
Cohesion: 0.21
Nodes (9): UserAlreadyExistsError, createUserUseCase, getUserProfileUseCase, loginUserUseCase, passwordHasher, tokenService, userRepository, authMiddleware() (+1 more)

### Community 50 - "20260722053928_setup_user_and_outbox_schema/migration.sql"
Cohesion: 0.67
Nodes (3): "outbox", "users", users_email_key

### Community 55 - "LoginUseCase.test.ts"
Cohesion: 0.13
Nodes (10): Fase 1 — Clean Architecture no user-service, bcrypt, bcrypt@^6.0.0, InvalidCredentialsError, IPasswordHasher, BcryptPasswordHasher, FakePasswordHasher, LoginUserDTO (+2 more)

## Knowledge Gaps
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `2. SOLID aplicado ao projeto` connect `IUserRepository` to `3. Segurança (obrigatório)`, `CreateProductUseCase.test.ts`, `LoginUseCase.test.ts`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `IUserRepository` (e.g. with `Estado real da Clean Architecture` and `Fase 1 — Clean Architecture no user-service`) actually correct?**
  _`IUserRepository` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Should `CreateProductUseCase.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07136404697380307 - nodes in this community are weakly interconnected._
- **Why does `mongoose` connect `catalog-service/package.json` to `CreateProductUseCase.test.ts`, `user-service/src/infra/container.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Should `CatalogPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1393939393939394 - nodes in this community are weakly interconnected._
- **Why does `2. Estratégia de Testes do Monorepo` connect `ITokenService` to `CreateProductUseCase.test.ts`, `CatalogPage.tsx`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Should `user-service/src/infra/container.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05550416281221091 - nodes in this community are weakly interconnected._