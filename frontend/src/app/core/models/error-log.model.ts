export interface ErrorLogEntry {
  id: string;
  username: string;
  method: string;
  path: string;
  exception_type: string;
  message: string;
  traceback: string;
  ip_address: string | null;
  user_agent: string;
  created_at: string;
}

export interface ErrorLogFilters {
  exception_type?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
}
