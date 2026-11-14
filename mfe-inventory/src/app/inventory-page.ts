import { NotificationService } from '@pulseops/notifications';
import { SESSION_CONTEXT } from '@pulseops/auth-contract';
import { Component, inject } from '@angular/core';
import { InventoryStore } from './inventory-store';
@Component({
  template: `<div class="page-heading">
      <div>
        <span class="eyebrow">WAREHOUSE OPERATIONS</span>
        <h1>Inventory</h1>
        <p>Stock visibility across your fulfillment network.</p>
      </div>
      <span class="demo-pill">Domain 02 · Federated routes</span>
    </div>
    <p class="session-context" data-testid="remote-session">
      Demo session: {{ session.user()?.email }}
    </p>
    <p class="shared-notice" data-testid="remote-notification">
      Latest workspace notice:
      {{ notifications.latest()?.message ?? 'No shared notifications yet.' }}
    </p>
    <div class="stats">
      <article class="stat">
        <span>Tracked products</span><strong>{{ items().length }}</strong
        ><small>Demo catalog</small>
      </article>
      <article class="stat">
        <span>Available units</span><strong>{{ available() }}</strong
        ><small>Stock on hand</small>
      </article>
      <article class="stat attention">
        <span>Low stock</span><strong>{{ lowStock() }}</strong
        ><small>Fewer than 10 units</small>
      </article>
    </div>
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Stock overview</h2>
          <p>Local inventory data, owned by this domain.</p>
        </div>
        <button class="secondary" (click)="reset()">Reset stock</button>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Warehouse</th>
              <th>Available</th>
              <th>Health</th>
              <th>Simulation</th>
            </tr>
          </thead>
          <tbody>
            @for (item of items(); track item.sku) {
              <tr>
                <td>
                  {{ item.name }}<small class="cell-sub">{{ item.sku }}</small>
                </td>
                <td>{{ item.warehouse }}</td>
                <td class="amount">{{ item.stock }}</td>
                <td>
                  <span
                    class="badge"
                    [attr.data-status]="item.stock < 10 ? 'Delayed' : 'Delivered'"
                    >{{ item.stock < 10 ? 'Low stock' : 'Healthy' }}</span
                  >
                </td>
                <td>
                  <button
                    class="secondary"
                    [disabled]="item.stock === 0"
                    (click)="reserve(item.sku)"
                  >
                    Reserve 1
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
    <p class="event-strip" role="status">{{ message() }}</p>
    <div class="architecture-note">
      <span>◇</span>
      <div>
        <strong>Independent domain state</strong>
        <p>
          Reservations are local simulations. Orders is not automatically updated; backend
          coordination and event contracts are future milestones.
        </p>
      </div>
    </div>`,
})
export class InventoryPage {
  readonly notifications = inject(NotificationService);
  readonly session = inject(SESSION_CONTEXT);
  readonly store = inject(InventoryStore);
  readonly items = this.store.items;
  readonly available = this.store.available;
  readonly lowStock = this.store.lowStock;
  readonly message = this.store.message;
  reserve(sku: string) {
    this.store.reserve(sku);
    this.notifications.notify('inventory', this.store.message());
  }
  reset() {
    this.store.reset();
    this.notifications.notify('inventory', this.store.message());
  }
}
