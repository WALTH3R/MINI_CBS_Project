import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Agent, AgentCreatePayload } from '../models/agent.model';

const BASE = `${environment.apiBaseUrl}/api/accounts/agents`;

@Injectable({ providedIn: 'root' })
export class AgentService {
  private readonly http = inject(HttpClient);

  list(): Observable<Agent[]> {
    return this.http.get<Agent[]>(`${BASE}/`);
  }

  create(payload: AgentCreatePayload): Observable<Agent> {
    return this.http.post<Agent>(`${BASE}/`, payload);
  }
}
