import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CustomerStatistics, LedgerEntry, TransactionFilters } from '../models/transaction.model';
import { toHttpParams } from './http-params.util';

const CUSTOMERS_BASE = `${environment.apiBaseUrl}/api/accounts/customers`;
const AGENTS_BASE = `${environment.apiBaseUrl}/api/accounts/agents`;

@Injectable({ providedIn: 'root' })
export class ReportingService {
  private readonly http = inject(HttpClient);

  transactions(customerId: string, filters: TransactionFilters = {}): Observable<LedgerEntry[]> {
    return this.http.get<LedgerEntry[]>(`${CUSTOMERS_BASE}/${customerId}/transactions/`, { params: toHttpParams(filters) });
  }

  statistics(customerId: string, filters: TransactionFilters = {}): Observable<CustomerStatistics> {
    return this.http.get<CustomerStatistics>(`${CUSTOMERS_BASE}/${customerId}/transactions/statistics/`, {
      params: toHttpParams(filters),
    });
  }

  agentTransactions(agentId: string, filters: TransactionFilters = {}): Observable<LedgerEntry[]> {
    return this.http.get<LedgerEntry[]>(`${AGENTS_BASE}/${agentId}/transactions/`, { params: toHttpParams(filters) });
  }
}
