import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  // Injected here (not lazily by whichever component happens to need it first) so the
  // data-theme attribute is set at bootstrap, before the first paint.
  private readonly theme = inject(ThemeService);
}
