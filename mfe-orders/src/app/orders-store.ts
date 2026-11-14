import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, defer, map, of, switchMap } from 'rxjs';
import { ORDERS_API, type DemoScenario } from './orders-api';
import { nextStatus, type Order } from './order-rules';

type LoadState =
  | { status: 'idle' | 'loading'; orders: Order[]; error: null }
  | { status: 'success'; orders: Order[]; error: null }
  | { status: 'error'; orders: Order[]; error: string };

@Injectable({ providedIn: 'root' })
export class OrdersStore {
  private readonly api = inject(ORDERS_API);
  private readonly requests = new Subject<DemoScenario>();
  private readonly state = signal<LoadState>({ status: 'idle', orders: [], error: null });
  private readonly event = signal('No simulated updates yet.');
  readonly lastEvent = this.event.asReadonly();
  readonly orders = computed(() => this.state().orders);
  readonly status = computed(() => this.state().status);
  readonly error = computed(() => this.state().error);
  readonly total = computed(() => this.orders().reduce((sum, order) => sum + order.amount, 0));
  readonly processing = computed(
    () => this.orders().filter((o) => o.status === 'Processing').length,
  );
  readonly delayed = computed(() => this.orders().filter((o) => o.status === 'Delayed').length);

  constructor() {
    this.requests
      .pipe(
        // Latest read wins: superseded fixture timers/requests are unsubscribed.
        switchMap((scenario) =>
          defer(() => this.api.list(scenario)).pipe(
            map((orders): LoadState => ({ status: 'success', orders, error: null })),
            // Catch within each request so errors don't terminate future reloads.
            catchError(() =>
              of<LoadState>({
                status: 'error',
                orders: [],
                error: 'Orders could not be loaded. Try again or restore the demo data.',
              }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => {
        this.state.set(state);
        this.event.set(
          state.status === 'error'
            ? 'Demo request failed.'
            : `Loaded ${state.orders.length} demo orders.`,
        );
      });
  }

  ensureLoaded() {
    if (this.status() === 'idle') this.load();
  }

  load(scenario: DemoScenario = 'success') {
    this.state.set({ status: 'loading', orders: [], error: null });
    this.event.set('Loading demo orders…');
    this.requests.next(scenario);
  }

  advance(id: string) {
    if (this.status() !== 'success') return;
    const order = this.orders().find((o) => o.id === id);
    if (!order || order.status === 'Delivered') return;
    const status = nextStatus(order.status);
    this.state.update((state) => ({
      ...state,
      orders: state.orders.map((row) =>
        row.id === id ? { ...row, status, updated: 'Updated by local simulator' } : row,
      ),
    }));
    this.event.set(id + ' changed to ' + status + '.');
  }

  simulate() {
    if (this.status() !== 'success') return;
    const order = this.orders().find((o) => o.status !== 'Delivered');
    if (order) this.advance(order.id);
    else this.event.set('No pending orders. Restore the demo data to run again.');
  }

  reset() {
    this.load();
  }
}
