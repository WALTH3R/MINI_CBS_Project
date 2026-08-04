import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../core/services/auth.service';
import { MyWalletStore } from '../../core/services/my-wallet.store';
import { MerchantService } from '../../core/services/merchant.service';
import { PaymentService } from '../../core/services/payment.service';
import { Customer, CustomerWalletSummary } from '../../core/models/customer.model';
import { Merchant, MerchantCategory } from '../../core/models/merchant.model';
import { Payment } from '../../core/models/transaction.model';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import { CustomerWalletPicker, CustomerWalletSelection } from '../../shared/customer-wallet-picker/customer-wallet-picker';
import { TransientSignal } from '../../shared/utils/transient-signal';

const CATEGORY_LABELS: Record<MerchantCategory, string> = {
  UTILITIES: 'Utilities',
  TELECOM: 'Telecom & Internet',
  TV: 'Television',
  OTHER: 'Other',
};

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [FormsModule, DatePipe, StatusBadge, CustomerWalletPicker],
  templateUrl: './payments.html',
})
export class Payments {
  protected readonly auth = inject(AuthService);
  protected readonly myWallet = inject(MyWalletStore);
  private readonly merchantService = inject(MerchantService);
  private readonly paymentService = inject(PaymentService);

  protected readonly categoryLabel = (c: MerchantCategory) => CATEGORY_LABELS[c] ?? c;

  // --- Service providers ---
  protected readonly merchants = signal<Merchant[]>([]);
  protected readonly merchantsLoading = signal(true);
  protected readonly categoryFilter = signal<MerchantCategory | ''>('');
  protected readonly merchantSearch = signal('');
  protected readonly visibleMerchants = computed(() => {
    let visible = this.merchants().filter((m) => m.is_active);

    const category = this.categoryFilter();
    if (category) {
      visible = visible.filter((m) => m.category === category);
    }

    const search = this.merchantSearch().trim().toLowerCase();
    if (search) {
      visible = visible.filter((m) => m.name.toLowerCase().includes(search) || m.wallet_tag.toLowerCase().includes(search));
    }

    return visible;
  });

  // --- Customer: pay ---
  protected readonly selectedMerchant = signal<Merchant | null>(null);
  protected readonly amount = signal('');
  protected readonly submitting = signal(false);
  private readonly submitErrorMsg = new TransientSignal<string>();
  protected readonly submitError = this.submitErrorMsg.value;
  private readonly lastPaymentMsg = new TransientSignal<Payment>();
  protected readonly lastPayment = this.lastPaymentMsg.value;

  // --- History ---
  protected readonly history = signal<Payment[]>([]);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal<string | null>(null);
  protected readonly nextPageUrl = signal<string | null>(null);
  protected readonly loadingMore = signal(false);

  // --- Agent: selected customer + wallet ---
  protected readonly selectedCustomer = signal<Customer | null>(null);
  protected readonly selectedWallet = signal<CustomerWalletSummary | null>(null);

  constructor() {
    this.loadAllMerchants();

    if (this.auth.isCustomer()) {
      this.myWallet.ensureLoaded().subscribe({
        error: () => this.historyError.set('Could not load your wallets.'),
      });
      effect(() => {
        const wallet = this.myWallet.activeWallet();
        if (wallet) {
          this.loadHistoryFor(wallet.id);
        }
      });
    }
  }

  onWalletSelected({ customer, wallet }: CustomerWalletSelection): void {
    this.selectedCustomer.set(customer);
    this.selectedWallet.set(wallet);
    this.loadHistoryFor(wallet.id);
  }

  onSelectionCleared(): void {
    this.selectedCustomer.set(null);
    this.selectedWallet.set(null);
    this.history.set([]);
    this.nextPageUrl.set(null);
  }

  loadMore(): void {
    const url = this.nextPageUrl();
    if (!url || this.loadingMore()) {
      return;
    }
    this.loadingMore.set(true);
    this.paymentService.loadMore(url).subscribe({
      next: (response) => {
        this.history.update((history) => [...history, ...response.results]);
        this.nextPageUrl.set(response.next);
        this.loadingMore.set(false);
      },
      error: () => {
        this.historyError.set('Could not load more payments.');
        this.loadingMore.set(false);
      },
    });
  }

  selectMerchant(merchant: Merchant): void {
    this.selectedMerchant.set(merchant);
    this.lastPaymentMsg.set(null);
    this.submitErrorMsg.set(null);
  }

  submitPayment(): void {
    const wallet = this.myWallet.activeWallet();
    const merchant = this.selectedMerchant();
    if (!wallet || !merchant || !this.amount() || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.submitErrorMsg.set(null);
    this.lastPaymentMsg.set(null);

    this.paymentService.create(wallet.id, merchant.wallet_tag, this.amount()).subscribe({
      next: (payment) => {
        this.lastPaymentMsg.set(payment);
        this.amount.set('');
        this.submitting.set(false);
        this.myWallet.refresh().subscribe();
        this.loadHistoryFor(wallet.id);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        if (err instanceof HttpErrorResponse && Array.isArray(err.error)) {
          this.submitErrorMsg.set(err.error.join(' '));
        } else {
          this.submitErrorMsg.set('Could not process this payment. Please try again.');
        }
      },
    });
  }

  private loadHistoryFor(walletId: string): void {
    this.historyLoading.set(true);
    this.historyError.set(null);
    this.paymentService.list(walletId).subscribe({
      next: (response) => {
        this.history.set(response.results);
        this.nextPageUrl.set(response.next);
        this.historyLoading.set(false);
      },
      error: () => {
        this.historyError.set('Could not load payment history.');
        this.historyLoading.set(false);
      },
    });
  }

  // The picker below filters merchants client-side (search + category), so it needs the full
  // catalog rather than one page — follow `next` until exhausted instead of surfacing a "Load more".
  private loadAllMerchants(url?: string, accumulated: Merchant[] = []): void {
    const request = url ? this.merchantService.loadMore<Merchant>(url) : this.merchantService.list();
    request.subscribe({
      next: (response) => {
        const merchants = [...accumulated, ...response.results];
        if (response.next) {
          this.loadAllMerchants(response.next, merchants);
        } else {
          this.merchants.set(merchants);
          this.merchantsLoading.set(false);
        }
      },
      error: () => this.merchantsLoading.set(false),
    });
  }
}
