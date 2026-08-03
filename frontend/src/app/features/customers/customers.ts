import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { CustomerService } from '../../core/services/customer.service';
import { Customer } from '../../core/models/customer.model';
import { CurrencyAmountPipe } from '../../shared/pipes/currency-amount.pipe';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [DatePipe, CurrencyAmountPipe],
  templateUrl: './customers.html',
})
export class Customers {
  private readonly customerService = inject(CustomerService);

  protected readonly searchTerm = signal('');
  protected readonly searchResults = signal<Customer[]>([]);
  protected readonly searching = signal(false);
  protected readonly selectedCustomer = signal<Customer | null>(null);
  private readonly search$ = new Subject<string>();

  constructor() {
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          if (!term.trim()) {
            this.searching.set(false);
            return [];
          }
          this.searching.set(true);
          return this.customerService.list(term);
        }),
      )
      .subscribe({
        next: (results) => {
          this.searchResults.set(results);
          this.searching.set(false);
        },
        error: () => this.searching.set(false),
      });
  }

  onSearchInput(term: string): void {
    this.searchTerm.set(term);
    this.search$.next(term);
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer.set(customer);
    this.searchResults.set([]);
    this.searchTerm.set('');
  }

  clearSelection(): void {
    this.selectedCustomer.set(null);
  }
}
