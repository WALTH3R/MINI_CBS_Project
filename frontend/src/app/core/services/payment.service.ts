import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Payment, TransactionFilters } from '../models/transaction.model';
import { PaginatedResponse } from '../models/pagination.model';
import { toHttpParams } from './http-params.util';

const BASE = `${environment.apiBaseUrl}/api/wallets`;

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);

  create(walletId: string, merchantTag: string, amount: string): Observable<Payment> {
    const headers = new HttpHeaders({ 'Idempotency-Key': crypto.randomUUID() });
    return this.http.post<Payment>(`${BASE}/${walletId}/payments/`, { merchant_tag: merchantTag, amount }, { headers });
  }

  list(walletId: string, filters: TransactionFilters = {}): Observable<PaginatedResponse<Payment>> {
    return this.http.get<PaginatedResponse<Payment>>(`${BASE}/${walletId}/payments/`, { params: toHttpParams(filters) });
  }

  loadMore(url: string): Observable<PaginatedResponse<Payment>> {
    return this.http.get<PaginatedResponse<Payment>>(url);
  }
}
