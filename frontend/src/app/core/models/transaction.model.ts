export type TransactionType = 'DEPOSIT' | 'TRANSFER' | 'PAYMENT';
export type TransactionStatus = 'COMPLETED' | 'PENDING' | 'FAILED';
export type TransferDirection = 'CREDIT' | 'DEBIT';

export interface PerformedBy {
  user_id: string;
  type: 'AGENT' | 'CLIENT' | '';
}

export interface Deposit {
  id: string;
  reference: string;
  amount: string;
  currency: string;
  performed_by: string;
  created_at: string;
}

export interface Transfer {
  id: string;
  reference: string;
  direction: TransferDirection;
  from_wallet: string;
  to_wallet: string;
  amount: string;
  currency: string;
  performed_by: PerformedBy;
  created_at: string;
}

export interface Payment {
  id: string;
  reference: string;
  status: TransactionStatus;
  failure_reason: string;
  from_wallet?: string;
  merchant: string;
  amount: string;
  performed_by: string;
  created_at: string;
}

/** The Topic 5 reporting shape — a merged view across all transaction types for one customer. */
export interface LedgerEntry {
  id: string;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  failure_reason: string;
  from_wallet: string | null;
  to_wallet: string;
  amount: string;
  performed_by: string;
  created_at: string;
}

export interface CustomerStatistics {
  total_deposited: number;
  total_transferred: number;
  total_paid_bills: number;
  total_transactions: number;
}

export interface TransactionFilters {
  min_amount?: string;
  max_amount?: string;
  date_from?: string;
  date_to?: string;
  direction?: TransferDirection;
  ordering?: 'created_at';
  type?: TransactionType;
  status?: TransactionStatus;
  wallet_id?: string;
}
