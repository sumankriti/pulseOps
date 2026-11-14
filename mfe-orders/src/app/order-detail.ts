import { NotificationService } from '@pulseops/notifications';
import { SESSION_CONTEXT } from '@pulseops/auth-contract';
import { Component, computed, inject, input } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OrdersStore } from './orders-store';
@Component({
  imports: [RouterLink, CurrencyPipe],
  template: `<a class="back" routerLink="/orders">← All orders</a>
    <p class="session-context" data-testid="remote-session">
      Demo session: {{ session.user()?.email }}
    </p>
    @if (store.status() === 'idle' || store.status() === 'loading') {
      <section class="panel empty" role="status" aria-busy="true">
        <h1>Loading order…</h1>
        <p>Waiting for demo order data.</p>
      </section>
    } @else if (store.status() === 'error') {
      <section class="panel empty" role="alert">
        <h1>Order data unavailable</h1>
        <p>{{ store.error() }}</p>
        <button class="primary" (click)="store.load()">Retry with demo data</button>
      </section>
    } @else if (order(); as item) {
      <div class="page-heading">
        <div>
          <span class="eyebrow">ORDER DETAILS</span>
          <h1>{{ item.id }}</h1>
          <p>{{ item.customer }} · {{ item.warehouse }} warehouse</p>
        </div>
        <span class="badge" [attr.data-status]="item.status">{{ item.status }}</span>
      </div>
      <section class="panel detail">
        <h2>{{ item.product }}</h2>
        <p>{{ item.sku }} · {{ item.amount | currency }}</p>
        <dl>
          <dt>Customer</dt>
          <dd>{{ item.customer }}</dd>
          <dt>Fulfillment</dt>
          <dd>{{ item.status }}</dd>
          <dt>Latest update</dt>
          <dd>{{ item.updated }}</dd>
        </dl>
        <button
          class="primary"
          [disabled]="item.status === 'Delivered'"
          (click)="advanceOrder(item.id)"
        >
          {{ item.status === 'Delivered' ? 'Delivery complete' : 'Simulate next status' }}
        </button>
        <p class="muted">Simulation: Processing / Delayed → Shipped → Delivered.</p>
        <p role="status">{{ store.lastEvent() }}</p>
      </section>
    } @else {
      <section class="panel empty">
        <h1>Order not found</h1>
        <p>No demo order exists with this identifier.</p>
      </section>
    }`,
})
export class OrderDetail {
  readonly id = input.required<string>();
  readonly notifications = inject(NotificationService);
  readonly session = inject(SESSION_CONTEXT);
  advanceOrder(id: string) {
    const order = this.store.orders().find((order) => order.id === id);
    if (this.store.status() !== 'success' || !order || order.status === 'Delivered') return;
    this.store.advance(id);
    this.notifications.notify('orders', this.store.lastEvent());
  }
  readonly store = inject(OrdersStore);
  constructor() {
    this.store.ensureLoaded();
  }
  readonly order = computed(() => this.store.orders().find((o) => o.id === this.id()));
}
