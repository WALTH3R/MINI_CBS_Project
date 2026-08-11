import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Beneficiary } from '../models/beneficiary.model';
import { toHttpParams } from './http-params.util';

const BASE = `${environment.apiBaseUrl}/api/wallets/beneficiaries`;

@Injectable({ providedIn: 'root' })
export class BeneficiaryService {
  private readonly http = inject(HttpClient);

  list(search?: string): Observable<Beneficiary[]> {
    return this.http.get<Beneficiary[]>(`${BASE}/`, { params: toHttpParams({ search }) });
  }

  create(tag: string, nickname: string): Observable<Beneficiary> {
    return this.http.post<Beneficiary>(`${BASE}/`, { tag, nickname });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/${id}/`);
  }
}
