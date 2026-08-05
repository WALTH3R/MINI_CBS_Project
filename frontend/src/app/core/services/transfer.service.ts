import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TransactionFilters, Transfer } from '../models/transaction.model';
import { PaginatedResponse } from '../models/pagination.model';
import { toHttpParams } from './http-params.util';

const BASE = `${environment.apiBaseUrl}/api/wallets`;

@Injectable({ providedIn: 'root' })
export class TransferService {
  private readonly http = inject(HttpClient);

  create(walletId: string, toTag: string, amount: string): Observable<Transfer> {
    const headers = new HttpHeaders({ 'Idempotency-Key': crypto.randomUUID() });
    return this.http.post<Transfer>(`${BASE}/${walletId}/transfers/`, { to_tag: toTag, amount }, { headers });
  }

  list(walletId: string, filters: TransactionFilters = {}): Observable<PaginatedResponse<Transfer>> {
    return this.http.get<PaginatedResponse<Transfer>>(`${BASE}/${walletId}/transfers/`, { params: toHttpParams(filters) });
  }

  loadMore(url: string): Observable<PaginatedResponse<Transfer>> {
    return this.http.get<PaginatedResponse<Transfer>>(url);
  }
}
