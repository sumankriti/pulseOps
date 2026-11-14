import { NotificationService } from '@pulseops/notifications';
import { SESSION_CONTEXT } from '@pulseops/auth-contract';
import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrdersStore } from './orders-store';

@Component({
  imports: [CurrencyPipe, RouterLink],
  template: ` <div class="page-heading">
      <div>
        <span class="eyebrow">OPERATIONS OVERVIEW</span>
        <h1>Orders</h1>
        <p>Every order, from checkout to doorstep.</p>
      </div>
      <button
        class="primary"
        [disabled]="store.status() !== 'success' || !store.orders().length"
        (click)="simulateUpdate()"
      >
        <span aria-hidden="true">ϟ</span> Simulate update
      </button>
    </div>
    <p class="session-context" data-testid="remote-session">
      Demo session: {{ session.user()?.email }}
    </p>
    <p class="shared-notice" data-testid="remote-notification">
      Latest workspace notice:
      {{ notifications.latest()?.message ?? 'No shared notifications yet.' }}
    </p>
    <section class="demo-controls" aria-label="API simulation controls">
      <span>Fixture API · 700 ms latency</span>
      <button class="secondary" (click)="store.load('success')">Load demo data</button>
      <button class="secondary" (click)="store.load('empty')">Load empty response</button>
      <button class="secondary" (click)="store.load('error')">Simulate API failure</button>
    </section>
    @if (store.status() === 'idle' || store.status() === 'loading') {
      <section class="panel empty" role="status" aria-busy="true">
        <h2>Loading orders…</h2>
        <p>Waiting for the asynchronous fixture adapter.</p>
      </section>
    } @else if (store.status() === 'error') {
      <section class="panel empty" role="alert">
        <h2>Orders are unavailable</h2>
        <p>{{ store.error() }}</p>
        <button class="primary" (click)="store.load()">Retry with demo data</button>
      </section>
    } @else if (!store.orders().length) {
      <section class="panel empty">
        <h2>No orders yet</h2>
        <p>The API returned an empty collection. This differs from a search with no matches.</p>
        <button class="primary" (click)="store.load()">Restore demo orders</button>
      </section>
    } @else {
      <div class="stats">
        <article class="stat">
          <span>Total orders</span><strong>{{ store.orders().length }}</strong
          ><small>Across all warehouses</small>
        </article>
        <article class="stat">
          <span>Order value</span
          ><strong>{{ store.total() | currency: 'USD' : 'symbol' : '1.0-0' }}</strong
          ><small>Demo order book · USD</small>
        </article>
        <article class="stat">
          <span>Processing</span><strong>{{ store.processing() }}</strong
          ><small>Ready for fulfillment</small>
        </article>
        <article class="stat attention">
          <span>Needs attention</span><strong>{{ store.delayed() }}</strong
          ><small>Delayed orders</small>
        </article>
      </div>
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Order activity</h2>
            <p>A single view of your fulfillment pipeline.</p>
          </div>
          <button class="secondary" (click)="store.reset()">Reset demo</button>
        </div>
        <div class="toolbar">
          <label class="search"
            ><span aria-hidden="true">⌕</span><span class="sr-only">Search orders</span
            ><input
              placeholder="Search order, customer or product…"
              #orderSearch
              [value]="query()"
              (input)="query.set(orderSearch.value)" /></label
          ><label class="filter"
            >Status
            <select #statusFilter [value]="status()" (change)="status.set(statusFilter.value)">
              <option>All statuses</option>
              <option>Processing</option>
              <option>Shipped</option>
              <option>Delivered</option>
              <option>Delayed</option>
            </select></label
          >
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order / Customer</th>
                <th>Product</th>
                <th>Status</th>
                <th>Warehouse</th>
                <th>Amount</th>
                <th><span class="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody>
              @for (order of filtered(); track order.id) {
                <tr>
                  <td>
                    <a class="order-id" [routerLink]="['/orders', order.id]">{{ order.id }}</a>
                    <div class="customer">{{ order.customer }}</div>
                  </td>
                  <td>
                    {{ order.product }}<small class="cell-sub">{{ order.sku }}</small>
                  </td>
                  <td>
                    <span class="badge" [attr.data-status]="order.status">{{ order.status }}</span>
                  </td>
                  <td>{{ order.warehouse }}</td>
                  <td class="amount">{{ order.amount | currency }}</td>
                  <td>
                    <a
                      class="arrow"
                      [routerLink]="['/orders', order.id]"
                      [attr.aria-label]="'View ' + order.id"
                      >↗</a
                    >
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="empty">
                    No orders match your filters. Try another search or status.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="table-footer">
          Showing {{ filtered().length }} of {{ store.orders().length }} orders
          <span>Demo dataset</span>
        </div>
      </section>
    }
    <div class="event-strip" role="status">
      <span class="event-dot"></span><strong>Local event simulator</strong
      ><span>{{ store.lastEvent() }}</span>
    </div>
    <div class="architecture-note">
      <span aria-hidden="true">◇</span>
      <div>
        <strong>Architecture in practice</strong>
        <p>
          Orders owns its state. The shell loads orders and inventory from remote entries at
          runtime. Orders uses an asynchronous fixture adapter; no backend is connected.
        </p>
      </div>
    </div>`,
})
export class OrdersPage {
  readonly notifications = inject(NotificationService);
  readonly session = inject(SESSION_CONTEXT);
  simulateUpdate() {
    if (this.store.status() !== 'success' || !this.store.orders().length) return;
    this.store.simulate();
    this.notifications.notify('orders', this.store.lastEvent());
  }
  readonly store = inject(OrdersStore);
  constructor() {
    this.store.ensureLoaded();
  }
  readonly query = signal('');
  readonly status = signal('All statuses');
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.store
      .orders()
      .filter(
        (o) =>
          (this.status() === 'All statuses' || o.status === this.status()) &&
          `${o.id} ${o.customer} ${o.product} ${o.sku}`.toLowerCase().includes(q),
      );
  });
}
