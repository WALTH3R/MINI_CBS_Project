export interface WalletProfile {
  id: string;
  name: string;
  currency: string;
  max_balance: string;
  max_transfer_amount: string;
  max_daily_transfer_total: string;
  max_deposit_amount: string;
}

export interface Wallet {
  id: string;
  client: string;
  profile: WalletProfile;
  tag: string;
  balance: string;
  /** The customer's own daily transfer cap, or null if they haven't set one (falls back to the profile's). */
  daily_transfer_limit: string | null;
  /** The cap actually enforced: daily_transfer_limit if set, otherwise the profile's max_daily_transfer_total. */
  effective_daily_transfer_limit: string;
  created_at: string;
}

/** Response shape from GET/PATCH /api/wallets/{id}/daily-limit/. */
export interface WalletDailyLimit {
  id: string;
  daily_transfer_limit: string | null;
  profile_daily_transfer_limit: string;
  effective_daily_transfer_limit: string;
}

export interface WalletBalance {
  id: string;
  tag: string;
  balance: string;
  currency: string;
}

/** Preview of who a tag belongs to, resolved before a transfer is confirmed — no balance included. */
export interface RecipientPreview {
  tag: string;
  first_name: string;
  name: string;
}

export type WalletRequestStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED';

/** An agent-initiated wallet that doesn't exist yet — the customer must confirm or decline it. */
export interface WalletRequest {
  id: string;
  status: WalletRequestStatus;
  wallet_profile: WalletProfile;
  requested_by: string;
  created_at: string;
}
