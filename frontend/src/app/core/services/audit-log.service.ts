import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuditLogEntry, AuditLogFilters } from '../models/audit.model';
import { PaginatedResponse } from '../models/pagination.model';
import { toHttpParams } from './http-params.util';

const BASE = `${environment.apiBaseUrl}/api/audit`;

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly http = inject(HttpClient);

  list(filters: AuditLogFilters = {}): Observable<PaginatedResponse<AuditLogEntry>> {
    return this.http.get<PaginatedResponse<AuditLogEntry>>(`${BASE}/`, { params: toHttpParams(filters) });
  }

  loadMore(url: string): Observable<PaginatedResponse<AuditLogEntry>> {
    return this.http.get<PaginatedResponse<AuditLogEntry>>(url);
  }
}
