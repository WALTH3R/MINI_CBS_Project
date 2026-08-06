export interface HealthStatus {
  database: {
    status: 'ok' | 'error';
    latency_ms: number | null;
  };
  environment: {
    debug: boolean;
    django_version: string;
    database_engine: string;
  };
  activity_last_hour: {
    total_requests: number;
    error_requests: number;
    error_rate_percent: number;
  };
  business: {
    active_agents: number;
    active_customers: number;
    total_wallets: number;
    pending_wallet_requests: number;
    failed_transactions_last_24h: number;
  };
}
