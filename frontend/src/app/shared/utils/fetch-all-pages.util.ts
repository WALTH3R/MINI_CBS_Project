import { EMPTY, Observable, expand, reduce } from 'rxjs';

import { PaginatedResponse } from '../../core/models/pagination.model';

/** Follows `next` until exhausted and collects every page into one array — for when a screen
 * needs the full filtered result set (dashboard totals, CSV export), not just the first page. */
export function fetchAllPages<T>(
  first$: Observable<PaginatedResponse<T>>,
  loadMore: (url: string) => Observable<PaginatedResponse<T>>,
): Observable<T[]> {
  return first$.pipe(
    expand((response) => (response.next ? loadMore(response.next) : EMPTY)),
    reduce((all: T[], response) => [...all, ...response.results], [] as T[]),
  );
}
