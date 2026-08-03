import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { MerchantService } from '../../core/services/merchant.service';
import { AgentService } from '../../core/services/agent.service';
import { WalletService } from '../../core/services/wallet.service';
import { Merchant, MerchantCategory } from '../../core/models/merchant.model';
import { Agent } from '../../core/models/agent.model';
import { WalletProfile } from '../../core/models/wallet.model';
import { TransientSignal } from '../../shared/utils/transient-signal';
import { StatusBadge } from '../../shared/status-badge/status-badge';

const CATEGORY_LABELS: Record<MerchantCategory, string> = {
  UTILITIES: 'Utilities',
  TELECOM: 'Telecom & Internet',
  TV: 'Television',
  OTHER: 'Other',
};

@Component({
  selector: 'app-merchants',
  standalone: true,
  imports: [FormsModule, StatusBadge],
  templateUrl: './merchants.html',
})
export class Merchants {
  private readonly merchantService = inject(MerchantService);
  private readonly agentService = inject(AgentService);
  private readonly walletService = inject(WalletService);

  protected readonly categoryLabel = (c: MerchantCategory) => CATEGORY_LABELS[c] ?? c;
  protected readonly categories: MerchantCategory[] = ['UTILITIES', 'TELECOM', 'TV', 'OTHER'];

  protected readonly merchants = signal<Merchant[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly agents = signal<Agent[]>([]);
  protected readonly walletProfiles = signal<WalletProfile[]>([]);

  protected readonly name = signal('');
  protected readonly category = signal<MerchantCategory>('OTHER');
  protected readonly ownerId = signal('');
  protected readonly walletProfileId = signal('');
  protected readonly submitting = signal(false);
  private readonly submitErrorMsg = new TransientSignal<string>();
  protected readonly submitError = this.submitErrorMsg.value;
  private readonly createdMsg = new TransientSignal<string>();
  protected readonly created = this.createdMsg.value;

  private readonly togglingId = signal<string | null>(null);
  protected isToggling(id: string): boolean {
    return this.togglingId() === id;
  }

  constructor() {
    this.loadMerchants();
    this.agentService.list().subscribe((agents) => this.agents.set(agents));
    this.walletService.listProfiles().subscribe((profiles) => this.walletProfiles.set(profiles));
  }

  private loadMerchants(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.merchantService.list().subscribe({
      next: (merchants) => {
        this.merchants.set(merchants);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load merchants.');
        this.loading.set(false);
      },
    });
  }

  submitCreate(): void {
    if (!this.name() || !this.ownerId() || !this.walletProfileId() || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.submitErrorMsg.set(null);

    // The create/update endpoints respond with a different (narrower) serializer shape than the
    // list does (e.g. `owner` comes back as a raw id, not a username) — reload from the list
    // endpoint afterwards rather than trying to merge the mutation response into local state.
    this.merchantService
      .create({
        name: this.name(),
        category: this.category(),
        owner: this.ownerId(),
        wallet_profile_id: this.walletProfileId(),
      })
      .subscribe({
        next: (merchant) => {
          this.name.set('');
          this.ownerId.set('');
          this.walletProfileId.set('');
          this.submitting.set(false);
          this.createdMsg.set(`"${merchant.name}" added.`);
          this.loadMerchants();
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          if (err instanceof HttpErrorResponse && Array.isArray(err.error)) {
            this.submitErrorMsg.set(err.error.join(' '));
          } else {
            this.submitErrorMsg.set('Could not create this merchant. Please try again.');
          }
        },
      });
  }

  toggleActive(merchant: Merchant): void {
    if (this.togglingId()) {
      return;
    }
    this.togglingId.set(merchant.id);
    this.merchantService.setActive(merchant.id, !merchant.is_active).subscribe({
      next: () => {
        this.togglingId.set(null);
        this.loadMerchants();
      },
      error: () => {
        this.submitErrorMsg.set('Could not update this merchant.');
        this.togglingId.set(null);
      },
    });
  }
}
