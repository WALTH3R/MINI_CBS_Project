import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Customer, CustomerCreatePayload } from '../models/customer.model';
import { toHttpParams } from './http-params.util';

const BASE = `${environment.apiBaseUrl}/api/accounts/customers`;

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
}
