import { Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../core/services/auth.service';
import { MyWalletStore } from '../../core/services/my-wallet.store';
import { TransferService } from '../../core/services/transfer.service';
import { WalletService } from '../../core/services/wallet.service';
import { Customer, CustomerWalletSummary } from '../../core/models/customer.model';
import { RecipientPreview } from '../../core/models/wallet.model';
import { Transfer, TransferDirection } from '../../core/models/transaction.model';
import { CustomerWalletPicker, CustomerWalletSelection } from '../../shared/customer-wallet-picker/customer-wallet-picker';
import { TransientSignal } from '../../shared/utils/transient-signal';

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
  private readonly walletService = inject(WalletService);

  // --- Customer: send money ---
  protected readonly toTag = signal('');
  protected readonly amount = signal('');
  protected readonly submitting = signal(false);
  private readonly submitErrorMsg = new TransientSignal<string>();
  protected readonly submitError = this.submitErrorMsg.value;
  private readonly lastTransferMsg = new TransientSignal<Transfer>();
  protected readonly lastTransfer = this.lastTransferMsg.value;

  // --- Confirm-before-send ---
  protected readonly resolvingRecipient = signal(false);
  protected readonly recipientPreview = signal<RecipientPreview | null>(null);
  protected readonly confirmOpen = signal(false);

  // --- Shared: history + filters ---
  protected readonly history = signal<Transfer[]>([]);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal<string | null>(null);
  protected readonly directionFilter = signal<TransferDirection | ''>('');
  protected readonly nextPageUrl = signal<string | null>(null);
  protected readonly loadingMore = signal(false);

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
    this.nextPageUrl.set(null);
  }

  startSend(): void {
    const wallet = this.myWallet.activeWallet();
    if (!wallet || !this.toTag() || !this.amount() || this.resolvingRecipient()) {
      return;
    }

    this.submitErrorMsg.set(null);
    this.resolvingRecipient.set(true);

    this.walletService.resolveRecipient(this.toTag()).subscribe({
      next: (recipient) => {
        this.recipientPreview.set(recipient);
        this.resolvingRecipient.set(false);
        this.confirmOpen.set(true);
      },
      error: () => {
        this.resolvingRecipient.set(false);
        this.submitErrorMsg.set('No customer found for this tag.');
      },
    });
  }

  cancelConfirm(): void {
    this.confirmOpen.set(false);
    this.recipientPreview.set(null);
  }

  confirmSend(): void {
    const wallet = this.myWallet.activeWallet();
    if (!wallet || !this.toTag() || !this.amount() || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.submitErrorMsg.set(null);

    this.transferService.create(wallet.id, this.toTag(), this.amount()).subscribe({
      next: (transfer) => {
        this.lastTransferMsg.set(transfer);
        this.toTag.set('');
        this.amount.set('');
        this.submitting.set(false);
        this.confirmOpen.set(false);
        this.recipientPreview.set(null);
        this.myWallet.refresh().subscribe();
        this.loadHistoryFor(wallet.id);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.confirmOpen.set(false);
        this.recipientPreview.set(null);
        if (err instanceof HttpErrorResponse && Array.isArray(err.error)) {
          this.submitErrorMsg.set(err.error.join(' '));
        } else {
          this.submitErrorMsg.set('Could not complete this transfer. Please try again.');
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

  loadMore(): void {
    const url = this.nextPageUrl();
    if (!url || this.loadingMore()) {
      return;
    }
    this.loadingMore.set(true);
    this.transferService.loadMore(url).subscribe({
      next: (response) => {
        this.history.update((history) => [...history, ...response.results]);
        this.nextPageUrl.set(response.next);
        this.loadingMore.set(false);
      },
      error: () => {
        this.historyError.set('Could not load more transfers.');
        this.loadingMore.set(false);
      },
    });
  }

  private loadHistoryFor(walletId: string): void {
    this.historyLoading.set(true);
    this.historyError.set(null);
    this.transferService
      .list(walletId, { direction: this.directionFilter() || undefined })
      .subscribe({
        next: (response) => {
          this.history.set(response.results);
          this.nextPageUrl.set(response.next);
          this.historyLoading.set(false);
        },
        error: () => {
          this.historyError.set('Could not load transfer history.');
          this.historyLoading.set(false);
        },
      });
  }
}
