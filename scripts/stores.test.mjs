// Compile the service files for Node; Angular's production build checks their types.
import '@angular/compiler';
import { createEnvironmentInjector } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

await mkdir('.angular', { recursive: true });
const output = await mkdtemp(path.resolve('.angular/store-tests-'));
after(() => rm(output, { recursive: true, force: true }));
for (const file of [
  'orders/order-rules',
  'orders/order-fixtures',
  'orders/orders-api',
  'orders/orders-store',
  'inventory/stock-rules',
  'inventory/inventory-store',
  'shared/notifications',
]) {
  const sourcePath =
    file === 'shared/notifications'
      ? 'shared/notifications/index.ts'
      : `mfe-${file.split('/')[0]}/src/app/${file.split('/')[1]}.ts`;
  const source = await readFile(sourcePath, 'utf8');
  // Preserve original TypeScript locations for c8/Sonar instead of reporting
  // coverage against temporary JavaScript inside .angular/.
  const absoluteSource = path.resolve(sourcePath);
  const compiled = ts
    .transpileModule(source, {
      fileName: absoluteSource,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
        experimentalDecorators: true,
        useDefineForClassFields: false,
        inlineSourceMap: true,
        inlineSources: true,
        sourceRoot: path.dirname(absoluteSource) + path.sep,
      },
    })
    .outputText.replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g, '$1$2.js$3');
  await mkdir(path.dirname(path.join(output, file)), { recursive: true });
  await writeFile(path.join(output, file + '.js'), compiled);
}
const load = (file) => import(pathToFileURL(path.join(output, file + '.js')).href);
const { OrdersStore } = await load('orders/orders-store');
const { ORDERS_API, FixtureOrdersApi } = await load('orders/orders-api');
const { InventoryStore } = await load('inventory/inventory-store');
const { reserveOne } = await load('inventory/stock-rules');
const { ORDER_FIXTURES } = await load('orders/order-fixtures');
const { NotificationService } = await load('shared/notifications');
const sample = () => ORDER_FIXTURES.map((order) => ({ ...order }));

function setup(t) {
  const calls = [];
  const api = {
    list(scenario) {
      const response = new Subject();
      calls.push({ scenario, response });
      return response.asObservable();
    },
  };
  const injector = createEnvironmentInjector(
    [OrdersStore, { provide: ORDERS_API, useValue: api }],
    null,
  );
  t.after(() => {
    if (!injector.destroyed) injector.destroy();
  });
  return { store: injector.get(OrdersStore), calls, injector };
}

test('loading precedes success and repeated page entry does not reload cached orders', (t) => {
  const { store, calls } = setup(t);
  assert.equal(store.status(), 'idle');
  store.ensureLoaded();
  store.ensureLoaded();
  assert.equal(calls.length, 1);
  assert.equal(store.status(), 'loading');
  store.simulate();
  assert.equal(store.orders().length, 0);
  calls[0].response.next(sample());
  assert.equal(store.status(), 'success');
  assert.equal(store.orders().length, 6);
  store.advance('ORD-1048');
  store.ensureLoaded();
  assert.equal(calls.length, 1);
  assert.equal(store.orders()[0].status, 'Shipped');
});

test('fulfillment simulation respects terminal orders and reset reloads authoritative fixtures', (t) => {
  const { store, calls } = setup(t);
  store.advance('ORD-1048');
  assert.equal(store.orders().length, 0);
  store.load();
  calls[0].response.next(sample());
  assert.equal(store.total(), 1354);
  assert.equal(store.processing(), 2);
  assert.equal(store.delayed(), 1);
  const previous = store.orders();
  store.advance('unknown');
  store.advance('ORD-1045');
  assert.equal(store.orders(), previous);
  for (let step = 0; step < 12; step++) store.simulate();
  assert.equal(
    store.orders().every((order) => order.status === 'Delivered'),
    true,
  );
  assert.equal(store.processing(), 0);
  assert.equal(store.delayed(), 0);
  assert.equal(store.total(), 1354);
  assert.match(store.lastEvent(), /No pending orders/);
  store.reset();
  assert.equal(store.status(), 'loading');
  assert.equal(calls.length, 2);
  calls[1].response.next(sample());
  assert.equal(store.orders()[0].status, 'Processing');
});

test('an empty success is distinct from an error and reload recovers after failure', (t) => {
  const { store, calls } = setup(t);
  store.load('empty');
  calls[0].response.next([]);
  assert.equal(store.status(), 'success');
  assert.equal(store.orders().length, 0);
  assert.equal(store.error(), null);
  store.load('error');
  calls[1].response.error(new Error('failure'));
  assert.equal(store.status(), 'error');
  assert.ok(store.error());
  store.load();
  calls[2].response.next(sample());
  assert.equal(store.status(), 'success');
  assert.equal(store.error(), null);
});

test('superseded responses cannot overwrite the latest request', (t) => {
  const { store, calls } = setup(t);
  store.load('error');
  store.load('success');
  assert.equal(calls[0].response.observed, false);
  calls[1].response.next(sample());
  calls[0].response.error(new Error('late error'));
  assert.equal(store.status(), 'success');
  assert.equal(store.orders().length, 6);
});

test('destroying the owning injector unsubscribes a pending load', (t) => {
  const { store, calls, injector } = setup(t);
  store.load();
  assert.equal(calls[0].response.observed, true);
  injector.destroy();
  assert.equal(calls[0].response.observed, false);
});

test('fixture adapter models delayed success, empty, error, and fresh data', async () => {
  const api = new FixtureOrdersApi();
  let synchronous = true;
  const first = firstValueFrom(api.list('success')).then((rows) => {
    assert.equal(synchronous, false);
    return rows;
  });
  const empty = firstValueFrom(api.list('empty'));
  const error = assert.rejects(firstValueFrom(api.list('error')), /Simulated service failure/);
  synchronous = false;
  const rows = await first;
  rows[0].status = 'Delivered';
  assert.equal(ORDER_FIXTURES[0].status, 'Processing');
  assert.deepEqual(await empty, []);
  await error;
});

test('inventory shares state through its injector, prevents negative stock, and resets', (t) => {
  const injector = createEnvironmentInjector([InventoryStore], null);
  t.after(() => injector.destroy());
  const store = injector.get(InventoryStore);
  const baseline = store.available();
  for (let i = 0; i < 6; i++) store.reserve('MON-003');
  assert.equal(injector.get(InventoryStore), store);
  assert.equal(store.items().find((i) => i.sku === 'MON-003').stock, 0);
  assert.equal(store.available(), baseline - 4);
  store.reserve('unknown');
  assert.equal(store.available(), baseline - 4);
  store.reset();
  assert.equal(store.available(), baseline);
});

test('stock rules reject invalid quantities and preserve a zero floor', () => {
  assert.equal(reserveOne(1), 0);
  assert.equal(reserveOne(0), 0);
  for (const value of [-1, 1.5, NaN, Infinity]) assert.throws(() => reserveOne(value));
});

test('shared notification history is bounded, immutable, and newest first', (t) => {
  const injector = createEnvironmentInjector([NotificationService], null);
  t.after(() => injector.destroy());
  const service = injector.get(NotificationService);
  const ids = [];
  for (let i = 0; i < 7; i++) ids.push(service.notify('orders', 'Update ' + i));
  assert.equal(injector.get(NotificationService), service);
  assert.equal(service.messages().length, 5);
  assert.equal(service.latest().message, 'Update 6');
  assert.deepEqual(
    service.messages().map((item) => item.id),
    ids.slice(2).reverse(),
  );
  assert.equal(Object.isFrozen(service.messages()), true);
  assert.equal(Object.isFrozen(service.latest()), true);
  assert.throws(() => service.notify('shell', '   '));
});

test('dismissal and clearing affect the same instance while another application stays isolated', (t) => {
  const host = createEnvironmentInjector([NotificationService], null);
  const standalone = createEnvironmentInjector([NotificationService], null);
  t.after(() => {
    host.destroy();
    standalone.destroy();
  });
  const service = host.get(NotificationService);
  const first = service.notify('orders', 'Order shipped');
  const second = service.notify('inventory', 'Stock reserved');
  service.dismiss(second);
  assert.equal(service.latest().id, first);
  assert.equal(standalone.get(NotificationService).messages().length, 0);
  service.clear();
  assert.equal(service.latest(), null);
  assert.equal(service.messages().length, 0);
  assert.ok(service.notify('shell', 'New notice') > second);
});
