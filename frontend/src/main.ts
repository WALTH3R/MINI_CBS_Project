import { bootstrapApplication } from '@angular/platform-browser';
import { inject as injectAnalytics } from '@vercel/analytics';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

// Only beacons from the deployed (Vercel) build — local dev traffic shouldn't skew the numbers.
// Also requires Web Analytics to be turned on for this project in the Vercel dashboard.
if (environment.production) {
  injectAnalytics();
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
