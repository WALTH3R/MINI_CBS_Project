import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AccessTokenClaims, CurrentUser, TokenPair } from '../models/user.model';
import { decodeJwtPayload, isTokenExpired } from './jwt.util';
import { MyWalletStore } from './my-wallet.store';

const ACCESS_TOKEN_KEY = 'mini_cbs_access_token';
const REFRESH_TOKEN_KEY = 'mini_cbs_refresh_token';

function claimsToUser(claims: AccessTokenClaims): CurrentUser {
  return {
    id: claims.user_id,
    username: claims.username,
    firstName: '',
    lastName: '',
    role: claims.role,
    isStaff: claims.is_staff,
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUserSignal = signal<CurrentUser | null>(this.restoreUserFromStorage());

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly isAgent = computed(() => this.currentUserSignal()?.role === 'AGENT');
  readonly isCustomer = computed(() => this.currentUserSignal()?.role === 'CLIENT');
  readonly isAdmin = computed(() => this.currentUserSignal()?.isStaff === true);

  private readonly myWallet = inject(MyWalletStore);

  constructor(private readonly http: HttpClient) {}

  /** Logs in and returns the decoded user. Throws (via the observable) on invalid credentials. */
  login(username: string, password: string): Observable<CurrentUser> {
    this.myWallet.clear(); // a different user may be logging in over an existing session
    return this.http.post<TokenPair>(`${environment.apiBaseUrl}/api/token/`, { username, password }).pipe(
      tap((tokens) => this.storeTokens(tokens)),
      map((tokens) => {
        const user = this.userFromAccessToken(tokens.access);
        if (!user) {
          throw new Error('Received an unreadable access token from the server.');
        }
        return user;
      }),
      tap((user) => this.currentUserSignal.set(user)),
    );
  }

  /** Clears the local session immediately (no need to wait on the network for that), and
   * best-effort blacklists the refresh token server-side so it can't be replayed — if that call
   * fails (offline, etc.) the local logout still stands; the token just expires naturally. */
  logout(): void {
    const refresh = this.getRefreshToken();

    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this.currentUserSignal.set(null);
    this.myWallet.clear();

    if (refresh) {
      this.http.post(`${environment.apiBaseUrl}/api/logout/`, { refresh }).pipe(catchError(() => of(null))).subscribe();
    }
  }

  /** Used by the auth interceptor to silently renew an expired access token. */
  refreshAccessToken(): Observable<string> {
    const refresh = this.getRefreshToken();
    return this.http.post<{ access: string }>(`${environment.apiBaseUrl}/api/token/refresh/`, { refresh }).pipe(
      tap(({ access }) => {
        localStorage.setItem(ACCESS_TOKEN_KEY, access);
        this.currentUserSignal.set(this.userFromAccessToken(access));
      }),
      map(({ access }) => access),
    );
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  private storeTokens(tokens: TokenPair): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh);
  }

  private userFromAccessToken(accessToken: string): CurrentUser | null {
    const claims = decodeJwtPayload<AccessTokenClaims>(accessToken);
    return claims ? claimsToUser(claims) : null;
  }

  private restoreUserFromStorage(): CurrentUser | null {
    const access = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (!access || isTokenExpired(access)) {
      return null;
    }
    return this.userFromAccessToken(access);
  }
}
