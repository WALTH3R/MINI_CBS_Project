import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { MyWalletStore } from '../../core/services/my-wallet.store';
import { CustomerService } from '../../core/services/customer.service';
import { MerchantService } from '../../core/services/merchant.service';
import { PaymentService } from '../../core/services/payment.service';
import { Customer } from '../../core/models/customer.model';
import { Merchant, MerchantCategory } from '../../core/models/merchant.model';
import { Payment } from '../../core/models/transaction.model';
import { StatusBadge } from '../../shared/status-badge/status-badge';

const CATEGORY_LABELS: Record<MerchantCategory, string> = {
  UTILITIES: 'Utilities',
  TELECOM: 'Telecom & Internet',
  TV: 'Television',
  OTHER: 'Other',
};

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [FormsModule, DatePipe, StatusBadge],
  templateUrl: './payments.html',
})
export class Payments {
  protected readonly auth = inject(AuthService);
  protected readonly myWallet = inject(MyWalletStore);
  private readonly customerService = inject(CustomerService);
  private readonly merchantService = inject(MerchantService);
  private readonly paymentService = inject(PaymentService);

  protected readonly categoryLabel = (c: MerchantCategory) => CATEGORY_LABELS[c] ?? c;

  // --- Service providers ---
  protected readonly merchants = signal<Merchant[]>([]);
  protected readonly merchantsLoading = signal(true);
  protected readonly categoryFilter = signal<MerchantCategory | ''>('');
  protected readonly visibleMerchants = computed(() => {
    const active = this.merchants().filter((m) => m.is_active);
    const category = this.categoryFilter();
    return category ? active.filter((m) => m.category === category) : active;
  });

  // --- Customer: pay ---
  protected readonly selectedMerchant = signal<Merchant | null>(null);
  protected readonly amount = signal('');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly lastPayment = signal<Payment | null>(null);

  // --- History ---
  protected readonly history = signal<Payment[]>([]);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal<string | null>(null);

  // --- Agent: customer lookup ---
  protected readonly searchTerm = signal('');
  protected readonly searchResults = signal<Customer[]>([]);
  protected readonly searching = signal(false);
  protected readonly selectedCustomer = signal<Customer | null>(null);
  private readonly search$ = new Subject<string>();

  constructor() {
    this.merchantService.list().subscribe({
      next: (merchants) => {
        this.merchants.set(merchants);
        this.merchantsLoading.set(false);
      },
      error: () => this.merchantsLoading.set(false),
    });

    if (this.auth.isCustomer()) {
      this.loadMyHistory();
    }

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
    if (customer.wallet) {
      this.loadHistoryFor(customer.wallet.id);
    }
  }

  selectMerchant(merchant: Merchant): void {
    this.selectedMerchant.set(merchant);
    this.lastPayment.set(null);
    this.submitError.set(null);
  }

  submitPayment(): void {
    const wallet = this.myWallet.wallet();
    const merchant = this.selectedMerchant();
    if (!wallet || !merchant || !this.amount() || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);
    this.lastPayment.set(null);

    this.paymentService.create(wallet.id, merchant.wallet_tag, this.amount()).subscribe({
      next: (payment) => {
        this.lastPayment.set(payment);
        this.amount.set('');
        this.submitting.set(false);
        this.myWallet.refresh().subscribe();
        this.loadMyHistory();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        if (err instanceof HttpErrorResponse && Array.isArray(err.error)) {
          this.submitError.set(err.error.join(' '));
        } else {
          this.submitError.set('Could not process this payment. Please try again.');
        }
      },
    });
  }

  private loadMyHistory(): void {
    this.myWallet.ensureLoaded().subscribe({
      next: (wallet) => this.loadHistoryFor(wallet.id),
      error: () => this.historyError.set('Could not load your wallet.'),
    });
  }

  private loadHistoryFor(walletId: string): void {
    this.historyLoading.set(true);
    this.historyError.set(null);
    this.paymentService.list(walletId).subscribe({
      next: (payments) => {
        this.history.set(payments);
        this.historyLoading.set(false);
      },
      error: () => {
        this.historyError.set('Could not load payment history.');
        this.historyLoading.set(false);
      },
    });
  }
}
