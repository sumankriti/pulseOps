import type { Routes } from '@angular/router';
import type { NativeFederationResult } from '@angular-architects/native-federation-v4';
import { anonymousOnly, requireSession } from './auth/auth.guards';

export const createRoutes = ({ loadRemoteModule }: NativeFederationResult): Routes => {
  const remoteRoutes = async (name: string, exportName: string): Promise<Routes> => {
    try {
      const module = await loadRemoteModule<Record<string, Routes>>(name, './Routes');
      if (!Array.isArray(module[exportName]))
        throw new Error(`Missing route export: ${exportName}`);
      return module[exportName];
    } catch (error) {
      console.error(`Could not load ${name}`, error);
      return [
        {
          path: '**',
          loadComponent: () => import('./remote-unavailable').then((m) => m.RemoteUnavailable),
          data: { remoteName: name },
        },
      ];
    }
  };

  return [
    { path: '', pathMatch: 'full', redirectTo: 'orders' },
    {
      path: 'login',
      canActivate: [anonymousOnly],
      loadComponent: () => import('./auth/login/login').then((m) => m.Login),
    },
    {
      path: '',
      canMatch: [requireSession],
      loadComponent: () => import('./workspace-layout').then((m) => m.WorkspaceLayout),
      children: [
        { path: 'orders', loadChildren: () => remoteRoutes('mfe-orders', 'ORDERS_ROUTES') },
        {
          path: 'inventory',
          loadChildren: () => remoteRoutes('mfe-inventory', 'INVENTORY_ROUTES'),
        },
      ],
    },
    { path: '**', loadComponent: () => import('./not-found').then((m) => m.NotFound) },
  ];
};
