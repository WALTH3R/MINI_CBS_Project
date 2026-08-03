import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { CustomerService } from '../../core/services/customer.service';
import { WalletService } from '../../core/services/wallet.service';
import { Customer, MaritalStatus } from '../../core/models/customer.model';
import { WalletProfile } from '../../core/models/wallet.model';
import { CurrencyAmountPipe } from '../../shared/pipes/currency-amount.pipe';
import { TransientSignal } from '../../shared/utils/transient-signal';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [DatePipe, CurrencyAmountPipe, FormsModule],
  templateUrl: './customers.html',
})
export class Customers {
  protected readonly auth = inject(AuthService);
  private readonly customerService = inject(CustomerService);
  private readonly walletService = inject(WalletService);

  protected readonly maritalStatuses: MaritalStatus[] = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'];

  protected readonly searchTerm = signal('');
  protected readonly searchResults = signal<Customer[]>([]);
  protected readonly searching = signal(false);
  protected readonly selectedCustomer = signal<Customer | null>(null);
  private readonly search$ = new Subject<string>();

  // --- Agent: enroll a customer ---
  protected readonly showEnrollForm = signal(false);
  protected readonly walletProfiles = signal<WalletProfile[]>([]);
  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly name = signal('');
  protected readonly firstName = signal('');
  protected readonly parentName = signal('');
  protected readonly dateOfBirth = signal('');
  protected readonly maritalStatus = signal<MaritalStatus>('SINGLE');
  protected readonly placeOfBirth = signal('');
  protected readonly nationalIdNumber = signal('');
  protected readonly walletProfileId = signal('');
  protected readonly enrolling = signal(false);
  private readonly enrollErrorMsg = new TransientSignal<string>();
  protected readonly enrollError = this.enrollErrorMsg.value;

  constructor() {
    if (this.auth.isAgent()) {
      this.walletService.listProfiles().subscribe((profiles) => this.walletProfiles.set(profiles));
    }

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
    this.showEnrollForm.set(false);
  }

  clearSelection(): void {
    this.selectedCustomer.set(null);
  }

  openEnrollForm(): void {
    this.selectedCustomer.set(null);
    this.showEnrollForm.set(true);
    this.enrollErrorMsg.set(null);
  }

  cancelEnrollForm(): void {
    this.showEnrollForm.set(false);
  }

  submitEnroll(): void {
    if (
      !this.username() || !this.password() || !this.name() || !this.firstName() ||
      !this.parentName() || !this.dateOfBirth() || !this.placeOfBirth() ||
      !this.nationalIdNumber() || !this.walletProfileId() || this.enrolling()
    ) {
      return;
    }

    this.enrolling.set(true);
    this.enrollErrorMsg.set(null);

    this.customerService
      .create({
        username: this.username(),
        password: this.password(),
        name: this.name(),
        first_name: this.firstName(),
        parent_name: this.parentName(),
        date_of_birth: this.dateOfBirth(),
        marital_status: this.maritalStatus(),
        place_of_birth: this.placeOfBirth(),
        national_id_number: this.nationalIdNumber(),
        wallet_profile_id: this.walletProfileId(),
      })
      .subscribe({
        // The create response is shaped by a write-only serializer (no `wallets`, no
        // `created_at`, username/password omitted) — refetch to get the full read shape.
        next: (customer) => {
          this.customerService.getById(customer.id).subscribe((fresh) => this.selectedCustomer.set(fresh));
          this.enrolling.set(false);
          this.showEnrollForm.set(false);
          this.username.set('');
          this.password.set('');
          this.name.set('');
          this.firstName.set('');
          this.parentName.set('');
          this.dateOfBirth.set('');
          this.maritalStatus.set('SINGLE');
          this.placeOfBirth.set('');
          this.nationalIdNumber.set('');
          this.walletProfileId.set('');
        },
        error: (err: unknown) => {
          this.enrolling.set(false);
          if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object') {
            const firstError = Object.values(err.error as Record<string, string[]>)[0];
            this.enrollErrorMsg.set(Array.isArray(firstError) ? firstError.join(' ') : 'Could not enroll this customer.');
          } else {
            this.enrollErrorMsg.set('Could not enroll this customer. Please check the details.');
          }
        },
      });
  }
}
