import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnUrl } from './return-url.ts';

await test('preserves supported destinations including detail IDs, query, and fragment', () => {
  for (const value of [
    '/orders',
    '/orders/ORD-1048',
    '/inventory',
    '/orders?status=Shipped#recent',
  ]) {
    assert.equal(safeReturnUrl(value), value);
  }
});

await test('rejects external, protocol-relative, encoded, unknown, and login-loop destinations', () => {
  for (const value of [
    null,
    '',
    'https://example.com',
    '//example.com',
    '/\\example.com',
    '/%2F%2Fexample.com',
    '/login',
    '/admin',
    '/inventory/extra',
    '/orders/hello world',
  ]) {
    assert.equal(safeReturnUrl(value), '/orders');
  }
});
