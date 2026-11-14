import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DemoSession } from '../demo-session';
import { safeReturnUrl } from '../return-url';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: ` <main class="login-page">
    <section class="login-card" aria-labelledby="login-heading">
      <a class="brand" href="/login"><span class="brand-icon">P</span>PulseOps</a>
      <span class="eyebrow">COMMERCE OPERATIONS</span>
      <h1 id="login-heading">Sign in to your workspace</h1>
      <p>One demo session for orders and inventory.</p>
      <div class="login-demo">
        <strong>Demo account</strong><br />
        Email: <code>operator@pulseops.demo</code><br />
        Password: <code>PulseOpsDemo!</code>
        <p>Learning demo only. Credentials are checked locally; use the sample account.</p>
      </div>
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          formControlName="email"
          autocomplete="username"
          aria-describedby="email-error"
          [attr.aria-invalid]="form.controls.email.touched && form.controls.email.invalid"
        />
        <p id="email-error" class="field-error">
          @if (form.controls.email.touched && form.controls.email.invalid) {
            Enter a valid email address.
          }
        </p>
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          formControlName="password"
          autocomplete="current-password"
          aria-describedby="password-error"
          [attr.aria-invalid]="form.controls.password.touched && form.controls.password.invalid"
        />
        <p id="password-error" class="field-error">
          @if (form.controls.password.touched && form.controls.password.invalid) {
            Enter your password.
          }
        </p>
        @if (message()) {
          <p class="login-error" role="alert">{{ message() }}</p>
        }
        <button class="primary" type="submit" [disabled]="pending()">
          {{ pending() ? 'Signing in…' : 'Sign in' }}
        </button>
        <p class="muted">Demo sessions last 30 minutes in this tab. No password is stored.</p>
      </form>
    </section>
  </main>`,
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly session = inject(DemoSession);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly message = signal('');
  readonly pending = signal(false);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async submit(): Promise<void> {
    if (this.pending()) return;
    this.message.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.pending.set(true);
    const { email, password } = this.form.getRawValue();
    try {
      if (!(await this.session.login(email, password))) {
        this.message.set('Email or password is incorrect. Use the demo account shown above.');
        return;
      }
      // Session is populated before the destination's guard runs.
      await this.router.navigateByUrl(
        safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
        { replaceUrl: true },
      );
    } catch {
      this.message.set('Sign-in could not complete. Please try again.');
    } finally {
      this.form.controls.password.reset();
      this.pending.set(false);
    }
  }
}
