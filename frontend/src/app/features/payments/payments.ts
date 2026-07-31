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

  // --- Agent: selected customer + wallet ---
  protected readonly selectedCustomer = signal<Customer | null>(null);
  protected readonly selectedWallet = signal<CustomerWalletSummary | null>(null);

  constructor() {
    this.merchantService.list().subscribe({
      next: (merchants) => {
        this.merchants.set(merchants);
        this.merchantsLoading.set(false);
      },
      error: () => this.merchantsLoading.set(false),
    });

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
  }

  selectMerchant(merchant: Merchant): void {
    this.selectedMerchant.set(merchant);
    this.lastPayment.set(null);
    this.submitError.set(null);
  }

  submitPayment(): void {
    const wallet = this.myWallet.activeWallet();
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
        this.loadHistoryFor(wallet.id);
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
