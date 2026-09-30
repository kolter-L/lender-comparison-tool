import type { ClassifiedProgram } from '../models/MatchResult';
import { DISCLAIMER_TEXT } from '../models/enums';
import { days, money, percent, rateRange, shortDate, termMonths } from './format';

/** F21: copy the top 3 as plain text. F19's disclaimer is part of the copied text. */

export const COPY_LIMIT = 3;

/** Rate ranges only (F17, never a single figure), plus 'as of' date and the F19 disclaimer. */
export function formatForClipboard(programs: ClassifiedProgram[], asOf: Date): string {
  const lines: string[] = [`Likely fits — rates as of ${shortDate(asOf)}`, ''];

  programs.slice(0, COPY_LIMIT).forEach((classified, index) => {
    const p = classified.program;
    lines.push(
      `${index + 1}. ${p.lenderName} — ${p.programType}`,
      `   Rate: ${rateRange(p)}`,
      `   Loan range: ${money(p.minLoanAmount)} – ${money(p.maxLoanAmount)}`,
      `   Max term: ${termMonths(p.maxTermMonths)}`,
      `   SBA guarantee: ${percent(p.sbaGuaranteePct)}`,
      `   Turnaround: ${days(p.turnaroundDays)}`,
      `   Collateral: ${p.requiresCollateral}`,
    );
    if (p.specialRequirements !== null) {
      lines.push(`   Notes: ${p.specialRequirements}`);
    }
    lines.push(`   Updated: ${shortDate(p.lastUpdated)}`, '');
  });

  lines.push(DISCLAIMER_TEXT);
  return lines.join('\n');
}

/** N4: needs a secure context (HTTPS or localhost). */
export async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator === 'undefined' || navigator.clipboard === undefined) {
    throw new Error('Copying needs a secure connection (HTTPS or localhost).');
  }
  await navigator.clipboard.writeText(text);
}
