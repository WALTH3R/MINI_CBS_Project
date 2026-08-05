import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuditLogService } from '../../core/services/audit-log.service';
import { AuditLogEntry } from '../../core/models/audit.model';
import { StatusBadge } from '../../shared/status-badge/status-badge';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [FormsModule, DatePipe, StatusBadge],
  templateUrl: './audit-log.html',
})
export class AuditLog {
  private readonly auditLogService = inject(AuditLogService);

  protected readonly methods = METHODS;

  // --- Filters ---
  protected readonly methodFilter = signal('');
  protected readonly search = signal('');
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');

  // --- Results ---
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly entries = signal<AuditLogEntry[]>([]);
  protected readonly nextPageUrl = signal<string | null>(null);
  protected readonly loadingMore = signal(false);

  constructor() {
    this.load();
  }

  protected resultTone(entry: AuditLogEntry): string {
    return entry.status_code < 400 ? 'COMPLETED' : 'FAILED';
  }

  applyFilters(): void {
    this.load();
  }

  loadMore(): void {
    const url = this.nextPageUrl();
    if (!url || this.loadingMore()) {
      return;
    }
    this.loadingMore.set(true);
    this.auditLogService.loadMore(url).subscribe({
      next: (response) => {
        this.entries.update((entries) => [...entries, ...response.results]);
        this.nextPageUrl.set(response.next);
        this.loadingMore.set(false);
      },
      error: () => {
        this.error.set('Could not load more entries.');
        this.loadingMore.set(false);
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.auditLogService
      .list({
        method: this.methodFilter() || undefined,
        search: this.search() || undefined,
        date_from: this.dateFrom() || undefined,
        date_to: this.dateTo() || undefined,
      })
      .subscribe({
        next: (response) => {
          this.entries.set(response.results);
          this.nextPageUrl.set(response.next);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load the audit log.');
          this.loading.set(false);
        },
      });
  }
}
