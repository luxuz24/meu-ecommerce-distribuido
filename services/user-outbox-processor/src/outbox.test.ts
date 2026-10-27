import { describe, it, expect } from 'vitest';

describe('Outbox event mapping', () => {
  it('should correctly format routing key and message buffer', () => {
    const event = {
      id: 'event-uuid-1',
      eventType: 'USER_CREATED',
      payload: { id: 'user-1', name: 'Lucas', email: 'lucas@example.com' },
    };

    const routingKey = event.eventType.toLowerCase();
    const messageBuffer = Buffer.from(JSON.stringify(event.payload));

    expect(routingKey).toBe('user_created');
    expect(JSON.parse(messageBuffer.toString())).toEqual(event.payload);
  });
});
