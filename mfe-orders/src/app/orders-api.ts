import { Injectable, InjectionToken, inject } from '@angular/core';
import { type Observable, map, timer } from 'rxjs';
import { ORDER_FIXTURES } from './order-fixtures';
import type { Order } from './order-rules';

export type DemoScenario = 'success' | 'empty' | 'error';
export interface OrdersApi {
  list(scenario: DemoScenario): Observable<Order[]>;
}

// Replaceable adapter: models latency and failure, not HTTP or persistence.
@Injectable({ providedIn: 'root' })
export class FixtureOrdersApi implements OrdersApi {
  list(scenario: DemoScenario): Observable<Order[]> {
    return timer(700).pipe(
      map(() => {
        if (scenario === 'error') throw new Error('Simulated service failure');
        return scenario === 'empty' ? [] : ORDER_FIXTURES.map((order) => ({ ...order }));
      }),
    );
  }
}

export const ORDERS_API = new InjectionToken<OrdersApi>('OrdersApi', {
  providedIn: 'root',
  factory: () => inject(FixtureOrdersApi),
});
