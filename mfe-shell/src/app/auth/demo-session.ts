import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { SessionContext, SessionUser } from '@pulseops/auth-contract';
import { safeReturnUrl } from './return-url';

const STORAGE_KEY = 'pulseops.demo-session.v1';
const DEMO_EMAIL = 'operator@pulseops.demo';
const DEMO_PASSWORD = 'PulseOpsDemo!';
const LIFETIME_MS = 30 * 60 * 1000;

// Learning-only identity. Replace with a server-backed session before real use.
@Injectable({ providedIn: 'root' })
export class DemoSession implements SessionContext {
  private readonly current = signal<SessionUser | null>(null);
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;
  readonly user = this.current.asReadonly();
  readonly status = computed(() =>
    this.user() ? ('authenticated' as const) : ('anonymous' as const),
  );

  constructor() {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
      if (
        saved &&
        typeof saved === 'object' &&
        'email' in saved &&
        saved.email === DEMO_EMAIL &&
        'expiresAt' in saved &&
        typeof saved.expiresAt === 'number' &&
        saved.expiresAt > Date.now() &&
        saved.expiresAt <= Date.now() + LIFETIME_MS
      ) {
        this.activate(saved.expiresAt);
      } else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Storage can be unavailable; the in-memory demo still works. */
    }
    // Background tabs may throttle timers; also check expiry on return.
    const onFocus = () => this.checkExpiry();
    window.addEventListener('focus', onFocus);
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.expiryTimer);
      window.removeEventListener('focus', onFocus);
    });
  }

  private expiresAt = 0;

  async login(email: string, password: string): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) return false;
    const expiresAt = Date.now() + LIFETIME_MS;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ email: DEMO_EMAIL, expiresAt }));
    } catch {
      /* Persistence is optional for the demo. No credentials are stored. */
    }
    this.activate(expiresAt);
    return true;
  }

  private activate(expiresAt: number) {
    this.expiresAt = expiresAt;
    this.current.set({
      id: 'demo-operator',
      email: DEMO_EMAIL,
      displayName: 'Demo operator',
      tenantId: 'northstar-demo',
    });
    clearTimeout(this.expiryTimer);
    this.expiryTimer = setTimeout(() => this.endSession(true), Math.max(0, expiresAt - Date.now()));
  }

  checkExpiry() {
    if (this.user() && Date.now() >= this.expiresAt) this.endSession(true);
  }

  logout() {
    this.endSession(false);
  }

  private endSession(expired: boolean) {
    clearTimeout(this.expiryTimer);
    this.current.set(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* Best effort. */
    }
    const destination = expired
      ? '/login?returnUrl=' +
        encodeURIComponent(safeReturnUrl(location.pathname + location.search + location.hash))
      : '/login';
    // A document reload also destroys remote stores and pending fixture requests.
    window.location.replace(destination);
  }
}
