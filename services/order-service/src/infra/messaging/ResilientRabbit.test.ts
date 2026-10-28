import { describe, it, expect } from 'vitest';
import { computeBackoffMs } from './ResilientRabbit.js';

describe('RabbitMQ reconnection backoff', () => {
  it('should grow exponentially from 1s and cap at 30s', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 20].map(computeBackoffMs)).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000,
    ]);
  });
});
