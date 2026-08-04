import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

function setup(authMock: Partial<AuthService>) {
  const routerMock = { navigate: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: authMock },
      { provide: Router, useValue: routerMock },
    ],
  });

  return {
    http: TestBed.inject(HttpClient),
    httpMock: TestBed.inject(HttpTestingController),
    router: routerMock,
  };
}

describe('authInterceptor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches the access token as a bearer header on a non-public request', () => {
    const { http, httpMock } = setup({ getAccessToken: () => 'access-1', getRefreshToken: () => null });

    http.get('/api/accounts/customers/').subscribe();

    const req = httpMock.expectOne('/api/accounts/customers/');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-1');
    req.flush({});
    httpMock.verify();
  });

  it('does not attach a token to the login endpoint even when one exists', () => {
    const { http, httpMock } = setup({ getAccessToken: () => 'access-1', getRefreshToken: () => null });

    http.post('/api/token/', { username: 'a', password: 'b' }).subscribe();

    const req = httpMock.expectOne('/api/token/');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    httpMock.verify();
  });

  it('on a 401 with a refresh token available, silently refreshes and retries the original request', () => {
    const refreshAccessToken = vi.fn().mockReturnValue(of('access-2'));
    const { http, httpMock } = setup({
      getAccessToken: () => 'access-1',
      getRefreshToken: () => 'refresh-1',
      refreshAccessToken,
    });

    let result: unknown;
    http.get('/api/accounts/customers/').subscribe((res) => (result = res));

    const firstReq = httpMock.expectOne('/api/accounts/customers/');
    firstReq.flush({ detail: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(refreshAccessToken).toHaveBeenCalledOnce();

    const retriedReq = httpMock.expectOne('/api/accounts/customers/');
    expect(retriedReq.request.headers.get('Authorization')).toBe('Bearer access-2');
    retriedReq.flush({ ok: true });

    expect(result).toEqual({ ok: true });
    httpMock.verify();
  });

  it('logs out and redirects to /login when the refresh call itself fails, propagating the error', () => {
    const logout = vi.fn();
    const refreshAccessToken = vi.fn().mockReturnValue(throwError(() => new Error('refresh failed')));
    const { http, httpMock, router } = setup({
      getAccessToken: () => 'access-1',
      getRefreshToken: () => 'refresh-1',
      refreshAccessToken,
      logout,
    });

    let caughtError: unknown;
    http.get('/api/accounts/customers/').subscribe({ error: (err) => (caughtError = err) });

    const firstReq = httpMock.expectOne('/api/accounts/customers/');
    firstReq.flush({ detail: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(logout).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(caughtError).toBeInstanceOf(Error);
    httpMock.verify();
  });

  it('does not attempt a refresh on a 401 when there is no refresh token', () => {
    const refreshAccessToken = vi.fn();
    const { http, httpMock } = setup({
      getAccessToken: () => 'access-1',
      getRefreshToken: () => null,
      refreshAccessToken,
    });

    let caughtError: unknown;
    http.get('/api/accounts/customers/').subscribe({ error: (err) => (caughtError = err) });

    const req = httpMock.expectOne('/api/accounts/customers/');
    req.flush({ detail: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect(caughtError).toBeTruthy();
    httpMock.verify();
  });
});
