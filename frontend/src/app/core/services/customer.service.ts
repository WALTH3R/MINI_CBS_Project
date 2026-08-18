import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Customer, CustomerCreatePayload, SignupPayload } from '../models/customer.model';
import { toHttpParams } from './http-params.util';

const BASE = `${environment.apiBaseUrl}/api/accounts/customers`;
const SIGNUP_BASE = `${environment.apiBaseUrl}/api/accounts`;

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);

  list(search?: string): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${BASE}/`, { params: toHttpParams({ search }) });
  }

  getById(customerId: string): Observable<Customer> {
    return this.http.get<Customer>(`${BASE}/${customerId}/`);
  }

  create(payload: CustomerCreatePayload): Observable<Customer> {
    return this.http.post<Customer>(`${BASE}/`, payload);
  }

  setActive(customerId: string, isActive: boolean): Observable<Customer> {
    return this.http.patch<Customer>(`${BASE}/${customerId}/`, { is_active: isActive });
  }

  /** Public self-registration — no auth required; the account stays pending until an admin
   * approves it. */
  signup(payload: SignupPayload): Observable<void> {
    return this.http.post<void>(`${SIGNUP_BASE}/signup/`, payload);
  }

  listPendingSignups(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${SIGNUP_BASE}/signup-requests/`);
  }

  approveSignup(customerId: string, walletProfileId: string): Observable<Customer> {
    return this.http.post<Customer>(`${SIGNUP_BASE}/signup-requests/${customerId}/approve/`, {
      wallet_profile_id: walletProfileId,
    });
  }

  denySignup(customerId: string): Observable<Customer> {
    return this.http.post<Customer>(`${SIGNUP_BASE}/signup-requests/${customerId}/deny/`, {});
  }
}
