import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../core/services/auth.service';
import { IdleTimeoutService } from '../core/services/idle-timeout.service';
import { MyWalletStore } from '../core/services/my-wallet.store';
import { ThemeService } from '../core/services/theme.service';
import { CurrencyAmountPipe } from '../shared/pipes/currency-amount.pipe';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CurrencyAmountPipe],
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  protected readonly myWallet = inject(MyWalletStore);
  protected readonly themeService = inject(ThemeService);
  // Injected (not otherwise referenced) purely to start it — it self-manages via
  // AuthService.isAuthenticated, and the warning modal below reads its signals directly.
  protected readonly idleTimeout = inject(IdleTimeoutService);
  private readonly router = inject(Router);

  protected readonly switcherOpen = signal(false);
  protected readonly adminMenuOpen = signal(false);
  protected readonly monitoringMenuOpen = signal(false);
  protected readonly mobileMenuOpen = signal(false);

  protected readonly roleLabel = () => {
    const user = this.auth.currentUser();
    if (!user) return '';
    if (user.isStaff) return 'Admin';
    return user.role === 'AGENT' ? 'Agent' : 'Customer';
  };

  constructor() {
    if (this.auth.isCustomer()) {
      this.myWallet.ensureLoaded().subscribe();
    }
  }

  toggleSwitcher(): void {
    this.switcherOpen.update((open) => !open);
  }

  toggleAdminMenu(): void {
    this.monitoringMenuOpen.set(false);
    this.adminMenuOpen.update((open) => !open);
  }

  toggleMonitoringMenu(): void {
    this.adminMenuOpen.set(false);
    this.monitoringMenuOpen.update((open) => !open);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  closeMenus(): void {
    this.adminMenuOpen.set(false);
    this.monitoringMenuOpen.set(false);
    this.mobileMenuOpen.set(false);
  }

  pickWallet(id: string): void {
    this.myWallet.selectWallet(id);
    this.switcherOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
