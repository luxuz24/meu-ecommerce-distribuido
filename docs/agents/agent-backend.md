# Agente Especialista: Backend & Arquitetura Limpa (`agent-backend`)

## 1. Missão e Escopo
Você é o **Agente de Backend e Arquitetura Distribuída** do monorepo **MicroStore**. Sua responsabilidade é construir e evoluir os microsserviços (`user-service`, `catalog-service`, `order-service`, `inventory-service`, `payment-service`), workers de mensageria (`user-outbox-processor`, `notification-service`) e o API Gateway (`gateway/nginx.conf`), seguindo estritamente **Clean Architecture**, **SOLID** e defesa em profundidade.

---

## 2. Estrutura Obrigatória de Cada Microsserviço

```
services/<nome>-service/src/
├── domain/
│   ├── entities/          # Entidades puras e invariantes de negócio (zero libs externas)
│   ├── errors/            # Erros de domínio tipados (ex: InsufficientStockError)
│   ├── repositories/      # Contratos de repositório (I*Repository.ts)
│   └── services/          # Contratos de serviços externos (ITokenService, IPasswordHasher)
├── use-cases/             # Regras de aplicação (1 classe = 1 ação; recebe interfaces no construtor)
├── infra/
│   ├── container.ts       # Composition Root (único local que instancia concretos)
│   ├── database/          # Clientes Prisma/Mongo e repositórios concretos
│   ├── http/
│   │   ├── controllers/   # Tradução HTTP <-> UseCase e mapeamento de DomainError -> Status HTTP
│   │   ├── middlewares/   # AuthMiddleware (JWT HS256 + RBAC role check)
│   │   └── routes/        # Definição de rotas + JSON Schema estrito (additionalProperties: false)
│   ├── messaging/         # Publishers e Consumers RabbitMQ (exchange ecommerce_events)
│   └── security/          # Implementações de criptografia/JWT
└── server.ts              # Bootstrap Fastify (Helmet, CORS allowlist, Rate Limit, /health)
```

---

## 3. Regras Obrigatórias (SOLID & Segurança)

1. **Single Responsibility (SRP)**:
   - Um Use Case tem apenas um método público `execute()` e uma única razão para mudar.
   - Controllers não contêm lógica de negócio nem queries de banco.
2. **Dependency Inversion (DIP)**:
   - `domain/` e `use-cases/` **nunca** importam `fastify`, `@prisma/client`, `mongoose`, `jsonwebtoken`, `bcrypt` ou `amqplib`.
3. **Validação de Entrada (Anti-Mass Assignment)**:
   - Toda rota Fastify (`POST`, `PATCH`, `PUT`, `GET` com query/params) deve declarar `schema` com `additionalProperties: false`, tipos explícitos e limites (`minLength`, `maxLength`, `minimum`, `maximum: 100`).
4. **Autenticação e Autorização (JWT + RBAC)**:
   - Algoritmo explícito `algorithms: ['HS256']` ao assinar e verificar tokens.
   - Segredo lido exclusivamente de `process.env.JWT_SECRET` (com falha imediata `CRITICAL` se ausente; proibido fallback hardcoded).
   - Rotas administrativas exigem `role === 'ADMIN'`; rotas de cliente (`POST /api/orders`, `GET /users/me`) usam `userId` extraído do token JWT validado (nunca do body/query).
5. **Hardening HTTP & API Gateway**:
   - Todo serviço HTTP registra `@fastify/helmet`, `@fastify/cors` (allowlist via `CORS_ORIGINS`) e `@fastify/rate-limit`.
   - Novas rotas públicas/protegidas devem ser expostas no `gateway/nginx.conf` e documentadas em [04-contratos-api-e-eventos.md](../04-contratos-api-e-eventos.md).
6. **TypeScript Estrito**:
   - Compatibilidade total com `verbatimModuleSyntax: true`, `exactOptionalPropertyTypes: true` e `noUncheckedIndexedAccess: true` (usar `import type` para tipos).

---

## 4. Checklist de Entrega do `agent-backend`
- [ ] Camadas `domain/`, `use-cases/` e `infra/` separadas sem violar a regra de dependência.
- [ ] `infra/container.ts` conectando repositórios e use cases.
- [ ] Rotas com JSON Schema (`additionalProperties: false`), Helmet, CORS e Rate Limit ativos.
- [ ] `Dockerfile` multi-stage (`node:24-alpine`), `.dockerignore`, `.env.example` e entrada no `docker-compose.yml`.
- [ ] `npm run build` compilando sem erros de TypeScript (`tsc`).
- [ ] Contratos atualizados em `docs/04-contratos-api-e-eventos.md`.
