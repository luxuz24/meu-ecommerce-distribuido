# 06 — Fluxo de Trabalho, SOLID e Segurança para Agentes

Documento **normativo**. Complementa `03-convencoes-e-regras-para-agentes.md`. Em conflito, vale o mais restritivo.

---

## 1. Fluxo de trabalho (obrigatório)

1. **Nunca commitar direto na `main`.** Toda feature, fix ou chore nasce em uma branch nova:
   `feat/<escopo>-<descricao>`, `fix/...`, `chore/...`, `docs/...`, `test/...`, `refactor/...`.
2. Partir sempre da `main` atualizada: `git switch main && git pull && git switch -c feat/...`.
3. Commits pequenos em **Conventional Commits** (`feat(catalog-service): add list products`).
4. Escrever/atualizar **testes junto** com o código (ver seção 5).
5. Antes de abrir o PR, rodar localmente no(s) serviço(s) alterado(s): `npm run lint`, `npm run build`, `npm test`. Se algo falhar, corrigir — nunca desabilitar teste, lint ou regra para passar.
6. **Abrir o Pull Request e devolvê-lo ao usuário** (link do PR + resumo). O agente **não faz merge**; quem aprova e mergeia é o usuário.
7. **Merge só se o CI estiver verde** (todos os checks obrigatórios). PR com teste falhando ou sem teste do novo comportamento não é mergeado.
8. Um escopo por PR. Atualizar docs (`02-planejamento-roadmap.md`, `04-contratos-api-e-eventos.md`) no mesmo PR.

### Template do PR
```
## O que mudou
## Por quê
## Como testar (comandos + resultado esperado)
## Checklist
- [ ] Testes novos/atualizados e passando
- [ ] Build e lint ok
- [ ] Sem segredos no diff
- [ ] Entrada validada / queries parametrizadas
- [ ] Docs e .env.example atualizados
- [ ] Migrations reversíveis/documentadas (se houver)
## Riscos / rollback
```

### Proteção da `main` (configurar no GitHub — ação do usuário)
- Exigir PR + 1 aprovação; bloquear push direto e force-push.
- Exigir status checks: `lint`, `build`, `test`, `docker-build`, `audit`.
- Exigir branch atualizada com a `main` antes do merge.

### CI mínimo (`.github/workflows/ci.yml`) — tarefa da Fase 0
Matriz por serviço: `npm ci` → `lint` → `tsc` → `test` (com Postgres/Mongo/RabbitMQ como `services:` para integração) → `npm audit --audit-level=high` → `docker build`. Falha em qualquer etapa bloqueia o merge.

---

## 2. SOLID aplicado ao projeto

| Princípio | Regra prática | Exemplo neste repo |
|---|---|---|
| **S** — Responsabilidade única | Uma classe/arquivo = um motivo para mudar. Um use case = uma ação de negócio. Controller não tem regra de negócio; repositório não valida regra. | `CreateUserUseCase` hoje faz verificação, hash, persistência e outbox → separar em `IPasswordHasher`, `IUserRepository`, `IOutboxRepository`. |
| **O** — Aberto/fechado | Estender por nova implementação de interface, não editando use cases. Novos comportamentos via novas classes/estratégias. | Trocar bcrypt por argon2 = nova classe `Argon2Hasher`, sem tocar no use case. |
| **L** — Substituição de Liskov | Toda implementação respeita o contrato da interface (mesmos erros, retornos, nulos). Fakes de teste devem ser trocáveis pelas reais. | `InMemoryProductRepository` e `MongoProductRepository` intercambiáveis. |
| **I** — Segregação de interfaces | Interfaces pequenas e focadas por consumidor; nada de `IRepository` gigante. | `IProductReader` (find/list) separada de `IProductWriter` (create/update). |
| **D** — Inversão de dependência | Use cases dependem de abstrações em `domain/`; implementações em `infra/` injetadas no **composition root**. Proibido `new PrismaClient()`/`new MongoXRepository()` dentro de use case ou controller. | Mover criação do Prisma de `UserController` para `infra/container.ts`. |

Checklist de revisão SOLID em todo PR:
- Algum use case importa de `infra/` ou de libs externas (Prisma, Mongoose, bcrypt, jwt, amqplib)? → reprovar.
- Algum arquivo > ~200 linhas ou com "e" na descrição de sua responsabilidade? → dividir.
- Há `if/switch` por tipo que cresce a cada feature? → usar polimorfismo/estratégia.

---

## 3. Segurança (obrigatório)

### 3.1 Prevenção de SQL/NoSQL Injection
- **Proibido** concatenar/interpolar entrada do usuário em SQL. Use **Prisma Client** (parametrizado) no user-service.
- Se precisar de SQL cru: `prisma.$queryRaw` com *tagged template* (`` prisma.$queryRaw`SELECT ... WHERE id = ${id}` ``) ou `pg` com **placeholders** (`client.query('... WHERE id = $1', [id])`). **Nunca** `$queryRawUnsafe`/`$executeRawUnsafe` com entrada externa, nem template string manual em `pg`.
- Identificadores dinâmicos (ordenação/colunas): validar contra **allowlist** fixa.
- **NoSQL (Mongo)**: nunca passar `request.body`/`query` direto para `find`/`update`. Validar com schema (tipos primitivos), rejeitar objetos com chaves iniciadas em `$` ou contendo `.` (`$ne`, `$gt`, `$where`); usar `mongoose` com `strictQuery: true` e `sanitizeFilter: true`; converter para `String(...)`/`Number(...)` antes de consultar.
- Acesso ao DB com usuário de **menor privilégio** por serviço (não usar superusuário `postgres`/`admin` em produção).
- Teste obrigatório: casos de injeção (`' OR 1=1 --`, `{"$ne":null}`) devem ser rejeitados/neutralizados.

### 3.2 Validação e sanitização de entrada
- Toda rota com **schema Fastify (JSON Schema/Zod)**: `additionalProperties: false`, tipos, tamanhos máximos, formatos.
- Limite de corpo (`bodyLimit`, ex.: 100 KB) e de paginação (`limit ≤ 100`).
- Nunca confiar em IDs/roles vindos do cliente; derivar do JWT.

### 3.3 CORS (`@fastify/cors`)
- **Allowlist explícita** por ambiente via env `CORS_ORIGINS` (lista separada por vírgula). **Proibido** `origin: '*'` ou `origin: true` com `credentials: true`.
- Métodos: apenas os usados (`GET,POST,PATCH,DELETE,OPTIONS`); headers: `Content-Type, Authorization`.
- `credentials: true` apenas se usar cookie; `maxAge` de preflight (ex.: 600).
```ts
await app.register(cors, {
  origin: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
  maxAge: 600,
});
```
- Dev: `CORS_ORIGINS=http://localhost:3002` (porta do frontend). Prod: domínio real apenas.

### 3.4 Rate limit (`@fastify/rate-limit`)
- Global (ex.: 100 req/min por IP) e **mais estrito** em rotas sensíveis: `/login` (5–10/min), `POST /users` (10/min).
- Atrás de proxy/LB: configurar `trustProxy` para usar o IP real do cliente.
- Em múltiplas instâncias, usar **store compartilhado (Redis)** para o contador.
- Responder `429` com `Retry-After`. Considerar bloqueio progressivo/lockout após falhas repetidas de login.
- Aplicar também no gateway/LB (defesa em profundidade).

### 3.5 Load balancer e gateway
- Colocar **Nginx (ou Traefik)** à frente dos serviços no compose como ponto único de entrada: roteamento por prefixo (`/api/users`, `/api/catalog`, …), `upstream` com várias réplicas (`least_conn`), health checks, timeouts, `limit_req`, compressão e headers de segurança.
- Serviços **stateless** (sem sessão em memória) para permitir `docker compose up --scale <svc>=N`; remover `container_name` e portas fixas dos serviços escaláveis.
- Terminação **TLS** no LB em produção; HTTP→HTTPS redirect; HSTS.
- Serviços internos (DBs, RabbitMQ) **não expostos** ao host em produção; só o LB publica porta.
- Workers (outbox/notification) escaláveis: o outbox já usa `FOR UPDATE SKIP LOCKED`; consumidores precisam ser **idempotentes**.

### 3.6 Headers e hardening HTTP
- `@fastify/helmet` em todas as APIs (CSP, X-Content-Type-Options, frame-ancestors, etc.).
- Desabilitar `x-powered-by`/informações de versão; erros 500 sem stack trace ao cliente.
- Handler global de erros: log interno detalhado, resposta genérica.

### 3.7 Autenticação e autorização
- Senhas: bcrypt (custo ≥ 10) ou argon2; **nunca** logar senha/token/hash.
- JWT: `JWT_SECRET` forte (≥ 32 bytes aleatórios), **fixar algoritmo** (`algorithms: ['HS256']` ao verificar), `exp` curto + refresh token rotativo; validar `iss`/`aud` quando houver múltiplos serviços.
- Autorização por **role** no middleware; checar **propriedade do recurso** (usuário só acessa seus pedidos) — previne IDOR.
- Respostas de login iguais para e-mail inexistente/senha errada (já feito: `INVALID_CREDENTIALS!`); mitigar timing/enumeração.
- Frontend: preferir cookie `httpOnly; Secure; SameSite=Lax/Strict`; se cookie, adicionar proteção CSRF.

### 3.8 Segredos e configuração
- Segredos só via env/secret manager; **`.env` nunca commitado**; `.env.example` sem valores reais.
- Rotacionar os segredos de dev atuais (`JWT_SECRET`, senhas `postgres/admin/guest`) antes de qualquer ambiente compartilhado/produção. Remover `guest/guest` do RabbitMQ em prod.
- Scan de segredos no CI (ex.: gitleaks).

### 3.9 Dependências e containers
- `npm audit --audit-level=high` e Dependabot/Renovate; PR com vulnerabilidade alta/crítica não faz merge.
- `npm ci` (lockfile), versões fixadas; imagens base com tag/digest específico.
- Containers: rodar como **usuário não-root** (`USER node`), filesystem somente leitura quando possível, sem `--privileged`, healthcheck em todos.
- Scan de imagem no CI (ex.: Trivy).

### 3.10 Mensageria
- Credenciais dedicadas por serviço, permissões mínimas (vhost); TLS em prod.
- Validar schema do payload no consumidor; **idempotência** por `messageId`; `nack` + **DLQ** para mensagens inválidas (não `ack` em erro).
- Não colocar dados sensíveis (senha, token) em eventos.

### 3.11 Observabilidade e auditoria
- Logs estruturados (pino) com `correlation-id`/`request-id` propagado entre serviços e eventos; redigir campos sensíveis (`redact`).
- `/health` (liveness) e `/ready` (checa DB/broker). Métricas básicas (Prometheus) quando houver gateway.
- Registrar eventos de segurança: login falho, 401/403/429 repetidos.

---

## 4. Checklist de segurança por PR
- [ ] Sem SQL/NoSQL montado com entrada do usuário; raw queries parametrizadas
- [ ] Schema de validação na rota (`additionalProperties:false`, limites)
- [ ] CORS por allowlist (sem `*`)
- [ ] Rate limit aplicado (estrito em auth)
- [ ] Autorização + checagem de propriedade do recurso
- [ ] Sem segredo/PII em log, código ou evento
- [ ] Dependências auditadas; sem vulnerabilidade alta/crítica nova
- [ ] Teste cobrindo caso malicioso/negativo (injeção, 401/403/429, payload inválido)

---

## 5. Testes automatizados (portão de merge)

- **Ferramenta**: Vitest (unit + integração), Supertest/`fastify.inject` para HTTP, Testing Library/Playwright no frontend.
- **Pirâmide**:
  - *Unit*: use cases com fakes in-memory das interfaces (rápidos, sem rede). Meta de cobertura ≥ **80%** em `use-cases/` e `domain/`.
  - *Integração*: repositórios e rotas contra Postgres/Mongo/RabbitMQ reais (containers do CI) — inclui outbox → fila → consumidor.
  - *Segurança*: injeção, CORS (origem não permitida → bloqueada), rate limit (excedido → 429), auth (sem/ inválido token → 401, role errada → 403).
  - *E2E* (quando o frontend existir): fluxo cadastro → login → catálogo → pedido.
- **Regras**:
  - Bug corrigido ⇒ teste de regressão que falha antes e passa depois.
  - Feature nova ⇒ testes do caminho feliz, erros e limites.
  - Testes determinísticos (sem dependência de horário/rede externa/ordem).
  - Proibido `.skip`/`.only`/reduzir cobertura para fazer o CI passar.
- **Gate**: PR só é elegível a merge com **todos os checks verdes** (lint, build, test, audit, docker-build) e aprovação do usuário.

---

## 6. Resumo do ciclo de uma tarefa
```
main atualizada → git switch -c feat/x → implementar (SOLID + segurança) → testes
→ lint/build/test locais → push → abrir PR (template) → devolver link ao usuário
→ CI verde + aprovação do usuário → merge (squash) → atualizar roadmap
```
