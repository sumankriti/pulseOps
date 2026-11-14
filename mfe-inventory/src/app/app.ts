import { NotificationService } from '@pulseops/notifications';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  template: `<a class="skip" href="#main">Skip to content</a>
    <header class="topbar">
      <a routerLink="/inventory">PulseOps · Inventory</a
      ><span class="demo-pill">Standalone development preview · 4202</span>
    </header>
    <main id="main" tabindex="-1">
      <p class="shared-notice" data-testid="standalone-notification">
        Latest preview notice:
        {{ notifications.latest()?.message ?? 'No shared notifications yet.' }}
      </p>
      <router-outlet />
    </main>`,
})
export class App {
  readonly notifications = inject(NotificationService);
}
