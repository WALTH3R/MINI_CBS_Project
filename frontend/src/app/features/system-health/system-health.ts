import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, startWith, switchMap } from 'rxjs';

import { HealthService } from '../../core/services/health.service';
import { HealthStatus } from '../../core/models/health.model';
import { StatusBadge } from '../../shared/status-badge/status-badge';

const POLL_INTERVAL_MS = 30000;

@Component({
  selector: 'app-system-health',
  standalone: true,
  imports: [DatePipe, StatusBadge],
  templateUrl: './system-health.html',
})
export class SystemHealth {
  private readonly healthService = inject(HealthService);

  protected readonly health = signal<HealthStatus | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly lastCheckedAt = signal<Date | null>(null);

  constructor() {
    interval(POLL_INTERVAL_MS)
      .pipe(startWith(0), switchMap(() => this.healthService.get()), takeUntilDestroyed())
      .subscribe({
        next: (health) => {
          this.health.set(health);
          this.lastCheckedAt.set(new Date());
          this.loading.set(false);
          this.error.set(null);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('Could not load system health. Retrying automatically…');
        },
      });
  }

  refresh(): void {
    this.loading.set(true);
    this.healthService.get().subscribe({
      next: (health) => {
        this.health.set(health);
        this.lastCheckedAt.set(new Date());
        this.loading.set(false);
        this.error.set(null);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load system health.');
      },
    });
  }
}
