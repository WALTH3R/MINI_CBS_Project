import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../services/auth.service';

const PUBLIC_PATHS = ['/api/token/', '/api/token/refresh/', '/api/logout/'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isPublic = PUBLIC_PATHS.some((path) => req.url.includes(path));
  const token = auth.getAccessToken();

  const authedReq = !isPublic && token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((error: unknown) => {
      const canRetry = error instanceof HttpErrorResponse && error.status === 401
        && !isPublic && !!auth.getRefreshToken();

      if (!canRetry) {
        return throwError(() => error);
      }

      return auth.refreshAccessToken().pipe(
        switchMap((newAccessToken) => {
          const retriedReq = req.clone({ setHeaders: { Authorization: `Bearer ${newAccessToken}` } });
          return next(retriedReq);
        }),
        catchError((refreshError: unknown) => {
          auth.logout();
          router.navigate(['/login']);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
