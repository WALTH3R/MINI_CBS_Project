import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of, tap } from 'rxjs';

import { Wallet } from '../models/wallet.model';
import { WalletService } from './wallet.service';

/**
 * Caches the logged-in customer's own wallets — resolved once via /api/wallets/mine/, reused
 * everywhere. A customer may hold more than one wallet (e.g. one per currency); `activeWallet`
 * is whichever one is currently selected (via the Shell's wallet switcher) and drives
 * Dashboard/Deposits/Transfers/Payments.
 */
@Injectable({ providedIn: 'root' })
export class MyWalletStore {
  private readonly walletService = inject(WalletService);
  private readonly walletsSignal = signal<Wallet[]>([]);
  private readonly activeWalletIdSignal = signal<string | null>(null);
  private loaded = false;

  readonly wallets = this.walletsSignal.asReadonly();
  readonly activeWalletId = this.activeWalletIdSignal.asReadonly();
  readonly activeWallet = computed(
    () => this.walletsSignal().find((w) => w.id === this.activeWalletIdSignal()) ?? null,
  );

  ensureLoaded(): Observable<Wallet[]> {
    if (this.loaded) {
      return of(this.walletsSignal());
    }
    return this.refresh();
  }

  refresh(): Observable<Wallet[]> {
    return this.walletService.getMine().pipe(
      tap((wallets) => {
        this.walletsSignal.set(wallets);
        if (!wallets.some((w) => w.id === this.activeWalletIdSignal())) {
          this.activeWalletIdSignal.set(wallets[0]?.id ?? null);
        }
        this.loaded = true;
      }),
    );
  }

  selectWallet(id: string): void {
    this.activeWalletIdSignal.set(id);
  }

  clear(): void {
    this.walletsSignal.set([]);
    this.activeWalletIdSignal.set(null);
    this.loaded = false;
  }
}
