import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Deposit, TransactionFilters } from '../models/transaction.model';
import { PaginatedResponse } from '../models/pagination.model';
import { toHttpParams } from './http-params.util';

const BASE = `${environment.apiBaseUrl}/api/wallets`;

@Injectable({ providedIn: 'root' })
export class DepositService {
  private readonly http = inject(HttpClient);

  // A fresh key per call is correct: the form disables its submit button while a request is in
  // flight, so create() is never re-entered for the same attempt. A retry the auth interceptor
  // triggers (401 -> refresh -> retry) replays the same cloned request, header included.
  create(walletId: string, amount: string): Observable<Deposit> {
    const headers = new HttpHeaders({ 'Idempotency-Key': crypto.randomUUID() });
    return this.http.post<Deposit>(`${BASE}/${walletId}/deposits/`, { amount }, { headers });
  }

  list(walletId: string, filters: TransactionFilters = {}): Observable<PaginatedResponse<Deposit>> {
    return this.http.get<PaginatedResponse<Deposit>>(`${BASE}/${walletId}/deposits/`, { params: toHttpParams(filters) });
  }

  loadMore(url: string): Observable<PaginatedResponse<Deposit>> {
    return this.http.get<PaginatedResponse<Deposit>>(url);
  }
}
