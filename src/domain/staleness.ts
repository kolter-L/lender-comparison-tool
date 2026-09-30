import type { LenderProgram } from '../models/LenderProgram';

/** F22. `today` is injected — never call Date.now() in here (CLAUDE.md, N8). */

export const STALENESS_THRESHOLD_DAYS = 30;

/**
 * Calendar-day difference, ignoring time of day. Normalising both ends to UTC midnight
 * keeps the count DST-safe — a local-midnight subtraction across a DST boundary can
 * otherwise land on 29.958 days and silently flip the comparison.
 */
function calendarDaysBetween(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return (toUtc - fromUtc) / 86_400_000;
}

/** True when program.lastUpdated is more than 30 days before `today`. */
export function evaluateStaleness(program: LenderProgram, today: Date): boolean {
  return calendarDaysBetween(program.lastUpdated, today) > STALENESS_THRESHOLD_DAYS;
}

/** F23: the dataset-level 'Rates as of' date — the newest lastUpdated across all rows. */
export function datasetFreshness(programs: LenderProgram[]): Date | null {
  if (programs.length === 0) return null;
  return programs.reduce(
    (newest, p) => (p.lastUpdated.getTime() > newest.getTime() ? p.lastUpdated : newest),
    programs[0]!.lastUpdated,
  );
}
