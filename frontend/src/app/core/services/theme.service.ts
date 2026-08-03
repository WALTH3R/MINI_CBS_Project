import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'mini_cbs_theme';

export type Theme = 'light' | 'dark';

/** Applies the chosen theme by setting `data-theme` on <html> — styles.css defines a full set
 * of dark-mode CSS custom property overrides keyed off that attribute, so every existing
 * bg-, text-, and border- utility re-themes automatically with no component changes. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly themeSignal = signal<Theme>(this.resolveInitialTheme());

  readonly theme = this.themeSignal.asReadonly();
  readonly isDark = computed(() => this.themeSignal() === 'dark');

  constructor() {
    this.applyTheme(this.themeSignal());
  }

  toggle(): void {
    const next: Theme = this.themeSignal() === 'dark' ? 'light' : 'dark';
    this.themeSignal.set(next);
    localStorage.setItem(STORAGE_KEY, next);
    this.applyTheme(next);
  }

  private resolveInitialTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private applyTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
  }
}
