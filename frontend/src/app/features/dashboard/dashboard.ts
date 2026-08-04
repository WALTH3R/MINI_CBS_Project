import { Component, computed, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EMPTY, Observable, expand, forkJoin, reduce } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { MyWalletStore } from '../../core/services/my-wallet.store';
import { DepositService } from '../../core/services/deposit.service';
import { TransferService } from '../../core/services/transfer.service';
import { PaymentService } from '../../core/services/payment.service';
import { WalletService } from '../../core/services/wallet.service';
import { Deposit, Transfer, Payment } from '../../core/models/transaction.model';
import { PaginatedResponse } from '../../core/models/pagination.model';
import { Wallet, WalletRequest } from '../../core/models/wallet.model';
import { CurrencyAmountPipe } from '../../shared/pipes/currency-amount.pipe';
import { StatusBadge } from '../../shared/status-badge/status-badge';
import { TransientSignal } from '../../shared/utils/transient-signal';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DecimalPipe, CurrencyAmountPipe, StatusBadge],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  protected readonly auth = inject(AuthService);
  protected readonly myWallet = inject(MyWalletStore);
  private readonly depositService = inject(DepositService);
  private readonly transferService = inject(TransferService);
  private readonly paymentService = inject(PaymentService);
  private readonly walletService = inject(WalletService);

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly recentTransfers = signal<Transfer[]>([]);
  protected readonly recentPayments = signal<Payment[]>([]);

  // --- Pending wallet requests (an agent opened a wallet; needs the customer's confirmation) ---
  protected readonly pendingRequests = signal<WalletRequest[]>([]);
  protected readonly decidingRequestId = signal<string | null>(null);
  private readonly requestErrorMsg = new TransientSignal<string>();
  protected readonly requestError = this.requestErrorMsg.value;

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

  protected balanceUsagePercent(wallet: Wallet): number {
    const max = Number(wallet.profile.max_balance);
    if (!max) {
      return 0;
    }
    return Math.min(100, (Number(wallet.balance) / max) * 100);
  }

  protected dailyTransferUsagePercent(wallet: Wallet): number {
    const max = Number(wallet.profile.max_daily_transfer_total);
    if (!max) {
      return 0;
    }
    return Math.min(100, (this.todayTransferredTotal() / max) * 100);
  }

  private loadWalletData(walletId: string): void {
    this.loading.set(true);
    this.loadError.set(null);

    // The dashboard's totals need every transaction, not just the first page — follow `next`
    // until exhausted rather than surfacing a "Load more" control here.
    forkJoin({
      deposits: this.fetchAllPages(this.depositService.list(walletId), (url) => this.depositService.loadMore(url)),
      transfers: this.fetchAllPages(this.transferService.list(walletId), (url) => this.transferService.loadMore(url)),
      payments: this.fetchAllPages(this.paymentService.list(walletId), (url) => this.paymentService.loadMore(url)),
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

  private fetchAllPages<T>(
    first$: Observable<PaginatedResponse<T>>,
    loadMore: (url: string) => Observable<PaginatedResponse<T>>,
  ): Observable<T[]> {
    return first$.pipe(
      expand((response) => (response.next ? loadMore(response.next) : EMPTY)),
      reduce((all: T[], response) => [...all, ...response.results], [] as T[]),
    );
  }
}
