import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/** Protects routes that require a logged-in user. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Keeps a logged-in user off the login page — sends them straight to the dashboard. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};

/** Admin-only pages (Agents, Merchants, Wallet profiles, Audit Log, System Health, Error Monitoring). */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAdmin()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};

/** Agent/admin pages (Transactions, Customers) — off-limits to customers. */
export const agentOrAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAgent() || auth.isAdmin()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};

/** Wallet-operation pages (Deposits, Transfers, Payments) — customers act on their own wallet,
 * agents act on a customer's behalf; admins have no wallet to operate on. */
export const agentOrCustomerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAdmin()) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
