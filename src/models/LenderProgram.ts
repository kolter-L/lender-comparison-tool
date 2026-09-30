import type {
  CollateralRequirement,
  CreditTier,
  EligibleBusinessTypes,
  ProgramType,
} from './enums';

/**
 * One row of public/lender_programs.csv, translated to camelCase.
 * Field order matches the real CSV header. Verified against the file: 49 rows, 17 columns.
 * Only `max_existing_debt_ratio` (9 blanks) and `special_requirements` (15 blanks) are nullable.
 */
export interface LenderProgram {
  /** csv: lender_name — 15 distinct lenders */
  lenderName: string;
  /** csv: program_type */
  programType: ProgramType;
  /** csv: min_loan_amount — soft criterion (F5) */
  minLoanAmount: number;
  /** csv: max_loan_amount — hard criterion (F4). Network max is 5_500_000 (F15). */
  maxLoanAmount: number;
  /** csv: min_credit_score — display only (F6). Never blank. */
  minCreditScore: number;
  /** csv: credit_tier_required — soft criterion (F5). Only 'Fair' and 'Good' occur. */
  creditTierRequired: CreditTier;
  /** csv: min_years_in_business — soft criterion (F5). 1, 2 or 3. */
  minYearsInBusiness: number;
  /** csv: interest_rate_min — percent, e.g. 11 means 11.0%. Match sort key (F8). */
  interestRateMin: number;
  /** csv: interest_rate_max — percent. Always rendered as a range with min (F17, F20). */
  interestRateMax: number;
  /** csv: max_term_months — MONTHS, not years. 84 / 120 / 180 / 240 / 300. */
  maxTermMonths: number;
  /** csv: sba_guarantee_pct — percent, e.g. 85 means 85%. */
  sbaGuaranteePct: number;
  /** csv: eligible_business_types — hard criterion (F4). One value, 'All' matches any type. */
  eligibleBusinessTypes: EligibleBusinessTypes;
  /** csv: requires_collateral — display only (F6). Tri-state. */
  requiresCollateral: CollateralRequirement;
  /** csv: max_existing_debt_ratio — display only (F6). Fraction, e.g. 0.5. Blank in 9 rows. */
  maxExistingDebtRatio: number | null;
  /** csv: turnaround_days — secondary Match sort (F8, F18) */
  turnaroundDays: number;
  /** csv: special_requirements — display only (F6). Blank in 15 rows. */
  specialRequirements: string | null;
  /** csv: last_updated — M/D/YYYY. Staleness (F22) and freshness header (F23). */
  lastUpdated: Date;
}
