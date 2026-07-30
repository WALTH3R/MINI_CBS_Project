import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { MyWalletStore } from '../../core/services/my-wallet.store';
import { DepositService } from '../../core/services/deposit.service';
import { TransferService } from '../../core/services/transfer.service';
import { PaymentService } from '../../core/services/payment.service';
import { Deposit, Transfer, Payment } from '../../core/models/transaction.model';
import { CurrencyAmountPipe } from '../../shared/pipes/currency-amount.pipe';
import { StatusBadge } from '../../shared/status-badge/status-badge';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, CurrencyAmountPipe, StatusBadge],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  protected readonly auth = inject(AuthService);
  protected readonly myWallet = inject(MyWalletStore);
  private readonly depositService = inject(DepositService);
  private readonly transferService = inject(TransferService);
  private readonly paymentService = inject(PaymentService);

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly recentTransfers = signal<Transfer[]>([]);
  protected readonly recentPayments = signal<Payment[]>([]);

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

  constructor() {
    if (this.auth.isCustomer()) {
      this.loadCustomerData();
    }
  }

  private loadCustomerData(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.myWallet.ensureLoaded().subscribe({
      next: (wallet) => {
        forkJoin({
          deposits: this.depositService.list(wallet.id),
          transfers: this.transferService.list(wallet.id),
          payments: this.paymentService.list(wallet.id),
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
      },
      error: () => {
        this.loadError.set('Could not load your wallet.');
        this.loading.set(false);
      },
    });
  }
}
