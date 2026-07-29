import { HttpParams } from '@angular/common/http';

/**
 * Builds HttpParams from a plain filters object, skipping undefined/null/empty-string values.
 * Typed as `object` (not `Record<string, ...>`) so any concrete filter interface can be passed
 * directly — TS won't structurally match a plain interface against an indexed Record type.
 */
export function toHttpParams(filters: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}
