import { Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../core/services/auth.service';
import { MyWalletStore } from '../../core/services/my-wallet.store';
import { TransferService } from '../../core/services/transfer.service';
import { Customer, CustomerWalletSummary } from '../../core/models/customer.model';
import { Transfer, TransferDirection } from '../../core/models/transaction.model';
import { CustomerWalletPicker, CustomerWalletSelection } from '../../shared/customer-wallet-picker/customer-wallet-picker';

@Component({
  selector: 'app-transfers',
  standalone: true,
  imports: [FormsModule, DatePipe, CustomerWalletPicker],
  templateUrl: './transfers.html',
})
export class Transfers {
  protected readonly auth = inject(AuthService);
  protected readonly myWallet = inject(MyWalletStore);
  private readonly transferService = inject(TransferService);

  // --- Customer: send money ---
  protected readonly toTag = signal('');
  protected readonly amount = signal('');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly lastTransfer = signal<Transfer | null>(null);

  // --- Shared: history + filters ---
  protected readonly history = signal<Transfer[]>([]);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal<string | null>(null);
  protected readonly directionFilter = signal<TransferDirection | ''>('');

  // --- Agent: selected customer + wallet ---
  protected readonly selectedCustomer = signal<Customer | null>(null);
  protected readonly selectedWallet = signal<CustomerWalletSummary | null>(null);

  constructor() {
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

  submitTransfer(): void {
    const wallet = this.myWallet.activeWallet();
    if (!wallet || !this.toTag() || !this.amount() || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);

    this.transferService.create(wallet.id, this.toTag(), this.amount()).subscribe({
      next: (transfer) => {
        this.lastTransfer.set(transfer);
        this.toTag.set('');
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
          this.submitError.set('Could not complete this transfer. Please try again.');
        }
      },
    });
  }

  applyFilters(): void {
    const wallet = this.auth.isCustomer() ? this.myWallet.activeWallet() : this.selectedWallet();
    if (wallet) {
      this.loadHistoryFor(wallet.id);
    }
  }

  private loadHistoryFor(walletId: string): void {
    this.historyLoading.set(true);
    this.historyError.set(null);
    this.transferService
      .list(walletId, { direction: this.directionFilter() || undefined })
      .subscribe({
        next: (transfers) => {
          this.history.set(transfers);
          this.historyLoading.set(false);
        },
        error: () => {
          this.historyError.set('Could not load transfer history.');
          this.historyLoading.set(false);
        },
      });
  }
}
