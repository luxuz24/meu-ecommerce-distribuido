import { describe, it, expect } from 'vitest';
import { parseNotificationEvent } from './index.js';

describe('Notification payload parser (User & Saga Order/Payment events)', () => {
  it('should parse direct user_created payload format', () => {
    const raw = JSON.stringify({ id: 'u1', name: 'Lucas', email: 'lucas@test.com' });
    const action = parseNotificationEvent('user_created', raw);
    expect(action).toEqual({
      type: 'WELCOME_EMAIL',
      recipient: 'lucas@test.com',
      summary: 'Welcome email to Lucas',
    });
  });

  it('should parse wrapped user_created payload format', () => {
    const raw = JSON.stringify({
      payload: { id: 'u1', name: 'Lucas', email: 'lucas@test.com' },
    });
    const action = parseNotificationEvent('user_created', raw);
    expect(action?.type).toBe('WELCOME_EMAIL');
    expect(action?.recipient).toBe('lucas@test.com');
  });

  it('should return null for invalid user payload without email', () => {
    const raw = JSON.stringify({ id: 'u1', name: 'Lucas' });
    const action = parseNotificationEvent('user_created', raw);
    expect(action).toBeNull();
  });

  it('should parse order_confirmed Saga notification', () => {
    const raw = JSON.stringify({
      orderId: 'ord-99',
      userId: 'user-99',
      total: 1549.9,
    });
    const action = parseNotificationEvent('order_confirmed', raw);
    expect(action).toEqual({
      type: 'ORDER_CONFIRMED_EMAIL',
      recipient: 'user-99',
      summary: 'Order #ord-99 confirmed (Total: R$ 1549.9)',
    });
  });

  it('should parse payment_failed Saga compensation alert', () => {
    const raw = JSON.stringify({
      orderId: 'ord-100',
      userId: 'user-100',
      reason: 'CARD_DECLINED',
    });
    const action = parseNotificationEvent('payment_failed', raw);
    expect(action).toEqual({
      type: 'PAYMENT_FAILED_ALERT',
      recipient: 'user-100',
      summary: 'Payment failed for Order #ord-100 (CARD_DECLINED)',
    });
  });
});
