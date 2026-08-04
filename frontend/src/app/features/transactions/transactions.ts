import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/services/auth.service';
import { AgentService } from '../../core/services/agent.service';
import { ReportingService } from '../../core/services/reporting.service';
import { Agent } from '../../core/models/agent.model';
import { Customer, CustomerWalletSummary } from '../../core/models/customer.model';
import { CustomerStatistics, LedgerEntry, TransactionStatus, TransactionType } from '../../core/models/transaction.model';
import { CurrencyAmountPipe } from '../../shared/pipes/currency-amount.pipe';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import { CustomerWalletPicker, CustomerWalletSelection } from '../../shared/customer-wallet-picker/customer-wallet-picker';

type Mode = 'customer' | 'agent';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [FormsModule, DatePipe, CurrencyAmountPipe, StatusBadge, CustomerWalletPicker],
  templateUrl: './transactions.html',
})
export class Transactions {
  protected readonly auth = inject(AuthService);
  private readonly agentService = inject(AgentService);
  private readonly reportingService = inject(ReportingService);

  // --- Admin-only: look up a customer's report, or an agent's own transaction history ---
  protected readonly mode = signal<Mode>('customer');
  protected readonly agents = signal<Agent[]>([]);
  protected readonly selectedAgentId = signal('');

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

  protected readonly hasSelection = computed(() =>
    this.mode() === 'agent' ? !!this.selectedAgentId() : !!this.selectedCustomer(),
  );

  constructor() {
    if (this.auth.isAdmin()) {
      this.agentService.list().subscribe((agents) => this.agents.set(agents));
    }
  }

  setMode(mode: Mode): void {
    this.mode.set(mode);
    this.selectedCustomer.set(null);
    this.selectedWallet.set(null);
    this.selectedAgentId.set('');
    this.entries.set([]);
    this.stats.set(null);
    this.error.set(null);
  }

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

  onAgentSelected(agentId: string): void {
    this.selectedAgentId.set(agentId);
    if (agentId) {
      this.load();
    } else {
      this.entries.set([]);
    }
  }

  applyFilters(): void {
    this.load();
  }

  private load(): void {
    if (this.mode() === 'agent') {
      this.loadAgentTransactions();
    } else {
      this.loadCustomerReport();
    }
  }

  private loadAgentTransactions(): void {
    const agentId = this.selectedAgentId();
    if (!agentId) {
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

    this.reportingService.agentTransactions(agentId, filters).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load this agent\'s transactions.');
        this.loading.set(false);
      },
    });
  }

  private loadCustomerReport(): void {
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
