import type { BorrowerCriteria } from '../models/BorrowerCriteria';
import type { LenderProgram } from '../models/LenderProgram';
import { ALL_BUSINESS_TYPES } from '../models/enums';
import { tierStepsShort } from './tiers';

/**
 * F12: weighted closeness score, used to sort Closest Available only (F10).
 * Lower is closer. Pure — no clock, no DOM.
 *
 * years short          (req − actual) / req    × 1.0
 * tier steps short     steps / 2               × 1.0
 * under min loan       (req − reqd) / req      × 0.5
 * over max loan        (reqd − max) / max      × 2.0
 * business mismatch    1                       × 3.0
 *
 * Every term is a proportional shortfall in [0, ∞), so the weights are directly
 * comparable. A term contributes 0 when the borrower clears that criterion.
 */
export const CLOSENESS_WEIGHTS = {
  yearsShort: 1.0,
  tierStepsShort: 1.0,
  underMinLoan: 0.5,
  overMaxLoan: 2.0,
  businessTypeMismatch: 3.0,
} as const;

/** Tier steps are halved before weighting: the 2-step max normalises to 1.0. */
const TIER_STEP_DIVISOR = 2;

export function closenessScore(program: LenderProgram, criteria: BorrowerCriteria): number {
  return (
    yearsTerm(program, criteria) +
    tierTerm(program, criteria) +
    underMinLoanTerm(program, criteria) +
    overMaxLoanTerm(program, criteria) +
    businessTypeTerm(program, criteria)
  );
}

function yearsTerm(program: LenderProgram, criteria: BorrowerCriteria): number {
  const required = program.minYearsInBusiness;
  // A zero requirement cannot be missed, and guards the division.
  if (required <= 0 || criteria.yearsInBusiness >= required) return 0;
  const shortfall = (required - criteria.yearsInBusiness) / required;
  return shortfall * CLOSENESS_WEIGHTS.yearsShort;
}

function tierTerm(program: LenderProgram, criteria: BorrowerCriteria): number {
  const steps = tierStepsShort(criteria.creditTier, program.creditTierRequired);
  return (steps / TIER_STEP_DIVISOR) * CLOSENESS_WEIGHTS.tierStepsShort;
}

function underMinLoanTerm(program: LenderProgram, criteria: BorrowerCriteria): number {
  const required = program.minLoanAmount;
  if (required <= 0 || criteria.loanAmount >= required) return 0;
  const shortfall = (required - criteria.loanAmount) / required;
  return shortfall * CLOSENESS_WEIGHTS.underMinLoan;
}

function overMaxLoanTerm(program: LenderProgram, criteria: BorrowerCriteria): number {
  const max = program.maxLoanAmount;
  if (max <= 0 || criteria.loanAmount <= max) return 0;
  const overage = (criteria.loanAmount - max) / max;
  return overage * CLOSENESS_WEIGHTS.overMaxLoan;
}

function businessTypeTerm(program: LenderProgram, criteria: BorrowerCriteria): number {
  if (program.eligibleBusinessTypes === ALL_BUSINESS_TYPES) return 0;
  if (program.eligibleBusinessTypes === criteria.businessType) return 0;
  return CLOSENESS_WEIGHTS.businessTypeMismatch;
}
