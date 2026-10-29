import { describe, expect, it } from 'vitest';
import { parseStockReservedEvent } from './parseStockReservedEvent.js';

const event = { orderId: 'o1', userId: 'u1', total: 120.5, items: [{ sku: 'A', quantity: 1, price: 120.5 }] };
const body = (payload: unknown) => JSON.stringify(payload);

describe('parseStockReservedEvent', () => {
  it('maps a valid STOCK_RESERVED payload, using the broker messageId', () => {
    expect(parseStockReservedEvent(body(event), { messageId: 'm-1' })).toEqual({
      orderId: 'o1', userId: 'u1', amount: 120.5, messageId: 'm-1',
    });
  });

  it('accepts the payload nested as an object or as a JSON string', () => {
    expect(parseStockReservedEvent(body({ payload: event }), { messageId: 'm' }).orderId).toBe('o1');
    expect(parseStockReservedEvent(body({ payload: JSON.stringify(event) }), { messageId: 'm' }).orderId).toBe('o1');
  });

  it('falls back to the payload messageId, then to one derived from the order', () => {
    expect(parseStockReservedEvent(body({ ...event, messageId: 'from-payload' }), {}).messageId).toBe('from-payload');
    expect(parseStockReservedEvent(body(event), {}).messageId).toBe('stock_reserved_o1');
  });

  it('forwards only a FAILED simulation, never an APPROVED one', () => {
    expect(parseStockReservedEvent(body({ ...event, simulateOutcome: 'FAILED' }), {}).simulateOutcome).toBe('FAILED');
    expect(parseStockReservedEvent(body({ ...event, simulateOutcome: 'APPROVED' }), {})).not.toHaveProperty('simulateOutcome');
  });

  it.each([
    ['missing total (would charge R$ 0)', { orderId: 'o1', userId: 'u1' }],
    ['non-numeric total', { ...event, total: '120.5' }],
    ['negative total', { ...event, total: -1 }],
    ['missing orderId (would become "undefined")', { userId: 'u1', total: 10 }],
    ['blank orderId', { ...event, orderId: '  ' }],
    ['missing userId (would become "SYSTEM")', { orderId: 'o1', total: 10 }],
  ])('rejects an event with %s', (_label, payload) => {
    expect(() => parseStockReservedEvent(body(payload), {})).toThrow(/INVALID_STOCK_RESERVED_EVENT/);
  });

  it('rejects a body that is not JSON', () => {
    expect(() => parseStockReservedEvent('not-json', {})).toThrow();
  });

  it('accepts a zero total (free products are valid)', () => {
    expect(parseStockReservedEvent(body({ ...event, total: 0 }), {}).amount).toBe(0);
  });

  it('rejects a total that JSON.parse turns into Infinity', () => {
    expect(() => parseStockReservedEvent('{"orderId":"o1","userId":"u1","total":1e400}', {})).toThrow(
      'INVALID_STOCK_RESERVED_EVENT: total must be a finite number >= 0'
    );
  });

  it('names the missing field in the error', () => {
    expect(() => parseStockReservedEvent(body({ userId: 'u1', total: 1 }), {})).toThrow('orderId is required');
    expect(() => parseStockReservedEvent(body({ orderId: 'o1', total: 1 }), {})).toThrow('userId is required');
  });
});
