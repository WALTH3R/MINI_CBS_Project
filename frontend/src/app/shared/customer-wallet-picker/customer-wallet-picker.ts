import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { CustomerService } from '../../core/services/customer.service';
import { WalletService } from '../../core/services/wallet.service';
import { Customer, CustomerWalletSummary } from '../../core/models/customer.model';
import { WalletProfile } from '../../core/models/wallet.model';
import { CurrencyAmountPipe } from '../pipes/currency-amount.pipe';

export interface CustomerWalletSelection {
  customer: Customer;
  wallet: CustomerWalletSummary;
}

/**
 * Agent-side "find a customer, then pick which of their wallets to act on" — used identically by
 * Deposits, Transfers, Payments, and Transactions. Auto-selects the wallet when a customer has
 * only one (today's common case); shows chips to choose among several otherwise. Also lets an
 * agent add a new currency wallet to the selected customer.
 */
@Component({
  selector: 'app-customer-wallet-picker',
  standalone: true,
  imports: [FormsModule, CurrencyAmountPipe],
  templateUrl: './customer-wallet-picker.html',
})
export class CustomerWalletPicker {
  readonly allowCreate = input(true);
  readonly walletSelected = output<CustomerWalletSelection>();
  readonly selectionCleared = output<void>();

  private readonly customerService = inject(CustomerService);
  private readonly walletService = inject(WalletService);

  protected readonly searchTerm = signal('');
  protected readonly searchResults = signal<Customer[]>([]);
  protected readonly searching = signal(false);
  protected readonly selectedCustomer = signal<Customer | null>(null);
  protected readonly selectedWalletId = signal<string | null>(null);
  private readonly search$ = new Subject<string>();

  protected readonly walletProfiles = signal<WalletProfile[]>([]);
  protected readonly showCreateForm = signal(false);
  protected readonly newWalletProfileId = signal('');
  protected readonly creating = signal(false);
  protected readonly createError = signal<string | null>(null);

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
  }

  onSearchInput(term: string): void {
    this.searchTerm.set(term);
    this.search$.next(term);
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer.set(customer);
    this.searchResults.set([]);
    this.searchTerm.set('');
    if (customer.wallets.length === 1) {
      this.emitSelection(customer, customer.wallets[0]);
    }
  }

  pickWallet(wallet: CustomerWalletSummary): void {
    const customer = this.selectedCustomer();
    if (customer) {
      this.emitSelection(customer, wallet);
    }
  }

  clearSelection(): void {
    this.selectedCustomer.set(null);
    this.selectedWalletId.set(null);
    this.showCreateForm.set(false);
    this.createError.set(null);
    this.selectionCleared.emit();
  }

  openCreateForm(): void {
    this.showCreateForm.set(true);
    this.createError.set(null);
    if (this.walletProfiles().length === 0) {
      this.walletService.listProfiles().subscribe((profiles) => this.walletProfiles.set(profiles));
    }
  }

  submitCreateWallet(): void {
    const customer = this.selectedCustomer();
    const profileId = this.newWalletProfileId();
    if (!customer || !profileId || this.creating()) {
      return;
    }
    this.creating.set(true);
    this.createError.set(null);

    this.walletService.createForCustomer(customer.id, profileId).subscribe({
      next: (wallet) => {
        this.customerService.getById(customer.id).subscribe((fresh) => {
          this.selectedCustomer.set(fresh);
          this.creating.set(false);
          this.showCreateForm.set(false);
          this.newWalletProfileId.set('');
          const freshWallet = fresh.wallets.find((w) => w.id === wallet.id);
          if (freshWallet) {
            this.emitSelection(fresh, freshWallet);
          }
        });
      },
      error: () => {
        this.creating.set(false);
        this.createError.set('Could not create this wallet. It may already exist for this currency.');
      },
    });
  }

  /**
   * Re-fetches the selected customer so wallet chip balances reflect a just-completed action
   * (e.g. a deposit), and re-emits `walletSelected` so the parent screen's own copy of the
   * wallet (balance, etc.) stays in sync too.
   */
  refreshSelectedCustomer(): void {
    const customer = this.selectedCustomer();
    const walletId = this.selectedWalletId();
    if (!customer) {
      return;
    }
    this.customerService.getById(customer.id).subscribe((fresh) => {
      this.selectedCustomer.set(fresh);
      const wallet = fresh.wallets.find((w) => w.id === walletId);
      if (wallet) {
        this.emitSelection(fresh, wallet);
      }
    });
  }

  private emitSelection(customer: Customer, wallet: CustomerWalletSummary): void {
    this.selectedWalletId.set(wallet.id);
    this.walletSelected.emit({ customer, wallet });
  }
}
