import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { RecipientPreview, Wallet, WalletBalance, WalletProfile, WalletRequest } from '../models/wallet.model';

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

  /** Doesn't create a wallet directly — creates a request the customer must confirm. */
  createForCustomer(customerId: string, walletProfileId: string): Observable<WalletRequest> {
    return this.http.post<WalletRequest>(`${ACCOUNTS_BASE}/customers/${customerId}/wallets/`, {
      wallet_profile_id: walletProfileId,
    });
  }

  resolveRecipient(tag: string): Observable<RecipientPreview> {
    return this.http.get<RecipientPreview>(`${BASE}/recipients/${tag}/`);
  }

  listMyRequests(): Observable<WalletRequest[]> {
    return this.http.get<WalletRequest[]>(`${BASE}/requests/mine/`);
  }

  confirmRequest(requestId: string): Observable<Wallet> {
    return this.http.post<Wallet>(`${BASE}/requests/${requestId}/confirm/`, {});
  }

  declineRequest(requestId: string): Observable<WalletRequest> {
    return this.http.post<WalletRequest>(`${BASE}/requests/${requestId}/decline/`, {});
  }
}
