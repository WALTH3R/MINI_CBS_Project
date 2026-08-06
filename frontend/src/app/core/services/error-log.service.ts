import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ErrorLogEntry, ErrorLogFilters } from '../models/error-log.model';
import { PaginatedResponse } from '../models/pagination.model';
import { toHttpParams } from './http-params.util';

const BASE = `${environment.apiBaseUrl}/api/audit/errors`;

@Injectable({ providedIn: 'root' })
export class ErrorLogService {
  private readonly http = inject(HttpClient);

  list(filters: ErrorLogFilters = {}): Observable<PaginatedResponse<ErrorLogEntry>> {
    return this.http.get<PaginatedResponse<ErrorLogEntry>>(`${BASE}/`, { params: toHttpParams(filters) });
  }

  loadMore(url: string): Observable<PaginatedResponse<ErrorLogEntry>> {
    return this.http.get<PaginatedResponse<ErrorLogEntry>>(url);
  }
}
