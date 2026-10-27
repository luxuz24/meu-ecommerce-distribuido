import { describe, it, expect } from 'vitest';

describe('Notification payload parser', () => {
  function parseUserEvent(rawMessage: string) {
    const eventData = JSON.parse(rawMessage);
    let user;
    if (eventData.payload) {
      user = typeof eventData.payload === 'string' ? JSON.parse(eventData.payload) : eventData.payload;
    } else {
      user = eventData;
    }
    if (!user || !user.email) {
      return null;
    }
    return user;
  }

  it('should parse direct user payload format', () => {
    const raw = JSON.stringify({ id: 'u1', name: 'Lucas', email: 'lucas@test.com' });
    const user = parseUserEvent(raw);
    expect(user).toEqual({ id: 'u1', name: 'Lucas', email: 'lucas@test.com' });
  });

  it('should parse wrapped payload format', () => {
    const raw = JSON.stringify({ payload: { id: 'u1', name: 'Lucas', email: 'lucas@test.com' } });
    const user = parseUserEvent(raw);
    expect(user).toEqual({ id: 'u1', name: 'Lucas', email: 'lucas@test.com' });
  });

  it('should return null for invalid user payload without email', () => {
    const raw = JSON.stringify({ id: 'u1', name: 'Lucas' });
    const user = parseUserEvent(raw);
    expect(user).toBeNull();
  });
});
