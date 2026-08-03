import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
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
        loadComponent: () => import('./features/deposits/deposits').then((m) => m.Deposits),
      },
      {
        path: 'transfers',
        loadComponent: () => import('./features/transfers/transfers').then((m) => m.Transfers),
      },
      {
        path: 'payments',
        loadComponent: () => import('./features/payments/payments').then((m) => m.Payments),
      },
      {
        path: 'transactions',
        loadComponent: () => import('./features/transactions/transactions').then((m) => m.Transactions),
      },
      {
        path: 'agents',
        loadComponent: () => import('./features/agents/agents').then((m) => m.Agents),
      },
      {
        path: 'merchants',
        loadComponent: () => import('./features/merchants/merchants').then((m) => m.Merchants),
      },
      {
        path: 'wallet-profiles',
        loadComponent: () => import('./features/wallet-profiles/wallet-profiles').then((m) => m.WalletProfiles),
      },
      {
        path: 'customers',
        loadComponent: () => import('./features/customers/customers').then((m) => m.Customers),
      },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
