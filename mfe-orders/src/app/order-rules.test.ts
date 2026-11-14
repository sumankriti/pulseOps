import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { nextStatus } from './order-rules.ts';

await test('fulfillment progresses and delivered is terminal', () => {
  assert.equal(nextStatus('Processing'), 'Shipped');
  assert.equal(nextStatus('Shipped'), 'Delivered');
  assert.equal(nextStatus('Delivered'), 'Delivered');
});
await test('a delayed order can resume fulfillment', () => {
  assert.equal(nextStatus('Delayed'), 'Shipped');
});
