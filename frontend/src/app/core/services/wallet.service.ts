import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Wallet, WalletBalance, WalletProfile } from '../models/wallet.model';

const BASE = `${environment.apiBaseUrl}/api/wallets`;

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly http = inject(HttpClient);

  getMine(): Observable<Wallet> {
    return this.http.get<Wallet>(`${BASE}/mine/`);
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
}
