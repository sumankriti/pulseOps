import { NotificationService } from '@pulseops/notifications';
import { TitleCasePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DemoSession } from './auth/demo-session';

@Component({
  selector: 'app-workspace-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, TitleCasePipe],
  template: ` <a class="skip" href="#main">Skip to content</a>
    <div class="workspace">
      <aside class="sidebar">
        <a class="brand" routerLink="/orders"
          ><span class="brand-icon">P</span>PulseOps<span class="brand-dot">●</span></a
        >
        <div class="workspace-label">COMMERCE WORKSPACE</div>
        <nav aria-label="Main navigation">
          <a routerLink="/orders" routerLinkActive="active" ariaCurrentWhenActive="page"
            ><span aria-hidden="true">▤</span> Orders</a
          >
          <a routerLink="/inventory" routerLinkActive="active" ariaCurrentWhenActive="page"
            ><span aria-hidden="true">▦</span> Inventory</a
          >
        </nav>
        <div class="learning-card">
          <span class="eyebrow">BUILDING PULSEOPS</span><strong>Milestone 04</strong>
          <p>Shared demo session across hosted domains.</p>
          <span class="tag">Native Federation</span>
        </div>
        <div class="profile">
          <span class="avatar">OP</span>
          <div>
            <strong>{{ session.user()?.displayName }}</strong><small>{{
              session.user()?.email
            }}</small>
          </div>
        </div>
        <button class="secondary" (click)="session.logout()">Sign out</button>
      </aside>
      <div class="content">
        <header class="topbar">
          <span>Workspace <span class="muted">/ Operations</span></span
          ><span class="demo-pill">Local demo · In-memory data</span>
        </header>
        <section class="notification-center" aria-label="Notifications">
          <div class="notification-heading">
            <h2>Workspace notifications</h2>
            <button
              class="secondary"
              (click)="notifications.clear()"
              [disabled]="!notifications.messages().length"
            >
              Clear notifications
            </button>
          </div>
          <p
            class="notification-announcement sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {{ notifications.latest()?.message ?? 'No workspace notifications.' }}
          </p>
          @if (notifications.messages().length) {
            <ul class="notification-list">
              @for (notice of notifications.messages(); track notice.id) {
                <li>
                  <span class="notification-source">{{ notice.source | titlecase }}</span><span>{{
                    notice.message
                  }}</span>
                  <button
                    class="notification-dismiss"
                    (click)="notifications.dismiss(notice.id)"
                    [attr.aria-label]="'Dismiss notification ' + notice.id"
                  >
                    ×
                  </button>
                </li>
              }
            </ul>
          } @else {
            <p class="notification-empty">No workspace notifications.</p>
          }
        </section>
        <main id="main" tabindex="-1"><router-outlet /></main>
        <footer>PulseOps learning lab <span>Angular · Signals · Lazy routes</span></footer>
      </div>
    </div>`,
})
export class WorkspaceLayout {
  readonly session = inject(DemoSession);
  readonly notifications = inject(NotificationService);
  constructor() {
    this.notifications.notify('shell', 'Welcome to PulseOps. Your workspace is ready.');
  }
}
