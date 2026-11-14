import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { App } from './app/app';
import { SESSION_CONTEXT, standaloneDemoSession } from '@pulseops/auth-contract';

export const bootstrap = () =>
  bootstrapApplication(App, {
    providers: [
      { provide: SESSION_CONTEXT, useFactory: standaloneDemoSession },
      provideRouter(
        [
          { path: '', pathMatch: 'full', redirectTo: 'orders' },
          {
            path: 'orders',
            loadChildren: () => import('./app/orders.routes').then((m) => m.ORDERS_ROUTES),
          },
          { path: '**', redirectTo: 'orders' },
        ],
        withComponentInputBinding(),
      ),
    ],
  });
