import { describe, expect, it } from 'vitest';

import { CLOSENESS_WEIGHTS, closenessScore } from '../closeness';
import { makeCriteria, makeProgram } from './fixtures';

/** F12: weights — years 1.0, tier steps/2 1.0, under-min 0.5, over-max 2.0, type 3.0. */
describe('closenessScore', () => {
  it('scores 0 when the borrower clears every criterion', () => {
    expect(closenessScore(makeProgram(), makeCriteria())).toBe(0);
  });

  it('weights a business-type mismatch at 3.0', () => {
    const score = closenessScore(
      makeProgram({ eligibleBusinessTypes: 'Manufacturing' }),
      makeCriteria({ businessType: 'Retail' }),
    );
    expect(score).toBeCloseTo(CLOSENESS_WEIGHTS.businessTypeMismatch);
  });

  it('does not penalise a program open to all business types', () => {
    const score = closenessScore(
      makeProgram({ eligibleBusinessTypes: 'All' }),
      makeCriteria({ businessType: 'Other' }),
    );
    expect(score).toBe(0);
  });

  it('weights over-max loan at 2.0 of the proportional overage', () => {
    // 400k against a 350k cap: overage 50/350, times 2.0.
    const score = closenessScore(
      makeProgram({ maxLoanAmount: 350_000 }),
      makeCriteria({ loanAmount: 400_000 }),
    );
    expect(score).toBeCloseTo((50_000 / 350_000) * 2.0);
  });

  it('weights under-min loan at 0.5 of the proportional shortfall', () => {
    // 10k against a 50k floor: shortfall 40/50 = 0.8, times 0.5.
    const score = closenessScore(
      makeProgram({ minLoanAmount: 50_000 }),
      makeCriteria({ loanAmount: 10_000 }),
    );
    expect(score).toBeCloseTo(0.4);
  });

  it('weights years short at 1.0 of the proportional shortfall', () => {
    // 1 year against a 3-year floor: shortfall 2/3.
    const score = closenessScore(
      makeProgram({ minYearsInBusiness: 3 }),
      makeCriteria({ yearsInBusiness: 1 }),
    );
    expect(score).toBeCloseTo(2 / 3);
  });

  it('halves tier steps short before applying the 1.0 weight', () => {
    const oneStep = closenessScore(
      makeProgram({ creditTierRequired: 'Good' }),
      makeCriteria({ creditTier: 'Fair' }),
    );
    expect(oneStep).toBeCloseTo(0.5);

    // Excellent is never required in the CSV, but the 2-step max must normalise to 1.0.
    const twoSteps = closenessScore(
      makeProgram({ creditTierRequired: 'Excellent' }),
      makeCriteria({ creditTier: 'Fair' }),
    );
    expect(twoSteps).toBeCloseTo(1.0);
  });

  it('sums multiple shortfalls', () => {
    const score = closenessScore(
      makeProgram({
        eligibleBusinessTypes: 'Manufacturing',
        minYearsInBusiness: 2,
        creditTierRequired: 'Good',
        maxLoanAmount: 250_000,
      }),
      makeCriteria({
        businessType: 'Retail',
        yearsInBusiness: 1,
        creditTier: 'Fair',
        loanAmount: 500_000,
      }),
    );
    // type 3.0 + years 0.5 + tier 0.5 + over-max (250/250 × 2.0) = 6.0
    expect(score).toBeCloseTo(3.0 + 0.5 + 0.5 + 2.0);
  });

  it('never penalises a zero-year requirement', () => {
    const score = closenessScore(
      makeProgram({ minYearsInBusiness: 0 }),
      makeCriteria({ yearsInBusiness: 0 }),
    );
    expect(score).toBe(0);
  });
});
