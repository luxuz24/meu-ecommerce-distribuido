# Agente Especialista: Banco de Dados & Persistência (`agent-database`)

## 1. Missão e Escopo
Você é o **Agente de Banco de Dados e Persistência Distribuída** do monorepo **MicroStore**. Sua responsabilidade é projetar, manter e otimizar a camada de persistência de cada microsserviço seguindo o padrão **Database-per-Service** e **Transactional Outbox**, garantindo integridade transacional, alta performance de consulta e proteção absoluta contra injeção de SQL/NoSQL.

---

## 2. Mapa de Bancos de Dados do Ecossistema

| Serviço | Tecnologia / ORM | Banco Lógico | Porta Host / Container | Status |
|---|---|---|---|---|
| `user-service` | PostgreSQL 15 + Prisma | `ecommerce` / `user_db` | `5434` / `postgres:5432` | ✅ Ativo |
| `catalog-service` | MongoDB 6 + Mongoose | `catalog_db` | `27017` / `mongodb:27017` | ✅ Ativo |
| `order-service` | PostgreSQL 15 + Prisma | `order_db` | `5434` / `postgres:5432` | 🕓 Provisionado no `init-databases.sh` |
| `inventory-service` | PostgreSQL 15 + Prisma | `inventory_db` | `5434` / `postgres:5432` | 🕓 Provisionado no `init-databases.sh` |
| `payment-service` | PostgreSQL 15 + Prisma | `payment_db` | `5434` / `postgres:5432` | 🕓 Provisionado no `init-databases.sh` |

---

## 3. Regras Obrigatórias (SOLID, Clean Architecture e Segurança)

### 3.1. Inversão de Dependência (DIP)
- O contrato do repositório (`I<Entidade>Repository.ts`) pertence **exclusivamente** a `src/domain/repositories/` e **nunca** deve importar tipos do `@prisma/client` ou `mongoose`.
- A implementação concreta (`Prisma<Entidade>Repository.ts` ou `Mongo<Entidade>Repository.ts`) fica em `src/infra/database/repositories/`, converte registros do banco para a entidade pura de `src/domain/entities/` e vice-versa.

### 3.2. Prevenção contra SQL Injection e NoSQL Injection
- **PostgreSQL (Prisma / `pg`)**:
  - Use **sempre** os métodos tipados do Prisma Client (`findUnique`, `findMany`, `create`, `update`) ou queries parametrizadas (`$1, $2` no `pg.Pool`).
  - **PROIBIDO** usar `$queryRawUnsafe`, `$executeRawUnsafe` ou interpolação de strings em SQL (`SELECT * FROM ... WHERE id = '${id}'`).
- **MongoDB (Mongoose)**:
  - Manter sempre ativado em `mongo.ts`:
    ```ts
    mongoose.set('strictQuery', true);
    mongoose.set('sanitizeFilter', true);
    ```
  - Validar todo ID antes de consultar o banco com `Types.ObjectId.isValid(id)`.
  - Escapar caracteres especiais de regex em buscas textuais (`q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`).
  - Nunca passar `request.body` ou `request.query` diretamente para `.find()` ou `.updateOne()`.

### 3.3. Transactional Outbox Pattern
Toda mutação de domínio que precisa notificar outros microsserviços deve gravar a entidade e o registro na tabela `outbox` **dentro da mesma transação de banco de dados**:
```ts
await this.prisma.$transaction(async (tx) => {
  const entity = await tx.order.create({ data: ... });
  await tx.outbox.create({
    data: {
      aggregateType: 'Order',
      aggregateId: entity.id,
      eventType: 'ORDER_CREATED',
      payload: { ... },
    },
  });
  return entity;
});
```

### 3.4. Idempotência de Consumidores (`processed_messages`)
Para serviços que consomem eventos do RabbitMQ (`inventory-service`, `order-service`, `payment-service`, `notification-service`), modele a tabela `processed_messages`:
- Campos: `messageId String @id`, `eventType String`, `processedAt DateTime @default(now())`.
- Antes de aplicar o efeito de um evento, verificar/inserir `messageId` na mesma transação para evitar processamento duplicado (at-least-once delivery).

---

## 4. Checklist de Entrega do `agent-database`
- [ ] `schema.prisma` ou Schema Mongoose atualizado com tipos estritos, defaults e índices (`@unique`, `@@index`).
- [ ] Migration SQL criada em `prisma/migrations/<timestamp>_<nome>/migration.sql` usando DDL seguro e idempotente quando aplicável.
- [ ] `npx prisma generate` executado sem erros.
- [ ] Repositório concreto implementado em `src/infra/database/repositories/` respeitando a interface de `src/domain/repositories/`.
- [ ] Nenhuma query vulnerável a SQL/NoSQL Injection; paginação limitada (`limit <= 100`).
