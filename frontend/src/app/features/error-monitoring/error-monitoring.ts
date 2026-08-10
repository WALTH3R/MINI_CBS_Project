import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ErrorLogService } from '../../core/services/error-log.service';
import { ErrorLogEntry } from '../../core/models/error-log.model';
import { fetchAllPages } from '../../shared/utils/fetch-all-pages.util';
import { downloadCsv } from '../../shared/utils/csv-export.util';

@Component({
  selector: 'app-error-monitoring',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './error-monitoring.html',
})
export class ErrorMonitoring {
  private readonly errorLogService = inject(ErrorLogService);

  // --- Filters ---
  protected readonly exceptionTypeFilter = signal('');
  protected readonly search = signal('');
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');

  // --- Results ---
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly entries = signal<ErrorLogEntry[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly nextPageUrl = signal<string | null>(null);
  protected readonly loadingMore = signal(false);
  protected readonly expandedId = signal<string | null>(null);
  protected readonly exporting = signal(false);

  constructor() {
    this.load();
  }

  toggleTraceback(entry: ErrorLogEntry): void {
    this.expandedId.set(this.expandedId() === entry.id ? null : entry.id);
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
    this.errorLogService.loadMore(url).subscribe({
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

  exportCsv(): void {
    if (this.exporting()) {
      return;
    }

    this.exporting.set(true);
    const filters = {
      exception_type: this.exceptionTypeFilter() || undefined,
      search: this.search() || undefined,
      date_from: this.dateFrom() || undefined,
      date_to: this.dateTo() || undefined,
    };

    fetchAllPages(this.errorLogService.list(filters), (url) => this.errorLogService.loadMore(url)).subscribe({
      next: (entries) => {
        downloadCsv(
          `error-log-${new Date().toISOString().slice(0, 10)}.csv`,
          ['Date', 'User', 'Method', 'Path', 'Exception type', 'Message', 'Traceback'],
          entries.map((e) => [e.created_at, e.username || 'anonymous', e.method, e.path, e.exception_type, e.message, e.traceback]),
        );
        this.exporting.set(false);
      },
      error: () => {
        this.error.set('Could not export the error log.');
        this.exporting.set(false);
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.errorLogService
      .list({
        exception_type: this.exceptionTypeFilter() || undefined,
        search: this.search() || undefined,
        date_from: this.dateFrom() || undefined,
        date_to: this.dateTo() || undefined,
      })
      .subscribe({
        next: (response) => {
          this.entries.set(response.results);
          this.totalCount.set(response.count);
          this.nextPageUrl.set(response.next);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Could not load the error log.');
          this.loading.set(false);
        },
      });
  }
}
