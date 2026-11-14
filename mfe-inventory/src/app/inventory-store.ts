import { Injectable, computed, signal } from '@angular/core';
import { reserveOne } from './stock-rules';

const initial = [
  { sku: 'AUD-001', name: 'Studio Headphones', warehouse: 'Bengaluru', stock: 42 },
  { sku: 'KEY-002', name: 'Mechanical Keyboard', warehouse: 'Mumbai', stock: 28 },
  { sku: 'MON-003', name: 'Ultra HD Monitor', warehouse: 'Bengaluru', stock: 4 },
  { sku: 'MOU-004', name: 'Wireless Mouse', warehouse: 'Delhi', stock: 65 },
];

@Injectable({ providedIn: 'root' })
export class InventoryStore {
  private readonly state = signal(initial.map((item) => ({ ...item })));
  private readonly event = signal(
    'Reservations survive navigation. A browser refresh resets this demo.',
  );
  readonly items = this.state.asReadonly();
  readonly message = this.event.asReadonly();
  readonly available = computed(() => this.items().reduce((sum, item) => sum + item.stock, 0));
  readonly lowStock = computed(() => this.items().filter((item) => item.stock < 10).length);

  reserve(sku: string) {
    const item = this.items().find((item) => item.sku === sku);
    if (!item) {
      this.event.set('Product not found.');
      return;
    }
    if (item.stock === 0) {
      this.event.set('No stock available for ' + sku + '.');
      return;
    }
    this.state.update((items) =>
      items.map((item) => (item.sku === sku ? { ...item, stock: reserveOne(item.stock) } : item)),
    );
    this.event.set('Reserved one unit of ' + sku + ' in this local demo.');
  }

  reset() {
    this.state.set(initial.map((item) => ({ ...item })));
    this.event.set('Inventory demo reset.');
  }
}
