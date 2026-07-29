export type MerchantCategory = 'UTILITIES' | 'TELECOM' | 'TV' | 'OTHER';

export interface Merchant {
  id: string;
  name: string;
  category: MerchantCategory;
  owner: string;
  wallet_tag: string;
  is_active: boolean;
  created_at: string;
}

export interface MerchantCreatePayload {
  name: string;
  category: MerchantCategory;
  owner: string;
  wallet_profile_id: string;
}

export interface MerchantPaymentReceived {
  id: string;
  reference: string;
  status: string;
  failure_reason: string;
  from_wallet: string;
  payer: string;
  amount: string;
  performed_by: string;
  created_at: string;
}
