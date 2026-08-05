export interface AuditLogEntry {
  id: string;
  request_id: string;
  username: string;
  method: string;
  path: string;
  status_code: number;
  ip_address: string | null;
  user_agent: string;
  created_at: string;
}

export interface AuditLogFilters {
  method?: string;
  status_code?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}
