import { Injectable, computed, signal } from '@angular/core';

export type NotificationSource = 'shell' | 'orders' | 'inventory';
export interface WorkspaceNotification {
  readonly id: number;
  readonly source: NotificationSource;
  readonly message: string;
}

/** Platform feedback only: business state stays inside its owning domain. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 1;
  private readonly state = signal<readonly WorkspaceNotification[]>(Object.freeze([]));
  readonly messages = this.state.asReadonly();
  readonly latest = computed<WorkspaceNotification | null>(() => this.messages()[0] ?? null);

  notify(source: NotificationSource, message: string): number {
    const text = message.trim();
    if (!text) throw new Error('A notification message must not be empty');
    const notification = Object.freeze({ id: this.nextId++, source, message: text });
    // Bounded history prevents unbounded growth in the long-lived host injector.
    this.state.update((messages) => Object.freeze([notification, ...messages].slice(0, 5)));
    return notification.id;
  }

  dismiss(id: number): void {
    this.state.update((messages) => Object.freeze(messages.filter((message) => message.id !== id)));
  }

  clear(): void {
    this.state.set(Object.freeze([]));
  }
}
