import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Merchant, MerchantCreatePayload, MerchantPaymentReceived } from '../models/merchant.model';
import { PaginatedResponse } from '../models/pagination.model';

const BASE = `${environment.apiBaseUrl}/api/merchants`;

@Injectable({ providedIn: 'root' })
export class MerchantService {
  private readonly http = inject(HttpClient);

  list(): Observable<PaginatedResponse<Merchant>> {
    return this.http.get<PaginatedResponse<Merchant>>(`${BASE}/`);
  }

  create(payload: MerchantCreatePayload): Observable<Merchant> {
    return this.http.post<Merchant>(`${BASE}/`, payload);
  }

  setActive(merchantId: string, isActive: boolean): Observable<Merchant> {
    return this.http.patch<Merchant>(`${BASE}/${merchantId}/`, { is_active: isActive });
  }

  paymentsReceived(merchantId: string): Observable<PaginatedResponse<MerchantPaymentReceived>> {
    return this.http.get<PaginatedResponse<MerchantPaymentReceived>>(`${BASE}/${merchantId}/payments/`);
  }

  loadMore<T>(url: string): Observable<PaginatedResponse<T>> {
    return this.http.get<PaginatedResponse<T>>(url);
  }
}
