import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, tap } from 'rxjs';

import { Wallet } from '../models/wallet.model';
import { WalletService } from './wallet.service';

/** Caches the logged-in customer's own wallet — resolved once via /api/wallets/mine/, reused everywhere. */
@Injectable({ providedIn: 'root' })
export class MyWalletStore {
  private readonly walletService = inject(WalletService);
  private readonly walletSignal = signal<Wallet | null>(null);
  private loaded = false;

  readonly wallet = this.walletSignal.asReadonly();

  ensureLoaded(): Observable<Wallet> {
    const current = this.walletSignal();
    if (this.loaded && current) {
      return of(current);
    }
    return this.refresh();
  }

  refresh(): Observable<Wallet> {
    return this.walletService.getMine().pipe(
      tap((wallet) => {
        this.walletSignal.set(wallet);
        this.loaded = true;
      }),
    );
  }

  clear(): void {
    this.walletSignal.set(null);
    this.loaded = false;
  }
}
