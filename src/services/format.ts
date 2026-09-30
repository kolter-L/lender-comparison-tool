import type { LenderProgram } from '../models/LenderProgram';

/**
 * Display formatting, shared by the components and the clipboard text so the two can
 * never disagree — F17's "rate range, never a single figure" is enforced in one place.
 *
 * Note: domain/matchPrograms.ts carries its own currency formatter for F13 chip text.
 * That duplication is deliberate — domain/ may not import from services/ (N8).
 */

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function money(amount: number): string {
  return MONEY.format(amount);
}

/** Thousands separators for the loan-amount field as typed (F2). */
export function groupDigits(digits: string): string {
  if (digits === '') return '';
  return Number(digits).toLocaleString('en-US');
}

/** One decimal always, so 7 reads as 7.0% and lines up under 13.6%. */
function ratePercent(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

/** F17, F20: ALWAYS a range. There is no formatter here that returns a single rate. */
export function rateRange(program: LenderProgram): string {
  return `${ratePercent(program.interestRateMin)} – ${ratePercent(program.interestRateMax)}`;
}

export function termMonths(months: number): string {
  return `${months} mo`;
}

export function percent(value: number): string {
  return `${value}%`;
}

export function days(count: number): string {
  return `${count} ${count === 1 ? 'day' : 'days'}`;
}

/** M/D/YYYY, matching the CSV's own format and F23's example. */
export function shortDate(date: Date): string {
  return date.toLocaleDateString('en-US');
}
