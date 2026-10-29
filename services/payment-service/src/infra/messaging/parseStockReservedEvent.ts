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

  const messageId =
    properties.messageId ||
    payload.messageId ||
    `stock_reserved_${payload.orderId}`;

  const calculatedAmount =
    typeof payload.total === 'number'
      ? payload.total
      : typeof payload.amount === 'number'
        ? payload.amount
        : Array.isArray(payload.items)
          ? payload.items.reduce(
              (acc: number, i: { price?: number; quantity?: number }) =>
                acc + Number(i.price ?? 0) * Number(i.quantity ?? 1),
              0
            )
          : 0;

  return {
    orderId: String(payload.orderId),
    userId: String(payload.userId ?? 'SYSTEM'),
    amount: Number(calculatedAmount),
    messageId: String(messageId),
    ...(payload.simulateOutcome === 'FAILED' ? { simulateOutcome: 'FAILED' } : {}),
  };
}
