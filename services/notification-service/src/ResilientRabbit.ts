import { rmSync, writeFileSync } from 'node:fs';
import amqp, { type ConfirmChannel, type Options } from 'amqplib';

/**
 * Conexão RabbitMQ que sobrevive a broker indisponível no boot e a quedas em produção.
 *
 * - Retry com backoff exponencial (1s → 30s) até o broker aceitar a conexão.
 * - Ao perder a conexão, reconecta e reexecuta `setup` (exchanges, filas, consumers).
 * - Usa ConfirmChannel: `publish` só resolve quando o broker confirma o recebimento.
 *
 * Este arquivo é replicado em cada serviço de propósito: cada microsserviço tem build
 * e deploy independentes, sem pacote compartilhado acoplando suas versões.
 */

type SetupTopology = (channel: ConfirmChannel) => Promise<void>;
type ChannelModel = Awaited<ReturnType<typeof amqp.connect>>;

const MAX_BACKOFF_MS = 30_000;

export function computeBackoffMs(attempt: number): number {
  return Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.max(0, attempt - 1));
}

export class ResilientRabbitConnection {
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private connecting = false;
  private stopped = false;

  constructor(
    private readonly url: string,
    private readonly serviceName: string,
    private readonly setup: SetupTopology,
    private readonly prefetch = 10,
    // Workers sem HTTP sinalizam prontidão por arquivo, usado pelo healthcheck do Docker
    private readonly readinessFile?: string
  ) {
    this.markReady(false);
  }

  get isConnected(): boolean {
    return this.channel !== null;
  }

  start(): void {
    void this.connectLoop();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.channel = null;
    await this.connection?.close().catch(() => undefined);
  }

  async publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options: Options.Publish
  ): Promise<void> {
    const channel = this.channel;
    if (!channel) throw new Error('RABBITMQ_NOT_CONNECTED');

    await new Promise<void>((resolve, reject) => {
      channel.publish(exchange, routingKey, content, options, (err) =>
        err ? reject(err) : resolve()
      );
    });
  }

  private async connectLoop(): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;
    let attempt = 0;

    while (!this.stopped) {
      attempt += 1;
      let connection: ChannelModel | null = null;
      try {
        connection = await amqp.connect(this.url);
        const channel = await connection.createConfirmChannel();
        await channel.prefetch(this.prefetch);

        connection.on('error', (err) => {
          console.error(`[${this.serviceName}] RabbitMQ connection error:`, err.message);
        });
        connection.on('close', () => this.handleDisconnect());
        // Erro de canal (ex.: ack inválido) fecha só o canal: derrubamos a conexão para recomeçar limpo
        channel.on('close', () => {
          void connection?.close().catch(() => undefined);
        });

        await this.setup(channel);

        this.connection = connection;
        this.channel = channel;
        this.markReady(true);
        console.log(`[${this.serviceName}] Connected to RabbitMQ (attempt ${attempt})`);
        break;
      } catch (err) {
        await connection?.close().catch(() => undefined);
        const delay = computeBackoffMs(attempt);
        console.warn(
          `[${this.serviceName}] RabbitMQ unavailable (attempt ${attempt}): ${(err as Error).message}. Retrying in ${delay}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    this.connecting = false;
  }

  private markReady(ready: boolean): void {
    if (!this.readinessFile) return;
    try {
      if (ready) writeFileSync(this.readinessFile, new Date().toISOString());
      else rmSync(this.readinessFile, { force: true });
    } catch (err) {
      console.error(`[${this.serviceName}] Could not update readiness file:`, (err as Error).message);
    }
  }

  private handleDisconnect(): void {
    if (this.channel === null && this.connection === null) return;
    this.channel = null;
    this.connection = null;
    this.markReady(false);
    if (this.stopped) return;
    console.warn(`[${this.serviceName}] RabbitMQ connection lost. Reconnecting...`);
    void this.connectLoop();
  }
}

interface OutboxRow {
  id: string;
  eventType: string;
  payload: unknown;
}

interface OutboxStore {
  outbox: {
    findMany(args: {
      where: { published: boolean };
      orderBy: { createdAt: 'asc' };
      take: number;
    }): Promise<OutboxRow[]>;
    update(args: { where: { id: string }; data: { published: boolean } }): Promise<unknown>;
  };
}

/**
 * Relay do Transactional Outbox: publica eventos pendentes e só os marca como publicados
 * após o publisher confirm do broker. Se cair entre o confirm e o UPDATE, o evento é
 * republicado (at-least-once) e a idempotência dos consumers absorve a duplicata.
 */
export function startOutboxRelay(
  store: OutboxStore,
  rabbit: ResilientRabbitConnection,
  exchange: string,
  serviceName: string,
  intervalMs = 1000
): NodeJS.Timeout {
  let running = false;

  return setInterval(async () => {
    if (running || !rabbit.isConnected) return;
    running = true;
    try {
      const pending = await store.outbox.findMany({
        where: { published: false },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      for (const event of pending) {
        await rabbit.publish(
          exchange,
          event.eventType.toLowerCase(),
          Buffer.from(JSON.stringify(event.payload)),
          { persistent: true, messageId: event.id, contentType: 'application/json' }
        );
        await store.outbox.update({ where: { id: event.id }, data: { published: true } });
      }
    } catch (err) {
      console.error(`[${serviceName}] Outbox relay error:`, (err as Error).message);
    } finally {
      running = false;
    }
  }, intervalMs);
}
