import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { MyWalletStore } from '../../core/services/my-wallet.store';
import { CustomerService } from '../../core/services/customer.service';
import { DepositService } from '../../core/services/deposit.service';
import { Customer } from '../../core/models/customer.model';
import { Deposit } from '../../core/models/transaction.model';
import { CurrencyAmountPipe } from '../../shared/pipes/currency-amount.pipe';

@Component({
  selector: 'app-deposits',
  standalone: true,
  imports: [FormsModule, DatePipe, CurrencyAmountPipe],
  templateUrl: './deposits.html',
})
export class Deposits {
  protected readonly auth = inject(AuthService);
  protected readonly myWallet = inject(MyWalletStore);
  private readonly customerService = inject(CustomerService);
  private readonly depositService = inject(DepositService);

  // --- Agent: search + deposit ---
  protected readonly searchTerm = signal('');
  protected readonly searchResults = signal<Customer[]>([]);
  protected readonly searching = signal(false);
  protected readonly selectedCustomer = signal<Customer | null>(null);
  protected readonly amount = signal('');
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly lastDeposit = signal<Deposit | null>(null);

  private readonly search$ = new Subject<string>();

  // --- Customer: history ---
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal<string | null>(null);
  protected readonly history = signal<Deposit[]>([]);
  protected readonly minAmountFilter = signal('');
  protected readonly maxAmountFilter = signal('');

  constructor() {
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

    if (this.auth.isCustomer()) {
      this.loadHistory();
    }
  }

  onSearchInput(term: string): void {
    this.searchTerm.set(term);
    this.search$.next(term);
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer.set(customer);
    this.searchResults.set([]);
    this.searchTerm.set('');
    this.lastDeposit.set(null);
    this.submitError.set(null);
  }

  clearSelection(): void {
    this.selectedCustomer.set(null);
    this.amount.set('');
    this.lastDeposit.set(null);
  }

  submitDeposit(): void {
    const customer = this.selectedCustomer();
    const wallet = customer?.wallet;
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
        // Refresh the selected customer's balance so it's visibly up to date.
        this.customerService.getById(customer.id).subscribe((fresh) => this.selectedCustomer.set(fresh));
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
    this.loadHistory();
  }

  private loadHistory(): void {
    this.myWallet.ensureLoaded().subscribe({
      next: (wallet) => {
        this.historyLoading.set(true);
        this.historyError.set(null);
        this.depositService
          .list(wallet.id, {
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
      },
      error: () => this.historyError.set('Could not load your wallet.'),
    });
  }
}
