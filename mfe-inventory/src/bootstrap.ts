import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { App } from './app/app';
import { SESSION_CONTEXT, standaloneDemoSession } from '@pulseops/auth-contract';

export const bootstrap = () =>
  bootstrapApplication(App, {
    providers: [
      { provide: SESSION_CONTEXT, useFactory: standaloneDemoSession },
      provideRouter([
        { path: '', pathMatch: 'full', redirectTo: 'inventory' },
        {
          path: 'inventory',
          loadChildren: () => import('./app/inventory.routes').then((m) => m.INVENTORY_ROUTES),
        },
        { path: '**', redirectTo: 'inventory' },
      ]),
    ],
  });
