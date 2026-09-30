import type { LenderProgram } from '../models/LenderProgram';

/**
 * THE snake_case boundary. This is the only file that knows the CSV's column names,
 * and the one file to review line by line against the real header (CLAUDE.md).
 * Everything downstream is camelCase and typed.
 *
 * Verified against public/lender_programs.csv on 2026-09-30: 17 columns, 49 rows.
 */

/** PapaParse output, cast once at the edge. No runtime validation library. */
export type RawProgramRow = Record<string, string>;

/** The 17 CSV columns, in actual header order. */
export const CSV_COLUMNS = [
  'lender_name',
  'program_type',
  'min_loan_amount',
  'max_loan_amount',
  'min_credit_score',
  'credit_tier_required',
  'min_years_in_business',
  'interest_rate_min',
  'interest_rate_max',
  'max_term_months',
  'sba_guarantee_pct',
  'eligible_business_types',
  'requires_collateral',
  'max_existing_debt_ratio',
  'turnaround_days',
  'special_requirements',
  'last_updated',
] as const;

/** Raw row → typed program. Throws on a row missing required fields (F27). */
export function parseProgram(row: RawProgramRow): LenderProgram {
  throw new Error('parseProgram not implemented');
}

/** True when the parsed header carries every column in CSV_COLUMNS (F27). */
export function hasRequiredColumns(header: string[]): boolean {
  throw new Error('parseProgram.hasRequiredColumns not implemented');
}

/** `last_updated` is M/D/YYYY — Date.parse is not reliable on it, so parse explicitly. */
function parseCsvDate(value: string): Date {
  throw new Error('parseProgram.parseCsvDate not implemented');
}

/** Empty cell → null. Used for max_existing_debt_ratio and special_requirements only. */
function blankToNull(value: string): string | null {
  throw new Error('parseProgram.blankToNull not implemented');
}
