import { describe, expect, it } from 'vitest';
import { CurrencyAmountPipe } from './currency-amount.pipe';

describe('CurrencyAmountPipe', () => {
  const pipe = new CurrencyAmountPipe();

  it('formats a decimal string with thousands separators and two decimal places', () => {
    expect(pipe.transform('1234.5')).toBe('1,234.50');
  });

  it('appends the currency code when given', () => {
    expect(pipe.transform('1234.5', 'EUR')).toBe('1,234.50 EUR');
  });

  it('accepts a number as well as a string', () => {
    expect(pipe.transform(99, 'USD')).toBe('99.00 USD');
  });

  it('renders null, undefined, and empty string as an em dash', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
    expect(pipe.transform('')).toBe('—');
  });

  it('rounds to two decimal places', () => {
    expect(pipe.transform('10.999')).toBe('11.00');
  });
});
