import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransientSignal } from './transient-signal';

describe('TransientSignal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('makes the value available immediately after set', () => {
    const s = new TransientSignal<string>(1000);
    s.set('hello');
    expect(s.value()).toBe('hello');
  });

  it('starts as null', () => {
    const s = new TransientSignal<string>(1000);
    expect(s.value()).toBeNull();
  });

  it('clears itself after the delay elapses', () => {
    const s = new TransientSignal<string>(1000);
    s.set('hello');
    vi.advanceTimersByTime(999);
    expect(s.value()).toBe('hello');
    vi.advanceTimersByTime(1);
    expect(s.value()).toBeNull();
  });

  it('resets the timer when set is called again before expiry', () => {
    const s = new TransientSignal<string>(1000);
    s.set('first');
    vi.advanceTimersByTime(700);
    s.set('second');
    vi.advanceTimersByTime(700); // 1400ms since 'first', but only 700ms since 'second'
    expect(s.value()).toBe('second');
    vi.advanceTimersByTime(300);
    expect(s.value()).toBeNull();
  });

  it('clears immediately when set to null, without arming a stray timer', () => {
    const s = new TransientSignal<string>(1000);
    s.set('hello');
    s.set(null);
    expect(s.value()).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(s.value()).toBeNull();
  });

  it('defaults to a 15s delay when none is given', () => {
    const s = new TransientSignal<string>();
    s.set('hello');
    vi.advanceTimersByTime(14999);
    expect(s.value()).toBe('hello');
    vi.advanceTimersByTime(1);
    expect(s.value()).toBeNull();
  });
});
