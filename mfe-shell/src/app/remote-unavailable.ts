import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  imports: [RouterLink],
  template: `<section class="panel empty" role="alert">
    <span class="eyebrow">REMOTE UNAVAILABLE</span>
    <h1>This workspace could not be loaded</h1>
    <p>
      {{ remoteName() }} is unavailable or incompatible. Other available workspaces can still be
      opened.
    </p>
    <p>Start or restore the remote, then reload to retry federation initialization.</p>
    <div class="controls">
      <button class="primary" (click)="reload()">Reload and retry</button>
      <a routerLink="/orders">Orders</a> · <a routerLink="/inventory">Inventory</a>
    </div>
  </section>`,
})
export class RemoteUnavailable {
  readonly remoteName = input('Remote application');
  reload() {
    window.location.reload();
  }
}
