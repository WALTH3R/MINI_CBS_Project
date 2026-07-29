import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { MyWalletStore } from '../../core/services/my-wallet.store';
import { TransferService } from '../../core/services/transfer.service';
import { PaymentService } from '../../core/services/payment.service';
import { Transfer, Payment } from '../../core/models/transaction.model';
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
  private readonly transferService = inject(TransferService);
  private readonly paymentService = inject(PaymentService);

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly recentTransfers = signal<Transfer[]>([]);
  protected readonly recentPayments = signal<Payment[]>([]);

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
          transfers: this.transferService.list(wallet.id),
          payments: this.paymentService.list(wallet.id),
        }).subscribe({
          next: ({ transfers, payments }) => {
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
