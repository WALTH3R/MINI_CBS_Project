import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly roleLabel = () => {
    const user = this.auth.currentUser();
    if (!user) return '';
    if (user.isStaff) return 'Admin';
    return user.role === 'AGENT' ? 'Agent' : 'Customer';
  };

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
