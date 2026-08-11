import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from '../services/auth.service';
import { adminGuard, agentOrAdminGuard, agentOrCustomerGuard, authGuard, guestGuard } from './auth.guard';

function setup(isAuthenticated: boolean) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { isAuthenticated: () => isAuthenticated } },
    ],
  });
  return TestBed.inject(Router);
}

function setupRole(role: { isAgent?: boolean; isAdmin?: boolean }) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          isAgent: () => role.isAgent ?? false,
          isAdmin: () => role.isAdmin ?? false,
        },
      },
    ],
  });
  return TestBed.inject(Router);
}

describe('authGuard', () => {
  it('allows navigation when the user is authenticated', () => {
    setup(true);
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/dashboard' } as never),
    );
    expect(result).toBe(true);
  });

  it('redirects to /login with a returnUrl when the user is not authenticated', () => {
    const router = setup(false);
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/agents' } as never),
    ) as UrlTree;

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result)).toBe('/login?returnUrl=%2Fagents');
  });
});

describe('guestGuard', () => {
  it('allows navigation when the user is not authenticated', () => {
    setup(false);
    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('redirects an already-authenticated user to /dashboard', () => {
    const router = setup(true);
    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never)) as UrlTree;

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result)).toBe('/dashboard');
  });
});

describe('adminGuard', () => {
  it('allows an admin through', () => {
    setupRole({ isAdmin: true });
    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('redirects a non-admin (e.g. a customer) to /dashboard', () => {
    const router = setupRole({});
    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never)) as UrlTree;

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result)).toBe('/dashboard');
  });
});

describe('agentOrAdminGuard', () => {
  it('allows an agent through', () => {
    setupRole({ isAgent: true });
    const result = TestBed.runInInjectionContext(() => agentOrAdminGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('allows an admin through', () => {
    setupRole({ isAdmin: true });
    const result = TestBed.runInInjectionContext(() => agentOrAdminGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('redirects a customer to /dashboard', () => {
    const router = setupRole({});
    const result = TestBed.runInInjectionContext(() => agentOrAdminGuard({} as never, {} as never)) as UrlTree;

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result)).toBe('/dashboard');
  });
});

describe('agentOrCustomerGuard', () => {
  it('allows an agent through', () => {
    setupRole({ isAgent: true });
    const result = TestBed.runInInjectionContext(() => agentOrCustomerGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('allows a customer through', () => {
    setupRole({});
    const result = TestBed.runInInjectionContext(() => agentOrCustomerGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('redirects an admin to /dashboard', () => {
    const router = setupRole({ isAdmin: true });
    const result = TestBed.runInInjectionContext(() => agentOrCustomerGuard({} as never, {} as never)) as UrlTree;

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result)).toBe('/dashboard');
  });
});
