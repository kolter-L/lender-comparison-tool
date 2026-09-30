import type { BorrowerCriteria } from '../../models/BorrowerCriteria';
import type { LenderProgram } from '../../models/LenderProgram';

/**
 * Test fixtures. Values are taken from real rows of public/lender_programs.csv so the
 * shapes stay honest (rates as percents, term in months, collateral tri-state).
 *
 * The defaults are built so makeCriteria() is a FULL MATCH against makeProgram():
 * 100k sits inside 25k–350k, 'All' serves Retail, 5 yrs clears 2, Good meets Good.
 * Each test then breaks exactly the one criterion it is about.
 */

export function makeProgram(overrides: Partial<LenderProgram> = {}): LenderProgram {
  return {
    id: 'row-2',
    lenderName: 'First National Bank',
    programType: 'SBA Express',
    minLoanAmount: 25_000,
    maxLoanAmount: 350_000,
    minCreditScore: 680,
    creditTierRequired: 'Good',
    minYearsInBusiness: 2,
    interestRateMin: 11.4,
    interestRateMax: 12.5,
    maxTermMonths: 84,
    sbaGuaranteePct: 50,
    eligibleBusinessTypes: 'All',
    requiresCollateral: 'No',
    maxExistingDebtRatio: 0.45,
    turnaroundDays: 13,
    specialRequirements: 'Requires 10% owner injection',
    lastUpdated: new Date(2026, 0, 2),
    ...overrides,
  };
}

export function makeCriteria(overrides: Partial<BorrowerCriteria> = {}): BorrowerCriteria {
  return {
    loanAmount: 100_000,
    businessType: 'Retail',
    yearsInBusiness: 5,
    creditTier: 'Good',
    ...overrides,
  };
}
