import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Merchant, MerchantCreatePayload, MerchantPaymentReceived } from '../models/merchant.model';

const BASE = `${environment.apiBaseUrl}/api/merchants`;

@Injectable({ providedIn: 'root' })
export class MerchantService {
  private readonly http = inject(HttpClient);

  list(): Observable<Merchant[]> {
    return this.http.get<Merchant[]>(`${BASE}/`);
  }

  create(payload: MerchantCreatePayload): Observable<Merchant> {
    return this.http.post<Merchant>(`${BASE}/`, payload);
  }

  setActive(merchantId: string, isActive: boolean): Observable<Merchant> {
    return this.http.patch<Merchant>(`${BASE}/${merchantId}/`, { is_active: isActive });
  }

  paymentsReceived(merchantId: string): Observable<MerchantPaymentReceived[]> {
    return this.http.get<MerchantPaymentReceived[]>(`${BASE}/${merchantId}/payments/`);
  }
}
