import { Component, computed, effect, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';

import { FormsModule } from '@angular/forms';

import { AuthService } from '../../core/services/auth.service';
import { MyWalletStore } from '../../core/services/my-wallet.store';
import { DepositService } from '../../core/services/deposit.service';
import { TransferService } from '../../core/services/transfer.service';
import { PaymentService } from '../../core/services/payment.service';
import { WalletService } from '../../core/services/wallet.service';
import { CustomerService } from '../../core/services/customer.service';
import { Deposit, Transfer, Payment } from '../../core/models/transaction.model';
import { Wallet, WalletProfile, WalletRequest } from '../../core/models/wallet.model';
import { Customer } from '../../core/models/customer.model';
import { CurrencyAmountPipe } from '../../shared/pipes/currency-amount.pipe';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import { TransientSignal } from '../../shared/utils/transient-signal';
import { fetchAllPages } from '../../shared/utils/fetch-all-pages.util';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe, FormsModule, CurrencyAmountPipe, StatusBadge],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  protected readonly auth = inject(AuthService);
  protected readonly myWallet = inject(MyWalletStore);
  private readonly depositService = inject(DepositService);
  private readonly transferService = inject(TransferService);
  private readonly paymentService = inject(PaymentService);
  private readonly walletService = inject(WalletService);
  private readonly customerService = inject(CustomerService);

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly recentTransfers = signal<Transfer[]>([]);
  protected readonly recentPayments = signal<Payment[]>([]);

  // --- Pending wallet requests (an agent opened a wallet; needs the customer's confirmation) ---
  protected readonly pendingRequests = signal<WalletRequest[]>([]);
  protected readonly decidingRequestId = signal<string | null>(null);
  private readonly requestErrorMsg = new TransientSignal<string>();
  protected readonly requestError = this.requestErrorMsg.value;

  // --- Admin: pending signup requests (public self-registration awaiting approval/denial) ---
  protected readonly pendingSignups = signal<Customer[]>([]);
  protected readonly walletProfiles = signal<WalletProfile[]>([]);
  protected readonly approvingSignupId = signal<string | null>(null);
  protected readonly signupWalletProfileId = signal('');
  protected readonly decidingSignupId = signal<string | null>(null);
  private readonly signupErrorMsg = new TransientSignal<string>();
  protected readonly signupError = this.signupErrorMsg.value;

  // --- Customer's own daily transfer limit (capped by the wallet profile's limit) ---
  protected readonly editingDailyLimit = signal(false);
  protected readonly dailyLimitInput = signal('');
  protected readonly savingDailyLimit = signal(false);
  private readonly dailyLimitErrorMsg = new TransientSignal<string>();
  protected readonly dailyLimitError = this.dailyLimitErrorMsg.value;

  private readonly deposits = signal<Deposit[]>([]);
  private readonly transfers = signal<Transfer[]>([]);
  private readonly payments = signal<Payment[]>([]);

  // Deposits and transfers have no pending/failed state (they either succeed or are
  // rejected outright), so every row already reflects money that moved. Payments are the
  // only type that can persist as FAILED (Topic 4), so those must be excluded from totals.
  protected readonly stats = computed(() => {
    const deposits = this.deposits();
    const transfers = this.transfers();
    const completedPayments = this.payments().filter((p) => p.status === 'COMPLETED');

    const sum = (amounts: string[]) => amounts.reduce((total, a) => total + Number(a), 0);

    return {
      totalDeposited: sum(deposits.map((d) => d.amount)),
      totalTransferred: sum(transfers.filter((t) => t.direction === 'DEBIT').map((t) => t.amount)),
      totalPaidBills: sum(completedPayments.map((p) => p.amount)),
      totalTransactions: deposits.length + transfers.length + this.payments().length,
    };
  });

  // Mirrors the daily-limit check in wallets/services.py:do_transfer — outgoing transfers
  // (direction DEBIT) dated today, in the browser's local calendar day.
  protected readonly todayTransferredTotal = computed(() => {
    const today = new Date().toDateString();
    return this.transfers()
      .filter((t) => t.direction === 'DEBIT' && new Date(t.created_at).toDateString() === today)
      .reduce((total, t) => total + Number(t.amount), 0);
  });

  constructor() {
    if (this.auth.isCustomer()) {
      this.myWallet.ensureLoaded().subscribe({
        error: () => this.loadError.set('Could not load your wallets.'),
      });

      // Re-runs on initial load and whenever the Shell's wallet switcher changes selection.
      effect(() => {
        const wallet = this.myWallet.activeWallet();
        if (wallet) {
          this.loadWalletData(wallet.id);
        }
      });

      // Account-level, not wallet-scoped — loaded once, independent of the active wallet.
      this.walletService.listMyRequests().subscribe({
        next: (requests) => this.pendingRequests.set(requests),
        error: () => this.requestErrorMsg.set('Could not load pending wallet requests.'),
      });
    }

    if (this.auth.isAdmin()) {
      this.customerService.listPendingSignups().subscribe({
        next: (signups) => this.pendingSignups.set(signups),
        error: () => this.signupErrorMsg.set('Could not load pending signup requests.'),
      });
      this.walletService.listProfiles().subscribe((profiles) => this.walletProfiles.set(profiles));
    }
  }

  confirmWalletRequest(request: WalletRequest): void {
    if (this.decidingRequestId()) {
      return;
    }
    this.decidingRequestId.set(request.id);

    this.walletService.confirmRequest(request.id).subscribe({
      next: (wallet) => {
        this.pendingRequests.update((requests) => requests.filter((r) => r.id !== request.id));
        this.decidingRequestId.set(null);
        this.myWallet.refresh().subscribe(() => this.myWallet.selectWallet(wallet.id));
      },
      error: () => {
        this.decidingRequestId.set(null);
        this.requestErrorMsg.set('Could not confirm this wallet request. Please try again.');
      },
    });
  }

  declineWalletRequest(request: WalletRequest): void {
    if (this.decidingRequestId()) {
      return;
    }
    this.decidingRequestId.set(request.id);

    this.walletService.declineRequest(request.id).subscribe({
      next: () => {
        this.pendingRequests.update((requests) => requests.filter((r) => r.id !== request.id));
        this.decidingRequestId.set(null);
      },
      error: () => {
        this.decidingRequestId.set(null);
        this.requestErrorMsg.set('Could not decline this wallet request. Please try again.');
      },
    });
  }

  startApproveSignup(customer: Customer): void {
    this.approvingSignupId.set(customer.id);
    this.signupWalletProfileId.set('');
    this.signupErrorMsg.set(null);
  }

  cancelApproveSignup(): void {
    this.approvingSignupId.set(null);
  }

  confirmApproveSignup(customer: Customer): void {
    if (!this.signupWalletProfileId() || this.decidingSignupId()) {
      return;
    }
    this.decidingSignupId.set(customer.id);

    this.customerService.approveSignup(customer.id, this.signupWalletProfileId()).subscribe({
      next: () => {
        this.pendingSignups.update((signups) => signups.filter((s) => s.id !== customer.id));
        this.decidingSignupId.set(null);
        this.approvingSignupId.set(null);
      },
      error: () => {
        this.decidingSignupId.set(null);
        this.signupErrorMsg.set('Could not approve this signup request. Please try again.');
      },
    });
  }

  denySignup(customer: Customer): void {
    if (this.decidingSignupId()) {
      return;
    }
    this.decidingSignupId.set(customer.id);

    this.customerService.denySignup(customer.id).subscribe({
      next: () => {
        this.pendingSignups.update((signups) => signups.filter((s) => s.id !== customer.id));
        this.decidingSignupId.set(null);
      },
      error: () => {
        this.decidingSignupId.set(null);
        this.signupErrorMsg.set('Could not deny this signup request. Please try again.');
      },
    });
  }

  protected balanceUsagePercent(wallet: Wallet): number {
    const max = Number(wallet.profile.max_balance);
    if (!max) {
      return 0;
    }
    return Math.min(100, (Number(wallet.balance) / max) * 100);
  }

  protected dailyTransferUsagePercent(wallet: Wallet): number {
    const max = Number(wallet.effective_daily_transfer_limit);
    if (!max) {
      return 0;
    }
    return Math.min(100, (this.todayTransferredTotal() / max) * 100);
  }

  startEditDailyLimit(wallet: Wallet): void {
    this.dailyLimitInput.set(wallet.daily_transfer_limit ?? '');
    this.dailyLimitErrorMsg.set(null);
    this.editingDailyLimit.set(true);
  }

  cancelEditDailyLimit(): void {
    this.editingDailyLimit.set(false);
    this.dailyLimitErrorMsg.set(null);
  }

  /** Clears the customer's personal override, reverting to the wallet profile's daily limit. */
  resetDailyLimit(wallet: Wallet): void {
    this.saveDailyLimit(wallet, null);
  }

  submitDailyLimit(wallet: Wallet): void {
    const raw = this.dailyLimitInput().trim();
    if (!raw) {
      this.dailyLimitErrorMsg.set('Enter an amount, or use "Reset to profile default" instead.');
      return;
    }
    this.saveDailyLimit(wallet, raw);
  }

  private saveDailyLimit(wallet: Wallet, value: string | null): void {
    if (this.savingDailyLimit()) {
      return;
    }
    this.savingDailyLimit.set(true);
    this.dailyLimitErrorMsg.set(null);

    this.walletService.setDailyLimit(wallet.id, value).subscribe({
      next: () => {
        this.savingDailyLimit.set(false);
        this.editingDailyLimit.set(false);
        this.myWallet.refresh().subscribe();
      },
      error: (err: unknown) => {
        this.savingDailyLimit.set(false);
        if (err instanceof HttpErrorResponse && Array.isArray(err.error?.daily_transfer_limit)) {
          this.dailyLimitErrorMsg.set(err.error.daily_transfer_limit.join(' '));
        } else {
          this.dailyLimitErrorMsg.set('Could not update your daily limit. Please try again.');
        }
      },
    });
  }

  private loadWalletData(walletId: string): void {
    this.loading.set(true);
    this.loadError.set(null);

    // The dashboard's totals need every transaction, not just the first page — follow `next`
    // until exhausted rather than surfacing a "Load more" control here.
    forkJoin({
      deposits: fetchAllPages(this.depositService.list(walletId), (url) => this.depositService.loadMore(url)),
      transfers: fetchAllPages(this.transferService.list(walletId), (url) => this.transferService.loadMore(url)),
      payments: fetchAllPages(this.paymentService.list(walletId), (url) => this.paymentService.loadMore(url)),
    }).subscribe({
      next: ({ deposits, transfers, payments }) => {
        this.deposits.set(deposits);
        this.transfers.set(transfers);
        this.payments.set(payments);
        this.recentTransfers.set(transfers.slice(0, 5));
        this.recentPayments.set(payments.slice(0, 5));
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load your recent activity.');
        this.loading.set(false);
      },
    });
  }
}
