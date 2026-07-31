import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ReportingService } from '../../core/services/reporting.service';
import { Customer, CustomerWalletSummary } from '../../core/models/customer.model';
import { CustomerStatistics, LedgerEntry, TransactionStatus, TransactionType } from '../../core/models/transaction.model';
import { CurrencyAmountPipe } from '../../shared/pipes/currency-amount.pipe';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import { CustomerWalletPicker, CustomerWalletSelection } from '../../shared/customer-wallet-picker/customer-wallet-picker';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [FormsModule, DatePipe, CurrencyAmountPipe, StatusBadge, CustomerWalletPicker],
  templateUrl: './transactions.html',
})
export class Transactions {
  private readonly reportingService = inject(ReportingService);

  // --- Selected customer + wallet ---
  protected readonly selectedCustomer = signal<Customer | null>(null);
  protected readonly selectedWallet = signal<CustomerWalletSummary | null>(null);

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

  onWalletSelected({ customer, wallet }: CustomerWalletSelection): void {
    this.selectedCustomer.set(customer);
    this.selectedWallet.set(wallet);
    this.load();
  }

  onSelectionCleared(): void {
    this.selectedCustomer.set(null);
    this.selectedWallet.set(null);
    this.entries.set([]);
    this.stats.set(null);
  }

  applyFilters(): void {
    this.load();
  }

  private load(): void {
    const customer = this.selectedCustomer();
    const wallet = this.selectedWallet();
    if (!customer || !wallet) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const filters = {
      type: this.typeFilter() || undefined,
      status: this.statusFilter() || undefined,
      date_from: this.dateFrom() || undefined,
      date_to: this.dateTo() || undefined,
      wallet_id: wallet.id,
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
    // `wallet_id` keeps the totals scoped to a single currency — a customer may hold more than one wallet.
    this.reportingService
      .statistics(customer.id, {
        status: this.statusFilter() || undefined,
        date_from: this.dateFrom() || undefined,
        date_to: this.dateTo() || undefined,
        wallet_id: wallet.id,
      })
      .subscribe({ next: (stats) => this.stats.set(stats) });
  }
}
