function escapeCsvValue(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Builds a CSV file client-side and triggers a browser download — no server round-trip needed
 * since the data is already in hand by the time a screen calls this. */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]): void {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(','));
  // A UTF-8 BOM so Excel (which guesses encoding without one) doesn't mangle non-ASCII text.
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
