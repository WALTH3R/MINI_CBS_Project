import { bootstrapApplication } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { inject as injectAnalytics } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { filter } from 'rxjs';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

// Only beacons from the deployed (Vercel) build — local dev traffic shouldn't skew the numbers.
// Also requires Web Analytics / Speed Insights to be turned on for this project in the Vercel
// dashboard.
if (environment.production) {
  injectAnalytics();
}
const speedInsights = environment.production ? injectSpeedInsights() : null;

bootstrapApplication(App, appConfig)
  .then((appRef) => {
    // This is an SPA — without this, every route change would still get attributed to
    // whatever path the page first loaded on, making the per-page Web Vitals breakdown useless.
    if (speedInsights) {
      const router = appRef.injector.get(Router);
      router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event) => speedInsights.setRoute(event.urlAfterRedirects));
    }
  })
  .catch((err) => console.error(err));
