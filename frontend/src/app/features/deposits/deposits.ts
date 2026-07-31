import { Component, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../core/services/auth.service';
import { MyWalletStore } from '../../core/services/my-wallet.store';
import { DepositService } from '../../core/services/deposit.service';
import { Customer, CustomerWalletSummary } from '../../core/models/customer.model';
import { Deposit } from '../../core/models/transaction.model';
import { CurrencyAmountPipe } from '../../shared/pipes/currency-amount.pipe';
import { CustomerWalletPicker, CustomerWalletSelection } from '../../shared/customer-wallet-picker/customer-wallet-picker';

@Component({
  selector: 'app-deposits',
  standalone: true,
  imports: [DatePipe, CurrencyAmountPipe, CustomerWalletPicker],
  templateUrl: './deposits.html',
})
export class Deposits {
  protected readonly auth = inject(AuthService);
  protected readonly myWallet = inject(MyWalletStore);
  private readonly depositService = inject(DepositService);
  private readonly picker = viewChild(CustomerWalletPicker);

  // --- Agent: selected customer + wallet, deposit form ---
  protected readonly selectedCustomer = signal<Customer | null>(null);
  protected readonly selectedWallet = signal<CustomerWalletSummary | null>(null);
  protected readonly amount = signal('');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly lastDeposit = signal<Deposit | null>(null);

  // --- Customer: history ---
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal<string | null>(null);
  protected readonly history = signal<Deposit[]>([]);
  protected readonly minAmountFilter = signal('');
  protected readonly maxAmountFilter = signal('');

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
    this.lastDeposit.set(null);
    this.submitError.set(null);
  }

  onSelectionCleared(): void {
    this.selectedCustomer.set(null);
    this.selectedWallet.set(null);
    this.amount.set('');
    this.lastDeposit.set(null);
  }

  submitDeposit(): void {
    const wallet = this.selectedWallet();
    if (!wallet || !this.amount() || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);

    this.depositService.create(wallet.id, this.amount()).subscribe({
      next: (deposit) => {
        this.lastDeposit.set(deposit);
        this.amount.set('');
        this.submitting.set(false);
        // Refresh the picker's wallet chips and our own copy of the balance.
        this.picker()?.refreshSelectedCustomer();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        if (err instanceof HttpErrorResponse && Array.isArray(err.error)) {
          this.submitError.set(err.error.join(' '));
        } else {
          this.submitError.set('Could not process this deposit. Please try again.');
        }
      },
    });
  }

  applyFilters(): void {
    const wallet = this.myWallet.activeWallet();
    if (wallet) {
      this.loadHistoryFor(wallet.id);
    }
  }

  private loadHistoryFor(walletId: string): void {
    this.historyLoading.set(true);
    this.historyError.set(null);
    this.depositService
      .list(walletId, {
        min_amount: this.minAmountFilter() || undefined,
        max_amount: this.maxAmountFilter() || undefined,
      })
      .subscribe({
        next: (deposits) => {
          this.history.set(deposits);
          this.historyLoading.set(false);
        },
        error: () => {
          this.historyError.set('Could not load your deposit history.');
          this.historyLoading.set(false);
        },
      });
  }
}
