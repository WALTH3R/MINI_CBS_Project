import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly themeService = inject(ThemeService);

  protected readonly features = [
    'Agent-managed customer onboarding',
    'Real-time wallet-to-wallet transfers',
    'Built-in bill pay with full audit trail',
  ];

  protected readonly form = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  // Set by IdleTimeoutService before it redirects here (?reason=idle) — lets someone know why
  // they suddenly landed back on the login page instead of wherever they were.
  protected readonly idleLogoutMessage = signal(
    this.route.snapshot.queryParamMap.get('reason') === 'idle'
      ? "You were signed out after a few minutes of inactivity. Sign back in to continue."
      : null,
  );

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.idleLogoutMessage.set(null);
    this.submitting.set(true);

    const { username, password } = this.form.getRawValue();

    this.auth.login(username, password)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
          this.router.navigateByUrl(returnUrl);
        },
        error: (err: unknown) => {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            // The backend always sends a specific detail here — the generic "wrong credentials"
            // message, or (see accounts/auth.py) one naming a pending/denied signup request.
            this.errorMessage.set(
              typeof err.error?.detail === 'string'
                ? err.error.detail
                : 'Incorrect username or password. Please try again.',
            );
          } else if (err instanceof HttpErrorResponse && err.status === 400) {
            this.errorMessage.set('Incorrect username or password. Please try again.');
          } else if (err instanceof HttpErrorResponse && err.status === 429) {
            this.errorMessage.set('Too many login attempts. Please wait a minute and try again.');
          } else {
            this.errorMessage.set('Something went wrong on our end. Please try again in a moment.');
          }
        },
      });
  }
}
