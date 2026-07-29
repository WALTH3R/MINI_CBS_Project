import { Pipe, PipeTransform } from '@angular/core';

/** API amounts are decimal strings like "1234.50" — format as "1,234.50 EUR". */
@Pipe({ name: 'currencyAmount', standalone: true })
export class CurrencyAmountPipe implements PipeTransform {
  private readonly formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  transform(amount: string | number | null | undefined, currency?: string): string {
    if (amount === null || amount === undefined || amount === '') {
      return '—';
    }
    const formatted = this.formatter.format(Number(amount));
    return currency ? `${formatted} ${currency}` : formatted;
  }
}
