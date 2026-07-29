import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CustomerStatistics, LedgerEntry, TransactionFilters } from '../models/transaction.model';
import { toHttpParams } from './http-params.util';

const BASE = `${environment.apiBaseUrl}/api/accounts/customers`;

@Injectable({ providedIn: 'root' })
export class ReportingService {
  private readonly http = inject(HttpClient);

  transactions(customerId: string, filters: TransactionFilters = {}): Observable<LedgerEntry[]> {
    return this.http.get<LedgerEntry[]>(`${BASE}/${customerId}/transactions/`, { params: toHttpParams(filters) });
  }

  statistics(customerId: string, filters: TransactionFilters = {}): Observable<CustomerStatistics> {
    return this.http.get<CustomerStatistics>(`${BASE}/${customerId}/transactions/statistics/`, {
      params: toHttpParams(filters),
    });
  }
}
