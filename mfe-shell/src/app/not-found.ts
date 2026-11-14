import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({
  imports: [RouterLink],
  template: `<section class="panel empty">
    <h1>Page not found</h1>
    <p>This route does not exist.</p>
    <a routerLink="/orders">Return to orders</a>
  </section>`,
})
export class NotFound {}
