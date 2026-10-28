import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto de rastreabilidade por requisição/mensagem. O X-Correlation-ID nasce no
 * API Gateway, é gravado na outbox junto com o evento e viaja como propriedade AMQP
 * `correlationId`; cada consumer o restaura aqui antes de processar, e os repositórios
 * o leem ao gravar o próximo evento. Assim a cadeia inteira compartilha um único ID.
 */
const storage = new AsyncLocalStorage<string>();

export function runWithCorrelationId<T>(correlationId: string | undefined, fn: () => T): T {
  return correlationId ? storage.run(correlationId, fn) : fn();
}

export function currentCorrelationId(): string | null {
  return storage.getStore() ?? null;
}
