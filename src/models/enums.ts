// Domain vocabulary. Types only — no logic (see CLAUDE.md layering rules).
// Every value below is taken from the distinct values in public/lender_programs.csv.

/** F3, F5. Ordered floor: Excellent >= Good >= Fair. Ordering logic lives in domain/tiers.ts. */
export type CreditTier = 'Excellent' | 'Good' | 'Fair';

export const CREDIT_TIERS: readonly CreditTier[] = ['Excellent', 'Good', 'Fair'];

/**
 * F3. The CSV's `eligible_business_types` column holds exactly 6 concrete types plus the
 * 'All' sentinel, so the form offers those 6 + 'Other' — 7 options.
 * NOTE: F3 says "7 fixed values + Other" (8). The data supports only 6 + Other. See report.
 */
export type BusinessType =
  | 'Construction'
  | 'Healthcare'
  | 'Manufacturing'
  | 'Professional Services'
  | 'Restaurant/Food Service'
  | 'Retail'
  | 'Other';

export const BUSINESS_TYPES: readonly BusinessType[] = [
  'Construction',
  'Healthcare',
  'Manufacturing',
  'Professional Services',
  'Restaurant/Food Service',
  'Retail',
  'Other',
];

/** F4: the sentinel in `eligible_business_types` that matches any type, including 'Other'. */
export const ALL_BUSINESS_TYPES = 'All';

/**
 * What a program's `eligible_business_types` cell can hold: one concrete type or 'All'.
 * It is a single value, never a delimited list — all 49 rows carry exactly one.
 * 'Other' never appears here, which is why F4 says 'Other' matches only 'All' rows.
 */
export type EligibleBusinessTypes = Exclude<BusinessType, 'Other'> | typeof ALL_BUSINESS_TYPES;

/** Display-only (F17). The 5 values in the `program_type` column. */
export type ProgramType =
  | '504 Loan'
  | '7(a) Small Loan'
  | '7(a) Standard'
  | 'Community Advantage'
  | 'SBA Express';

/** Display-only (F6, F17). `requires_collateral` is tri-state, not a boolean. */
export type CollateralRequirement = 'Yes' | 'No' | 'Varies';

/** Fields a borrower can miss. Hard (F4) and soft (F5) only — F6 fields are never missed. */
export type MissField =
  | 'maxLoanAmount'
  | 'eligibleBusinessTypes'
  | 'minLoanAmount'
  | 'minYearsInBusiness'
  | 'creditTierRequired';

export type MissSeverity = 'hard' | 'soft';

/**
 * F19/F20. The exact non-binding wording, shared by the on-screen disclaimer and the
 * copied text. Never say 'qualified', 'approved' or 'eligible' about a borrower result.
 */
export const DISCLAIMER_TEXT =
  'Likely fit — subject to full eligibility review. Not a pre-approval.';
