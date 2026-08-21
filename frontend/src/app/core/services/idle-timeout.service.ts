import { Injectable, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const WARNING_DURATION_MS = 30 * 1000;
const ACTIVE_TIMEOUT_MS = IDLE_TIMEOUT_MS - WARNING_DURATION_MS;
// Activity events (mousemove especially) can fire dozens of times a second — no need to reset
// the idle clock on every single one of them.
const RESET_THROTTLE_MS = 1000;
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const;

/**
 * Signs a customer/agent/admin out after IDLE_TIMEOUT_MS of no mouse/keyboard/scroll/touch
 * activity — a "still there?" warning shows for the last WARNING_DURATION_MS of that window.
 * Self-starts/stops based on AuthService.isAuthenticated, so it's inert on /login and /signup.
 *
 * Backgrounded tabs get their setTimeout/setInterval calls throttled or delayed by the browser
 * (sometimes by minutes), so the scheduled warn/logout callbacks can't be trusted to fire on
 * time while hidden. Instead, everything is derived from the absolute `lastResetAt` timestamp,
 * and `reconcile()` re-derives the correct state from the real clock whenever the tab regains
 * visibility — self-correcting for however long it was actually backgrounded, rather than
 * either missing the logout entirely or restarting the warning with a fresh 30s.
 */
@Injectable({ providedIn: 'root' })
export class IdleTimeoutService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly warning = signal(false);
  readonly secondsRemaining = signal(0);

  private warnTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private logoutTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private countdownIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastResetAt = 0;
  private listening = false;

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.start();
      } else {
        this.stop();
      }
    });
  }

  /** Called by the warning modal's "Stay signed in" button — always resets, bypassing the
   * activity throttle, so the button feels immediately responsive. */
  stayActive(): void {
    this.resetTimer();
  }

  private start(): void {
    if (this.listening) {
      return;
    }
    this.listening = true;
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, this.onActivity, { passive: true }));
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.resetTimer();
  }

  private stop(): void {
    if (!this.listening) {
      return;
    }
    this.listening = false;
    ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, this.onActivity));
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.clearTimers();
    this.warning.set(false);
  }

  private onActivity = (): void => {
    if (Date.now() - this.lastResetAt < RESET_THROTTLE_MS) {
      return;
    }
    this.resetTimer();
  };

  /** Merely switching back to this tab isn't activity by itself — only re-checks how much real
   * time has actually passed since the last genuine reset. */
  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.reconcile();
    }
  };

  private resetTimer(): void {
    this.lastResetAt = Date.now();
    this.armFrom(0);
  }

  private reconcile(): void {
    this.armFrom(Date.now() - this.lastResetAt);
  }

  /** Arms whatever timer/warning state is correct given that `elapsedMs` has already passed
   * since the last reset — used both for a fresh reset (elapsedMs=0) and to catch up after the
   * tab was backgrounded for a while. */
  private armFrom(elapsedMs: number): void {
    this.clearTimers();

    if (elapsedMs >= IDLE_TIMEOUT_MS) {
      this.logout();
      return;
    }

    if (elapsedMs >= ACTIVE_TIMEOUT_MS) {
      this.beginWarning(IDLE_TIMEOUT_MS - elapsedMs);
      return;
    }

    this.warning.set(false);
    this.warnTimeoutId = setTimeout(() => this.beginWarning(WARNING_DURATION_MS), ACTIVE_TIMEOUT_MS - elapsedMs);
  }

  private beginWarning(remainingMs: number): void {
    this.warning.set(true);
    let remaining = Math.ceil(remainingMs / 1000);
    this.secondsRemaining.set(remaining);

    this.countdownIntervalId = setInterval(() => {
      remaining -= 1;
      this.secondsRemaining.set(remaining);
    }, 1000);

    this.logoutTimeoutId = setTimeout(() => this.logout(), remainingMs);
  }

  private logout(): void {
    this.clearTimers();
    this.auth.logout();
    this.router.navigate(['/login'], { queryParams: { reason: 'idle' } });
  }

  private clearTimers(): void {
    if (this.warnTimeoutId !== null) clearTimeout(this.warnTimeoutId);
    if (this.logoutTimeoutId !== null) clearTimeout(this.logoutTimeoutId);
    if (this.countdownIntervalId !== null) clearInterval(this.countdownIntervalId);
    this.warnTimeoutId = null;
    this.logoutTimeoutId = null;
    this.countdownIntervalId = null;
  }
}
