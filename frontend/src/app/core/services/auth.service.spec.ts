import { HttpClient, provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

const ACCESS_TOKEN_KEY = 'mini_cbs_access_token';
const REFRESH_TOKEN_KEY = 'mini_cbs_refresh_token';

function fakeToken(payload: Record<string, unknown>): string {
  const base64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `header.${base64}.signature`;
}

function accessClaims(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    token_type: 'access',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    jti: 'abc',
    user_id: 'user-1',
    role: 'AGENT',
    username: 'kev',
    is_staff: false,
    ...overrides,
  };
}

describe('AuthService', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    httpMock?.verify();
    localStorage.clear();
  });

  function setup(): AuthService {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withFetch()), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    TestBed.inject(HttpClient); // ensure the testing HttpClient is the one wired up before AuthService resolves it
    return TestBed.inject(AuthService);
  }

  it('login stores both tokens, decodes the access token, and updates currentUser', () => {
    const service = setup();
    const access = fakeToken(accessClaims({ role: 'AGENT', is_staff: false, username: 'kev', user_id: 'u-1' }));

    let result: unknown;
    service.login('kev', 'pass').subscribe((user) => (result = user));

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/token/`);
    expect(req.request.body).toEqual({ username: 'kev', password: 'pass' });
    req.flush({ access, refresh: 'refresh-token-1' });

    expect(service.getAccessToken()).toBe(access);
    expect(service.getRefreshToken()).toBe('refresh-token-1');
    expect(service.currentUser()?.username).toBe('kev');
    expect(service.isAgent()).toBe(true);
    expect(service.isCustomer()).toBe(false);
    expect(service.isAdmin()).toBe(false);
    expect(result).toEqual(service.currentUser());
  });

  it('isAdmin reflects the is_staff claim, independent of role', () => {
    const service = setup();
    const access = fakeToken(accessClaims({ role: 'CLIENT', is_staff: true }));

    service.login('admin', 'pass').subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/api/token/`).flush({ access, refresh: 'r' });

    expect(service.isCustomer()).toBe(true);
    expect(service.isAdmin()).toBe(true);
  });

  it('logout clears both tokens and resets currentUser immediately, and blacklists the refresh token', () => {
    const service = setup();
    const access = fakeToken(accessClaims());
    service.login('kev', 'pass').subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/api/token/`).flush({ access, refresh: 'refresh-1' });
    expect(service.currentUser()).not.toBeNull();

    service.logout();

    // Local state is cleared synchronously — logout doesn't wait on the network.
    expect(service.getAccessToken()).toBeNull();
    expect(service.getRefreshToken()).toBeNull();
    expect(service.currentUser()).toBeNull();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/logout/`);
    expect(req.request.body).toEqual({ refresh: 'refresh-1' });
    req.flush(null, { status: 205, statusText: 'Reset Content' });
  });

  it('logout still clears local state even if the server-side blacklist call fails', () => {
    const service = setup();
    const access = fakeToken(accessClaims());
    service.login('kev', 'pass').subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/api/token/`).flush({ access, refresh: 'refresh-1' });

    service.logout();

    expect(service.currentUser()).toBeNull();
    httpMock.expectOne(`${environment.apiBaseUrl}/api/logout/`).flush(
      { detail: 'error' }, { status: 400, statusText: 'Bad Request' },
    );
  });

  it('logout does not call the server when there is no refresh token to blacklist', () => {
    const service = setup();

    service.logout();

    expect(service.currentUser()).toBeNull();
    httpMock.verify(); // no /api/logout/ request should have been made
  });

  it('refreshAccessToken posts the stored refresh token and updates the stored access token + currentUser', () => {
    const service = setup();
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1');
    const newAccess = fakeToken(accessClaims({ username: 'refreshed-user' }));

    let returnedToken: string | undefined;
    service.refreshAccessToken().subscribe((token) => (returnedToken = token));

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/api/token/refresh/`);
    expect(req.request.body).toEqual({ refresh: 'refresh-1' });
    req.flush({ access: newAccess });

    expect(returnedToken).toBe(newAccess);
    expect(service.getAccessToken()).toBe(newAccess);
    expect(service.currentUser()?.username).toBe('refreshed-user');
  });

  it('restores currentUser from a valid, unexpired token already in storage — no network call', () => {
    const access = fakeToken(accessClaims({ username: 'restored-user' }));
    localStorage.setItem(ACCESS_TOKEN_KEY, access);

    const service = setup();

    expect(service.currentUser()?.username).toBe('restored-user');
    httpMock.verify(); // no requests should have been made just to restore the session
  });

  it('does not restore a session from an expired token', () => {
    const expiredAccess = fakeToken(accessClaims({ exp: Math.floor(Date.now() / 1000) - 3600 }));
    localStorage.setItem(ACCESS_TOKEN_KEY, expiredAccess);

    const service = setup();

    expect(service.currentUser()).toBeNull();
  });
});
