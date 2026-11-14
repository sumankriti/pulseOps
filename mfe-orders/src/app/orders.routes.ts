import type { Routes } from '@angular/router';

// Public composition surface. The shell does not import domain internals.
export const ORDERS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./orders-page').then((m) => m.OrdersPage),
  },
  { path: ':id', loadComponent: () => import('./order-detail').then((m) => m.OrderDetail) },
];
