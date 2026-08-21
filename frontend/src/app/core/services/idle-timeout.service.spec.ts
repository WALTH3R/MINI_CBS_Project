import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';
import { IdleTimeoutService } from './idle-timeout.service';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const WARNING_DURATION_MS = 30 * 1000;
const ACTIVE_TIMEOUT_MS = IDLE_TIMEOUT_MS - WARNING_DURATION_MS;

function setup() {
  const isAuthenticated = signal(false);
  const logout = vi.fn();
  const navigate = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: { isAuthenticated, logout } },
      { provide: Router, useValue: { navigate } },
    ],
  });

  const service = TestBed.inject(IdleTimeoutService);
  TestBed.tick();

  return { service, isAuthenticated, logout, navigate };
}

function signIn(isAuthenticated: ReturnType<typeof signal<boolean>>) {
  isAuthenticated.set(true);
  TestBed.tick();
}

function setVisibility(state: 'visible' | 'hidden') {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('IdleTimeoutService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing while not authenticated', () => {
    const { service } = setup();
    vi.advanceTimersByTime(IDLE_TIMEOUT_MS + 1000);
    expect(service.warning()).toBe(false);
  });

  it('shows a warning once the active window elapses', () => {
    const { service, isAuthenticated } = setup();
    signIn(isAuthenticated);

    vi.advanceTimersByTime(ACTIVE_TIMEOUT_MS - 1);
    expect(service.warning()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(service.warning()).toBe(true);
    expect(service.secondsRemaining()).toBe(30);
  });

  it('counts down the seconds remaining during the warning', () => {
    const { service, isAuthenticated } = setup();
    signIn(isAuthenticated);

    vi.advanceTimersByTime(ACTIVE_TIMEOUT_MS);
    expect(service.secondsRemaining()).toBe(30);
    vi.advanceTimersByTime(1000);
    expect(service.secondsRemaining()).toBe(29);
  });

  it('logs out and redirects once the warning period elapses with no activity', () => {
    const { service, isAuthenticated, logout, navigate } = setup();
    signIn(isAuthenticated);

    vi.advanceTimersByTime(ACTIVE_TIMEOUT_MS);
    expect(service.warning()).toBe(true);
    vi.advanceTimersByTime(WARNING_DURATION_MS);

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'idle' } });
  });

  it('activity before the warning resets the clock', () => {
    const { service, isAuthenticated } = setup();
    signIn(isAuthenticated);

    vi.advanceTimersByTime(ACTIVE_TIMEOUT_MS - 1000);
    window.dispatchEvent(new Event('mousemove'));
    vi.advanceTimersByTime(1000);
    expect(service.warning()).toBe(false); // would've fired at this point without the reset
  });

  it('throttles rapid activity instead of resetting the clock on every single event', () => {
    const { service, isAuthenticated } = setup();
    signIn(isAuthenticated);

    vi.advanceTimersByTime(1000);
    window.dispatchEvent(new Event('mousemove')); // a real reset, anchored at t=1000

    // Nine more events, 100ms apart (t=1100..1900) — each within 1s of the t=1000 reset, so
    // every one of these should be throttled away rather than pushing the deadline further out.
    for (let i = 0; i < 9; i++) {
      vi.advanceTimersByTime(100);
      window.dispatchEvent(new Event('mousemove'));
    }

    // If the throttle held, the deadline is still anchored at t=1000 (not pushed to t=1900) —
    // this lands exactly on it: 1900 + (ACTIVE_TIMEOUT_MS - 900) = 1000 + ACTIVE_TIMEOUT_MS.
    vi.advanceTimersByTime(ACTIVE_TIMEOUT_MS - 900);
    expect(service.warning()).toBe(true);
  });

  it('stayActive dismisses the warning and restarts the full timer', () => {
    const { service, isAuthenticated, logout } = setup();
    signIn(isAuthenticated);

    vi.advanceTimersByTime(ACTIVE_TIMEOUT_MS);
    expect(service.warning()).toBe(true);

    service.stayActive();
    expect(service.warning()).toBe(false);

    vi.advanceTimersByTime(WARNING_DURATION_MS); // would've logged out if not reset
    expect(service.warning()).toBe(false);
    expect(logout).not.toHaveBeenCalled();
  });

  it('logs out immediately on becoming visible if the tab was backgrounded past the full timeout', () => {
    const { isAuthenticated, logout, navigate } = setup();
    signIn(isAuthenticated);

    // Simulate a backgrounded tab: the wall clock moves well past the full idle timeout, but
    // (as browsers throttle timers in hidden tabs) the scheduled logout callback never got to
    // fire on its own — only setSystemTime, not advanceTimersByTime, so nothing runs yet.
    vi.setSystemTime(Date.now() + IDLE_TIMEOUT_MS + 60_000);
    expect(logout).not.toHaveBeenCalled();

    setVisibility('visible');

    expect(logout).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'idle' } });
  });

  it('shows the true remaining time, not a fresh 30s, if the tab returns partway into the warning window', () => {
    const { service, isAuthenticated } = setup();
    signIn(isAuthenticated);

    // Backgrounded 10s into what should be the 30s warning window.
    vi.setSystemTime(Date.now() + ACTIVE_TIMEOUT_MS + 10_000);
    setVisibility('visible');

    expect(service.warning()).toBe(true);
    expect(service.secondsRemaining()).toBe(20);
  });

  it('does not treat merely returning to the tab as activity that resets the clock', () => {
    const { service, isAuthenticated } = setup();
    signIn(isAuthenticated);

    vi.setSystemTime(Date.now() + ACTIVE_TIMEOUT_MS + 10_000);
    setVisibility('visible');
    expect(service.secondsRemaining()).toBe(20);

    // If toggling visibility alone counted as activity, this would jump back up to 30.
    setVisibility('hidden');
    setVisibility('visible');
    expect(service.secondsRemaining()).toBe(20);
  });

  it('stops tracking and hides the warning when auth state flips to false', () => {
    const { service, isAuthenticated, logout } = setup();
    signIn(isAuthenticated);

    vi.advanceTimersByTime(ACTIVE_TIMEOUT_MS);
    expect(service.warning()).toBe(true);

    isAuthenticated.set(false);
    TestBed.tick();
    expect(service.warning()).toBe(false);

    vi.advanceTimersByTime(WARNING_DURATION_MS);
    expect(logout).not.toHaveBeenCalled();
  });
});
