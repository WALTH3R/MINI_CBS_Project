import { Signal, WritableSignal, signal } from '@angular/core';

const DEFAULT_DELAY_MS = 5000;


export class TransientSignal<T> {
  private readonly state: WritableSignal<T | null> = signal(null);
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  readonly value: Signal<T | null> = this.state.asReadonly();

  constructor(private readonly delayMs: number = DEFAULT_DELAY_MS) {}

  set(value: T | null): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.state.set(value);
    if (value !== null) {
      this.timeoutId = setTimeout(() => this.state.set(null), this.delayMs);
    }
  }
}
