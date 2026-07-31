import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Wallet, WalletBalance, WalletProfile } from '../models/wallet.model';

const BASE = `${environment.apiBaseUrl}/api/wallets`;
const ACCOUNTS_BASE = `${environment.apiBaseUrl}/api/accounts`;

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly http = inject(HttpClient);

  /** A customer may hold more than one wallet (e.g. one per currency). */
  getMine(): Observable<Wallet[]> {
    return this.http.get<Wallet[]>(`${BASE}/mine/`);
  }

  getById(walletId: string): Observable<Wallet> {
    return this.http.get<Wallet>(`${BASE}/${walletId}/`);
  }

  getBalance(walletId: string): Observable<WalletBalance> {
    return this.http.get<WalletBalance>(`${BASE}/${walletId}/balance/`);
  }

  listProfiles(): Observable<WalletProfile[]> {
    return this.http.get<WalletProfile[]>(`${BASE}/profiles/`);
  }

  createProfile(payload: Omit<WalletProfile, 'id'>): Observable<WalletProfile> {
    return this.http.post<WalletProfile>(`${BASE}/profiles/`, payload);
  }

  listForCustomer(customerId: string): Observable<Wallet[]> {
    return this.http.get<Wallet[]>(`${ACCOUNTS_BASE}/customers/${customerId}/wallets/`);
  }

  createForCustomer(customerId: string, walletProfileId: string): Observable<Wallet> {
    return this.http.post<Wallet>(`${ACCOUNTS_BASE}/customers/${customerId}/wallets/`, {
      wallet_profile_id: walletProfileId,
    });
  }
}
