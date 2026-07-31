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
  created_at: string;
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
