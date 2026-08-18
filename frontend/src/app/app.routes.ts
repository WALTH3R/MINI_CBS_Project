import { Routes } from '@angular/router';

import { adminGuard, agentOrAdminGuard, agentOrCustomerGuard, authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/signup/signup').then((m) => m.Signup),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'deposits',
        canActivate: [agentOrCustomerGuard],
        loadComponent: () => import('./features/deposits/deposits').then((m) => m.Deposits),
      },
      {
        path: 'transfers',
        canActivate: [agentOrCustomerGuard],
        loadComponent: () => import('./features/transfers/transfers').then((m) => m.Transfers),
      },
      {
        path: 'payments',
        canActivate: [agentOrCustomerGuard],
        loadComponent: () => import('./features/payments/payments').then((m) => m.Payments),
      },
      {
        path: 'transactions',
        canActivate: [agentOrAdminGuard],
        loadComponent: () => import('./features/transactions/transactions').then((m) => m.Transactions),
      },
      {
        path: 'agents',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/agents/agents').then((m) => m.Agents),
      },
      {
        path: 'merchants',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/merchants/merchants').then((m) => m.Merchants),
      },
      {
        path: 'wallet-profiles',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/wallet-profiles/wallet-profiles').then((m) => m.WalletProfiles),
      },
      {
        path: 'customers',
        canActivate: [agentOrAdminGuard],
        loadComponent: () => import('./features/customers/customers').then((m) => m.Customers),
      },
      {
        path: 'audit-log',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/audit-log/audit-log').then((m) => m.AuditLog),
      },
      {
        path: 'system-health',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/system-health/system-health').then((m) => m.SystemHealth),
      },
      {
        path: 'error-monitoring',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/error-monitoring/error-monitoring').then((m) => m.ErrorMonitoring),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
