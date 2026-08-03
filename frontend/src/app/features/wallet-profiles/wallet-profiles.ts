import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { WalletService } from '../../core/services/wallet.service';
import { WalletProfile } from '../../core/models/wallet.model';
import { TransientSignal } from '../../shared/utils/transient-signal';

@Component({
  selector: 'app-wallet-profiles',
  standalone: true,
  imports: [],
  templateUrl: './wallet-profiles.html',
})
export class WalletProfiles {
  private readonly walletService = inject(WalletService);

  protected readonly profiles = signal<WalletProfile[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  // --- Create ---
  protected readonly name = signal('');
  protected readonly currency = signal('EUR');
  protected readonly maxBalance = signal('');
  protected readonly maxTransferAmount = signal('');
  protected readonly maxDailyTransferTotal = signal('');
  protected readonly maxDepositAmount = signal('');
  protected readonly submitting = signal(false);
  private readonly submitErrorMsg = new TransientSignal<string>();
  protected readonly submitError = this.submitErrorMsg.value;
  private readonly createdMsg = new TransientSignal<string>();
  protected readonly created = this.createdMsg.value;

  // --- Edit ---
  protected readonly editingId = signal<string | null>(null);
  protected readonly editName = signal('');
  protected readonly editMaxBalance = signal('');
  protected readonly editMaxTransferAmount = signal('');
  protected readonly editMaxDailyTransferTotal = signal('');
  protected readonly editMaxDepositAmount = signal('');
  protected readonly saving = signal(false);
  private readonly editErrorMsg = new TransientSignal<string>();
  protected readonly editError = this.editErrorMsg.value;

  constructor() {
    this.loadProfiles();
  }

  private loadProfiles(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.walletService.listProfiles().subscribe({
      next: (profiles) => {
        this.profiles.set(profiles);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load wallet profiles.');
        this.loading.set(false);
      },
    });
  }

  submitCreate(): void {
    if (!this.name() || !this.currency() || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.submitErrorMsg.set(null);

    this.walletService
      .createProfile({
        name: this.name(),
        currency: this.currency().toUpperCase(),
        max_balance: this.maxBalance(),
        max_transfer_amount: this.maxTransferAmount(),
        max_daily_transfer_total: this.maxDailyTransferTotal(),
        max_deposit_amount: this.maxDepositAmount(),
      })
      .subscribe({
        next: (profile) => {
          this.profiles.update((profiles) => [...profiles, profile]);
          this.name.set('');
          this.currency.set('EUR');
          this.maxBalance.set('');
          this.maxTransferAmount.set('');
          this.maxDailyTransferTotal.set('');
          this.maxDepositAmount.set('');
          this.submitting.set(false);
          this.createdMsg.set(`"${profile.name}" created.`);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          if (err instanceof HttpErrorResponse && Array.isArray(err.error)) {
            this.submitErrorMsg.set(err.error.join(' '));
          } else {
            this.submitErrorMsg.set('Could not create this profile. Please check the values.');
          }
        },
      });
  }

  startEdit(profile: WalletProfile): void {
    this.editingId.set(profile.id);
    this.editName.set(profile.name);
    this.editMaxBalance.set(profile.max_balance);
    this.editMaxTransferAmount.set(profile.max_transfer_amount);
    this.editMaxDailyTransferTotal.set(profile.max_daily_transfer_total);
    this.editMaxDepositAmount.set(profile.max_deposit_amount);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(profile: WalletProfile): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.editErrorMsg.set(null);

    this.walletService
      .updateProfile(profile.id, {
        name: this.editName(),
        max_balance: this.editMaxBalance(),
        max_transfer_amount: this.editMaxTransferAmount(),
        max_daily_transfer_total: this.editMaxDailyTransferTotal(),
        max_deposit_amount: this.editMaxDepositAmount(),
      })
      .subscribe({
        next: (updated) => {
          this.profiles.update((profiles) => profiles.map((p) => (p.id === updated.id ? updated : p)));
          this.saving.set(false);
          this.editingId.set(null);
        },
        error: () => {
          this.saving.set(false);
          this.editErrorMsg.set('Could not save these changes.');
        },
      });
  }
}
