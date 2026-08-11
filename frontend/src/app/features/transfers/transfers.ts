import { Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { MyWalletStore } from '../../core/services/my-wallet.store';
import { TransferService } from '../../core/services/transfer.service';
import { WalletService } from '../../core/services/wallet.service';
import { BeneficiaryService } from '../../core/services/beneficiary.service';
import { Customer, CustomerWalletSummary } from '../../core/models/customer.model';
import { RecipientPreview } from '../../core/models/wallet.model';
import { Beneficiary } from '../../core/models/beneficiary.model';
import { Transfer, TransferDirection } from '../../core/models/transaction.model';
import { CustomerWalletPicker, CustomerWalletSelection } from '../../shared/customer-wallet-picker/customer-wallet-picker';
import { TransientSignal } from '../../shared/utils/transient-signal';
import { fetchAllPages } from '../../shared/utils/fetch-all-pages.util';
import { downloadCsv } from '../../shared/utils/csv-export.util';

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
  private readonly beneficiaryService = inject(BeneficiaryService);

  // --- Customer: saved beneficiaries ---
  protected readonly beneficiaries = signal<Beneficiary[]>([]);
  protected readonly beneficiariesLoading = signal(false);
  protected readonly beneficiarySearchTerm = signal('');
  private readonly beneficiarySearch$ = new Subject<string>();
  protected readonly newBeneficiaryTag = signal('');
  protected readonly newBeneficiaryNickname = signal('');
  protected readonly addingBeneficiary = signal(false);
  private readonly beneficiaryErrorMsg = new TransientSignal<string>();
  protected readonly beneficiaryError = this.beneficiaryErrorMsg.value;
  protected readonly deletingBeneficiaryId = signal<string | null>(null);

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
  protected readonly exporting = signal(false);

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

      this.loadBeneficiaries();
      this.beneficiarySearch$
        .pipe(
          debounceTime(300),
          distinctUntilChanged(),
          switchMap((term) => {
            this.beneficiariesLoading.set(true);
            return this.beneficiaryService.list(term || undefined);
          }),
        )
        .subscribe({
          next: (beneficiaries) => {
            this.beneficiaries.set(beneficiaries);
            this.beneficiariesLoading.set(false);
          },
          error: () => {
            this.beneficiaryErrorMsg.set('Could not search beneficiaries.');
            this.beneficiariesLoading.set(false);
          },
        });
    }
  }

  onBeneficiarySearchInput(term: string): void {
    this.beneficiarySearchTerm.set(term);
    this.beneficiarySearch$.next(term);
  }

  useBeneficiary(beneficiary: Beneficiary): void {
    this.toTag.set(beneficiary.wallet_tag);
  }

  addBeneficiary(): void {
    if (!this.newBeneficiaryTag() || !this.newBeneficiaryNickname() || this.addingBeneficiary()) {
      return;
    }

    this.addingBeneficiary.set(true);
    this.beneficiaryErrorMsg.set(null);

    this.beneficiaryService.create(this.newBeneficiaryTag(), this.newBeneficiaryNickname()).subscribe({
      next: (beneficiary) => {
        this.beneficiaries.update((list) => [beneficiary, ...list]);
        this.newBeneficiaryTag.set('');
        this.newBeneficiaryNickname.set('');
        this.addingBeneficiary.set(false);
      },
      error: (err: unknown) => {
        this.addingBeneficiary.set(false);
        if (err instanceof HttpErrorResponse && Array.isArray(err.error?.tag)) {
          this.beneficiaryErrorMsg.set(err.error.tag.join(' '));
        } else {
          this.beneficiaryErrorMsg.set('Could not save this beneficiary.');
        }
      },
    });
  }

  removeBeneficiary(beneficiary: Beneficiary): void {
    if (this.deletingBeneficiaryId()) {
      return;
    }
    this.deletingBeneficiaryId.set(beneficiary.id);

    this.beneficiaryService.delete(beneficiary.id).subscribe({
      next: () => {
        this.beneficiaries.update((list) => list.filter((b) => b.id !== beneficiary.id));
        this.deletingBeneficiaryId.set(null);
      },
      error: () => {
        this.beneficiaryErrorMsg.set('Could not remove this beneficiary.');
        this.deletingBeneficiaryId.set(null);
      },
    });
  }

  private loadBeneficiaries(): void {
    this.beneficiariesLoading.set(true);
    this.beneficiaryService.list().subscribe({
      next: (beneficiaries) => {
        this.beneficiaries.set(beneficiaries);
        this.beneficiariesLoading.set(false);
      },
      error: () => {
        this.beneficiaryErrorMsg.set('Could not load beneficiaries.');
        this.beneficiariesLoading.set(false);
      },
    });
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

  exportCsv(): void {
    const wallet = this.auth.isCustomer() ? this.myWallet.activeWallet() : this.selectedWallet();
    if (!wallet || this.exporting()) {
      return;
    }

    this.exporting.set(true);
    fetchAllPages(
      this.transferService.list(wallet.id, { direction: this.directionFilter() || undefined }),
      (url) => this.transferService.loadMore(url),
    ).subscribe({
      next: (transfers) => {
        downloadCsv(
          `transfers-${wallet.tag}-${new Date().toISOString().slice(0, 10)}.csv`,
          ['Date', 'Reference', 'Direction', 'From', 'To', 'Amount', 'Currency'],
          transfers.map((t) => [t.created_at, t.reference, t.direction, t.from_wallet, t.to_wallet, t.amount, t.currency]),
        );
        this.exporting.set(false);
      },
      error: () => {
        this.historyError.set('Could not export transfer history.');
        this.exporting.set(false);
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
