import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { HealthStatus } from '../models/health.model';

const BASE = `${environment.apiBaseUrl}/api`;

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  get(): Observable<HealthStatus> {
    return this.http.get<HealthStatus>(`${BASE}/health/`);
  }
}
