import type { LenderProgram } from '../models/LenderProgram';
import type { CollateralRequirement, CreditTier } from '../models/enums';
import { CREDIT_TIERS } from '../models/enums';

/**
 * THE snake_case boundary. This is the only file that knows the CSV's column names,
 * and the one file to review line by line against the real header (CLAUDE.md).
 * Everything downstream is camelCase and typed.
 *
 * Verified against public/lender_programs.csv on 2026-09-30: 17 columns, 49 rows.
 *
 * Validation is deliberately shallow (SPEC.md: no runtime validation library). It checks
 * that required cells exist and coerce, and that the two values the domain does arithmetic
 * on — credit tier and collateral — are in range. Display-only strings are cast.
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

const COLLATERAL_VALUES: readonly string[] = ['Yes', 'No', 'Varies'];

/** True when the parsed header carries every column in CSV_COLUMNS (F27). */
export function hasRequiredColumns(header: string[]): boolean {
  const present = new Set(header.map((h) => h.trim()));
  return CSV_COLUMNS.every((column) => present.has(column));
}

/**
 * The CSV line a row came from: 0-based data index, plus 1 for the header and 1 to be
 * 1-based. Row 0 is line 2 of the file, which is what a spreadsheet shows.
 */
export function csvLineNumber(index: number): number {
  return index + 2;
}

/** Stable, collision-proof id for one loaded row. See LenderProgram.id. */
export function makeProgramId(index: number): string {
  return `row-${csvLineNumber(index)}`;
}

/**
 * Raw row → typed program. Throws on a row missing required fields (F27).
 * `index` is the row's 0-based position in the parsed data, used only to mint the id.
 */
export function parseProgram(row: RawProgramRow, index: number): LenderProgram {
  // Read the name first so every later failure can say which row broke.
  const lenderName = requireText(row, 'lender_name', label(index, '?'));
  const where = label(index, lenderName);

  return {
    id: makeProgramId(index),
    lenderName,
    programType: requireText(row, 'program_type', where) as LenderProgram['programType'],
    minLoanAmount: requireNumber(row, 'min_loan_amount', where),
    maxLoanAmount: requireNumber(row, 'max_loan_amount', where),
    minCreditScore: requireNumber(row, 'min_credit_score', where),
    creditTierRequired: requireCreditTier(row, where),
    minYearsInBusiness: requireNumber(row, 'min_years_in_business', where),
    interestRateMin: requireNumber(row, 'interest_rate_min', where),
    interestRateMax: requireNumber(row, 'interest_rate_max', where),
    maxTermMonths: requireNumber(row, 'max_term_months', where),
    sbaGuaranteePct: requireNumber(row, 'sba_guarantee_pct', where),
    eligibleBusinessTypes: requireText(
      row,
      'eligible_business_types',
      where,
    ) as LenderProgram['eligibleBusinessTypes'],
    requiresCollateral: requireCollateral(row, where),
    maxExistingDebtRatio: optionalNumber(row, 'max_existing_debt_ratio', where),
    turnaroundDays: requireNumber(row, 'turnaround_days', where),
    specialRequirements: blankToNull(cell(row, 'special_requirements')),
    lastUpdated: parseCsvDate(requireText(row, 'last_updated', where), where),
  };
}

// --- cell readers -----------------------------------------------------------

/** PapaParse omits trailing cells on a short row, so an absent key is '' here, not undefined. */
function cell(row: RawProgramRow, column: string): string {
  const value: string | undefined = row[column];
  return value === undefined || value === null ? '' : value.trim();
}

/** e.g. "row 14: First National Bank" — enough for ops to find the line in a spreadsheet. */
function label(index: number, lenderName: string): string {
  return `row ${csvLineNumber(index)}: ${lenderName}`;
}

function fail(column: string, where: string, detail: string): never {
  throw new Error(`${column} ${detail} (${where})`);
}

function requireText(row: RawProgramRow, column: string, where: string): string {
  const value = cell(row, column);
  if (value === '') fail(column, where, 'is required but blank');
  return value;
}

function requireNumber(row: RawProgramRow, column: string, where: string): number {
  const raw = requireText(row, column, where);
  // Number('') is 0, so the blank check above has to come first.
  const value = Number(raw);
  if (!Number.isFinite(value)) fail(column, where, `is not a number: "${raw}"`);
  return value;
}

/** Only for NULLABLE_COLUMNS: a blank cell is data, not an error. */
function optionalNumber(row: RawProgramRow, column: string, where: string): number | null {
  const raw = cell(row, column);
  if (raw === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) fail(column, where, `is not a number: "${raw}"`);
  return value;
}

/** Empty cell → null. Used for max_existing_debt_ratio and special_requirements only. */
function blankToNull(value: string): string | null {
  return value === '' ? null : value;
}

// --- the two values the domain does arithmetic on ---------------------------

/**
 * Validated, not cast: an unrecognised tier would make tierRank() return undefined and
 * every tier comparison silently NaN-false — the blank-cell failure mode one level down.
 */
function requireCreditTier(row: RawProgramRow, where: string): CreditTier {
  const raw = requireText(row, 'credit_tier_required', where);
  const tier = CREDIT_TIERS.find((t) => t === raw);
  if (tier === undefined) {
    fail('credit_tier_required', where, `is not a known tier: "${raw}"`);
  }
  return tier;
}

function requireCollateral(row: RawProgramRow, where: string): CollateralRequirement {
  const raw = requireText(row, 'requires_collateral', where);
  if (!COLLATERAL_VALUES.includes(raw)) {
    fail('requires_collateral', where, `is not Yes/No/Varies: "${raw}"`);
  }
  return raw as CollateralRequirement;
}

// --- dates ------------------------------------------------------------------

/**
 * `last_updated` is M/D/YYYY. Date.parse on that string is implementation-defined and
 * drifts by timezone, so the parts are split and rebuilt as a local date explicitly.
 */
function parseCsvDate(value: string, where: string): Date {
  const parts = value.split('/');
  if (parts.length !== 3) fail('last_updated', where, `is not M/D/YYYY: "${value}"`);

  const [month, day, year] = parts.map(Number);
  if (![month, day, year].every((n) => Number.isInteger(n))) {
    fail('last_updated', where, `is not M/D/YYYY: "${value}"`);
  }

  const date = new Date(year!, month! - 1, day!);
  // Rebuilding catches impossible dates: new Date(2026, 1, 30) rolls into March.
  if (date.getFullYear() !== year || date.getMonth() !== month! - 1 || date.getDate() !== day) {
    fail('last_updated', where, `is not a real date: "${value}"`);
  }
  return date;
}
