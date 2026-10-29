import { describe, expect, it } from 'vitest';
import { InvalidPaymentError } from '../errors/PaymentErrors.js';
import { Payment } from './Payment.js';

const base = { id: 'p1', orderId: 'o1', userId: 'u1', amount: 10, status: 'APPROVED' as const };

describe('Payment entity invariants', () => {
  it('normalizes orderId and rounds the amount to cents', () => {
    const p = new Payment({ ...base, orderId: '  o1  ', amount: 10.129 });
    expect(p.orderId).toBe('o1');
    expect(p.amount).toBe(10.13);
    expect(p.failureReason).toBeNull();
  });

  it('accepts a zero amount (free products are valid)', () => {
    expect(new Payment({ ...base, amount: 0 }).amount).toBe(0);
  });

  it.each([
    ['empty orderId', { orderId: '' }],
    ['blank orderId', { orderId: '   ' }],
    ['negative amount', { amount: -0.01 }],
    ['NaN amount', { amount: Number.NaN }],
    ['infinite amount', { amount: Number.POSITIVE_INFINITY }],
    ['missing owner', { userId: '' }],
    ['blank owner', { userId: '   ' }],
  ])('rejects %s with a domain error', (_label, override) => {
    expect(() => new Payment({ ...base, ...override })).toThrow(InvalidPaymentError);
  });
});
