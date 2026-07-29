import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { CustomerService } from '../../core/services/customer.service';
import { ReportingService } from '../../core/services/reporting.service';
import { Customer } from '../../core/models/customer.model';
import { CustomerStatistics, LedgerEntry, TransactionStatus, TransactionType } from '../../core/models/transaction.model';
import { CurrencyAmountPipe } from '../../shared/pipes/currency-amount.pipe';
import { StatusBadge } from '../../shared/status-badge/status-badge';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [FormsModule, DatePipe, CurrencyAmountPipe, StatusBadge],
  templateUrl: './transactions.html',
})
export class Transactions {
  private readonly customerService = inject(CustomerService);
  private readonly reportingService = inject(ReportingService);

  // --- Customer lookup ---
  protected readonly searchTerm = signal('');
  protected readonly searchResults = signal<Customer[]>([]);
  protected readonly searching = signal(false);
  protected readonly selectedCustomer = signal<Customer | null>(null);
  private readonly search$ = new Subject<string>();

  // --- Filters ---
  protected readonly typeFilter = signal<TransactionType | ''>('');
  protected readonly statusFilter = signal<TransactionStatus | ''>('');
  protected readonly dateFrom = signal('');
  protected readonly dateTo = signal('');

  // --- Results ---
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly entries = signal<LedgerEntry[]>([]);
  protected readonly stats = signal<CustomerStatistics | null>(null);

  constructor() {
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term.trim()) {
            this.searching.set(false);
            return [];
          }
          this.searching.set(true);
          return this.customerService.list(term);
        }),
      )
      .subscribe({
        next: (results) => {
          this.searchResults.set(results);
          this.searching.set(false);
        },
        error: () => this.searching.set(false),
      });
  }

  onSearchInput(term: string): void {
    this.searchTerm.set(term);
    this.search$.next(term);
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer.set(customer);
    this.searchResults.set([]);
    this.searchTerm.set('');
    this.load();
  }

  applyFilters(): void {
    this.load();
  }

  private load(): void {
    const customer = this.selectedCustomer();
    if (!customer) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const filters = {
      type: this.typeFilter() || undefined,
      status: this.statusFilter() || undefined,
      date_from: this.dateFrom() || undefined,
      date_to: this.dateTo() || undefined,
    };

    this.reportingService.transactions(customer.id, filters).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load transactions.');
        this.loading.set(false);
      },
    });

    // Statistics intentionally omit the `type` filter — the four totals are already broken out by type.
    this.reportingService
      .statistics(customer.id, { status: this.statusFilter() || undefined, date_from: this.dateFrom() || undefined, date_to: this.dateTo() || undefined })
      .subscribe({ next: (stats) => this.stats.set(stats) });
  }
}
