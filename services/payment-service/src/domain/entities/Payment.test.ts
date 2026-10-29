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

  it('explains which field is invalid (the message is returned to API clients)', () => {
    expect(() => new Payment({ ...base, orderId: '' })).toThrow('INVALID_PAYMENT: orderId is required');
    expect(() => new Payment({ ...base, userId: '' })).toThrow('INVALID_PAYMENT: userId is required');
    expect(() => new Payment({ ...base, amount: -1 })).toThrow('INVALID_PAYMENT: amount must be a finite number >= 0');
  });

  it('trims the owner and keeps a provided creation date, defaulting to now', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    expect(new Payment({ ...base, userId: '  u1  ', createdAt: created }).userId).toBe('u1');
    expect(new Payment({ ...base, createdAt: created }).createdAt).toBe(created);
    expect(new Payment(base).createdAt).toBeInstanceOf(Date);
  });
});
