import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { CustomerService } from '../../../core/services/customer.service';
import { ThemeService } from '../../../core/services/theme.service';
import { MaritalStatus } from '../../../core/models/customer.model';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.html',
})
export class Signup {
  private readonly customerService = inject(CustomerService);
  protected readonly themeService = inject(ThemeService);

  protected readonly maritalStatuses: MaritalStatus[] = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'];

  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly name = signal('');
  protected readonly firstName = signal('');
  protected readonly parentName = signal('');
  protected readonly dateOfBirth = signal('');
  protected readonly maritalStatus = signal<MaritalStatus>('SINGLE');
  protected readonly placeOfBirth = signal('');
  protected readonly nationalIdNumber = signal('');

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly submitted = signal(false);

  submit(): void {
    if (
      !this.username() || !this.password() || !this.name() || !this.firstName() ||
      !this.parentName() || !this.dateOfBirth() || !this.placeOfBirth() ||
      !this.nationalIdNumber() || this.submitting()
    ) {
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.customerService
      .signup({
        username: this.username(),
        password: this.password(),
        name: this.name(),
        first_name: this.firstName(),
        parent_name: this.parentName(),
        date_of_birth: this.dateOfBirth(),
        marital_status: this.maritalStatus(),
        place_of_birth: this.placeOfBirth(),
        national_id_number: this.nationalIdNumber(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.submitted.set(true);
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object') {
            const firstError = Object.values(err.error as Record<string, string[]>)[0];
            this.errorMessage.set(Array.isArray(firstError) ? firstError.join(' ') : 'Could not submit your request.');
          } else {
            this.errorMessage.set('Could not submit your request. Please check the details and try again.');
          }
        },
      });
  }
}
