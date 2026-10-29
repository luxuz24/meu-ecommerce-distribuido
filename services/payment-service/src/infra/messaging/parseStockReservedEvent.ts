import { type ProcessPaymentInput } from '../../use-cases/PaymentUseCases.js';

/**
 * Converte o corpo de um evento `stock_reserved` no input do ProcessPaymentUseCase.
 * Função pura, separada do consumer para ser testável sem broker.
 */
export function parseStockReservedEvent(
  body: string,
  properties: { messageId?: string }
): ProcessPaymentInput {
  const raw = JSON.parse(body);
  const payload = raw.payload
    ? typeof raw.payload === 'string'
      ? JSON.parse(raw.payload)
      : raw.payload
    : raw;

  // Campos de negócio obrigatórios pelo contrato (docs/04): sem default silencioso.
  // Um evento inválido lança e vai para a DLQ em vez de virar cobrança de R$ 0,
  // pedido "undefined" ou pagamento sem dono.
  const orderId = requiredText(payload.orderId, 'orderId');
  const userId = requiredText(payload.userId, 'userId');
  if (typeof payload.total !== 'number' || !Number.isFinite(payload.total) || payload.total < 0) {
    throw new Error('INVALID_STOCK_RESERVED_EVENT: total must be a finite number >= 0');
  }

  return {
    orderId,
    userId,
    amount: payload.total,
    messageId: String(properties.messageId || payload.messageId || `stock_reserved_${orderId}`),
    ...(payload.simulateOutcome === 'FAILED' ? { simulateOutcome: 'FAILED' } : {}),
  };
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`INVALID_STOCK_RESERVED_EVENT: ${field} is required`);
  }
  return value;
}
