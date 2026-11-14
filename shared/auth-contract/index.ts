import { InjectionToken, signal, type Signal } from '@angular/core';

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly tenantId: string;
}

export interface SessionContext {
  readonly user: Signal<SessionUser | null>;
  readonly status: Signal<'anonymous' | 'authenticated'>;
  logout(): void;
}

// Share this module as a singleton so every remote injects the SAME token.
export const SESSION_CONTEXT = new InjectionToken<SessionContext>('PulseOps session context');

// Only used by standalone development wrappers, never the composed host routes.
export function standaloneDemoSession(): SessionContext {
  return {
    user: signal<SessionUser | null>({
      id: 'standalone-preview',
      email: 'preview@pulseops.demo',
      displayName: 'Standalone preview',
      tenantId: 'demo',
    }).asReadonly(),
    status: signal<'authenticated'>('authenticated').asReadonly(),
    logout: () => window.location.reload(),
  };
}
