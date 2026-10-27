# Meu E-Commerce Distribuído 🛒⚡

Arquitetura de microsserviços para e-commerce baseada em Node.js, TypeScript, PostgreSQL, MongoDB e RabbitMQ, utilizando o padrão **Transactional Outbox** para consistência eventual entre serviços.

---

## 🏛️ Arquitetura dos Microsserviços

```
                     +---------------------------------------+
                     |         Frontend / API Gateway        |
                     +-------------------+-------------------+
                                         |
             +---------------------------+---------------------------+
             |                                                       |
             v                                                       v
+--------------------------+                           +--------------------------+
|       User Service       |                           |     Catalog Service      |
|       (Porta 3000)       |                           |       (Porta 3001)       |
+-------------+------------+                           +-------------+------------+
              |                                                      |
              v                                                      v
     +-----------------+                                    +-----------------+
     |   PostgreSQL    |                                    |     MongoDB     |
     | (Porta 5434/int)|                                    |  (Porta 27017)  |
     +--------+--------+                                    +-----------------+
              |
              | (Poller / Outbox Table)
              v
+-----------------------------+
|    User Outbox Processor    |
|     (Background Worker)     |
+-------------+---------------+
              |
              | (Publica na Exchange 'ecommerce_events')
              v
     +-----------------+
     |    RabbitMQ     |
     |  (Porta 5672)   |
     +--------+--------+
              |
              | (Consome da Fila 'notification_user_created')
              v
+-----------------------------+
|    Notification Service     |
|     (Background Worker)     |
+-----------------------------+
```

### Serviços e Tecnologias:

1. **`user-service`** (Fastify, Prisma 7, PostgreSQL):
   - Gerenciamento de usuários, autenticação JWT, cadastro e perfil.
   - Ao criar usuário, registra o evento na tabela `outbox` na mesma transação.
2. **`user-outbox-processor`** (pg, amqplib):
   - Poller assíncrono que busca eventos não publicados da tabela `outbox` no PostgreSQL e publica na exchange do RabbitMQ (`ecommerce_events`).
3. **`notification-service`** (amqplib):
   - Consumidor de eventos do RabbitMQ ligado à fila `notification_user_created` que processa o envio simulado de e-mails de boas-vindas.
4. **`catalog-service`** (Fastify, Mongoose, MongoDB):
   - Catálogo de produtos, permitindo cadastro com validações de SKU, estoque e preços.
5. **Infraestrutura**:
   - **PostgreSQL 15**: banco relacional (porta exposta: `5434`, interna: `5432`).
   - **MongoDB 6**: banco documental (porta exposta: `27017`).
   - **RabbitMQ 3**: broker de mensageria com painel de gerenciamento (portas: `5672` e `15672`).

---

## ⚙️ Configuração de Variáveis de Ambiente (`.env`)

Arquivos de ambiente configurados para uso imediato:
- `.env` na raiz: utilizado pelo `docker-compose.yml`.
- `services/<servico>/.env`: configurado para rodar os serviços localmente ou no contêiner.

Modelos de exemplo foram mantidos em `.env.example` tanto na raiz quanto em cada serviço.

---

## 🚀 Como Executar

### 1. Subir tudo com Docker Compose (Recomendado)

Todos os serviços e dependências de infraestrutura sobem juntos:

```bash
docker compose up -d
```

Para verificar o status de todos os contêineres:
```bash
docker compose ps
```

Para acompanhar os logs em tempo real:
```bash
docker compose logs -f
```

Para parar o ambiente:
```bash
docker compose down
```

---

### 2. Rodar Serviços Localmente (Modo Desenvolvimento)

Se preferir rodar a infraestrutura no Docker e os serviços localmente:

1. Suba apenas os bancos e o broker:
   ```bash
   docker compose up -d postgres mongodb rabbitmq
   ```

2. Execute as migrações do banco (no `user-service`):
   ```bash
   cd services/user-service
   npx prisma migrate deploy
   ```

3. Em terminais separados, inicie cada serviço:
   - **User Service**:
     ```bash
     cd services/user-service && npm run dev
     ```
   - **User Outbox Processor**:
     ```bash
     cd services/user-outbox-processor && npm run dev
     ```
   - **Notification Service**:
     ```bash
     cd services/notification-service && npm run dev
     ```
   - **Catalog Service**:
     ```bash
     cd services/catalog-service && npm run dev
     ```

---

## 🧪 Testando as APIs

### 1. Health Checks
```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
```

### 2. Criar Usuário (Dispara Outbox + RabbitMQ + Notificação)
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Maria Silva",
    "email": "maria@example.com",
    "password": "senhaSegura123"
  }'
```
> Observe os logs com `docker compose logs -f notification-service` para ver a mensagem sendo consumida e o e-mail simulado.

### 3. Login e Obtenção do Token JWT
```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria@example.com",
    "password": "senhaSegura123"
  }'
```

### 4. Consultar Perfil Autenticado (`/users/me`)
```bash
curl -X GET http://localhost:3000/users/me \
  -H "Authorization: Bearer <SEU_TOKEN_JWT>"
```

### 5. Cadastrar Produto no Catálogo (MongoDB)
```bash
curl -X POST http://localhost:3001/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Monitor UltraWide 34",
    "description": "Monitor IPS 144Hz",
    "sku": "MON-UW-34",
    "price": 2499.00,
    "stock": 15
  }'
```

---

## 📊 Acesso aos Painéis Administrativos

- **RabbitMQ Management**: [http://localhost:15672](http://localhost:15672) (Usuário: `guest`, Senha: `guest`)
- **PostgreSQL**: Porta `localhost:5434` (Usuário: `postgres`, Senha: `postgres`, DB: `ecommerce`)
- **MongoDB**: Porta `localhost:27017` (Usuário: `admin`, Senha: `admin`)
