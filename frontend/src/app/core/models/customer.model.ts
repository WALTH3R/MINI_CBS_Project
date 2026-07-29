export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';

export interface CustomerWalletSummary {
  id: string;
  tag: string;
  balance: string;
  currency: string;
}

export interface Customer {
  id: string;
  username: string;
  name: string;
  first_name: string;
  parent_name: string;
  date_of_birth: string;
  marital_status: MaritalStatus;
  place_of_birth: string;
  national_id_number: string;
  tag: string;
  wallet: CustomerWalletSummary | null;
  created_at: string;
}

export interface CustomerCreatePayload {
  username: string;
  password: string;
  name: string;
  first_name: string;
  parent_name: string;
  date_of_birth: string;
  marital_status: MaritalStatus;
  place_of_birth: string;
  national_id_number: string;
  wallet_profile_id: string;
}
