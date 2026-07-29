import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Deposit, TransactionFilters } from '../models/transaction.model';
import { toHttpParams } from './http-params.util';

const BASE = `${environment.apiBaseUrl}/api/wallets`;

@Injectable({ providedIn: 'root' })
export class DepositService {
  private readonly http = inject(HttpClient);

  create(walletId: string, amount: string): Observable<Deposit> {
    return this.http.post<Deposit>(`${BASE}/${walletId}/deposits/`, { amount });
  }

  list(walletId: string, filters: TransactionFilters = {}): Observable<Deposit[]> {
    return this.http.get<Deposit[]>(`${BASE}/${walletId}/deposits/`, { params: toHttpParams(filters) });
  }
}
