export type Role = 'AGENT' | 'CLIENT' | '';

export interface CurrentUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  role: Role;
  isStaff: boolean;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

/** Shape of the decoded JWT access token payload (see accounts/auth.py RoleTokenObtainPairSerializer). */
export interface AccessTokenClaims {
  token_type: 'access';
  exp: number;
  iat: number;
  jti: string;
  user_id: string;
  role: Role;
  username: string;
  is_staff: boolean;
}
