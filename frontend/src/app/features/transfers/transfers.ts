import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { MyWalletStore } from '../../core/services/my-wallet.store';
import { CustomerService } from '../../core/services/customer.service';
import { TransferService } from '../../core/services/transfer.service';
import { Customer } from '../../core/models/customer.model';
import { Transfer, TransferDirection } from '../../core/models/transaction.model';

@Component({
  selector: 'app-transfers',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './transfers.html',
})
export class Transfers {
  protected readonly auth = inject(AuthService);
  protected readonly myWallet = inject(MyWalletStore);
  private readonly customerService = inject(CustomerService);
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

  // --- Agent: customer lookup ---
  protected readonly searchTerm = signal('');
  protected readonly searchResults = signal<Customer[]>([]);
  protected readonly searching = signal(false);
  protected readonly selectedCustomer = signal<Customer | null>(null);
  private readonly search$ = new Subject<string>();

  constructor() {
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

  submitTransfer(): void {
    const wallet = this.myWallet.wallet();
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
        this.loadMyHistory();
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
    if (this.auth.isCustomer()) {
      this.loadMyHistory();
    } else if (this.selectedCustomer()?.wallet) {
      this.loadHistoryFor(this.selectedCustomer()!.wallet!.id);
    }
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
