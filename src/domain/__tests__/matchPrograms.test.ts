import { describe, expect, it } from 'vitest';

import { SECTION_CAP, matchPrograms } from '../matchPrograms';
import { makeCriteria, makeProgram } from './fixtures';

const missFields = (misses: { field: string }[]) => misses.map((m) => m.field);

describe('matchPrograms', () => {
  // --- the six required cases ---------------------------------------------

  it('puts a full match in Match with no misses (F7, F8)', () => {
    const program = makeProgram();
    const result = matchPrograms(makeCriteria(), [program], 'rate');

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]!.program).toBe(program);
    expect(result.matches[0]!.misses).toEqual([]);
    expect(result.matches[0]!.closenessScore).toBe(0);
    expect(result.nearMisses).toEqual([]);
    expect(result.closestAvailable).toEqual([]);
    expect(result.blocker).toBeNull();
  });

  it('puts a single soft miss in Near Miss with F13 chip text (F5, F9)', () => {
    const result = matchPrograms(
      makeCriteria({ yearsInBusiness: 1 }),
      [makeProgram({ minYearsInBusiness: 2 })],
      'rate',
    );

    expect(result.matches).toEqual([]);
    expect(result.nearMisses).toHaveLength(1);
    expect(result.nearMisses[0]!.misses).toHaveLength(1);
    expect(result.nearMisses[0]!.misses[0]).toEqual({
      field: 'minYearsInBusiness',
      severity: 'soft',
      text: 'Needs 2 yrs in business — borrower has 1',
    });
    expect(result.closestAvailable).toEqual([]);
    // Near Miss is non-empty, so no blocker (F15).
    expect(result.blocker).toBeNull();
  });

  it('puts two soft misses in Near Miss (F9)', () => {
    const result = matchPrograms(
      makeCriteria({ yearsInBusiness: 1, creditTier: 'Fair' }),
      [makeProgram({ minYearsInBusiness: 3, creditTierRequired: 'Good' })],
      'rate',
    );

    expect(result.nearMisses).toHaveLength(1);
    expect(missFields(result.nearMisses[0]!.misses)).toEqual([
      'minYearsInBusiness',
      'creditTierRequired',
    ]);
    expect(result.nearMisses[0]!.misses.every((m) => m.severity === 'soft')).toBe(true);
    expect(result.closestAvailable).toEqual([]);
  });

  it('sends a hard miss on max_loan_amount to Closest Available (F4, F7)', () => {
    const result = matchPrograms(
      makeCriteria({ loanAmount: 400_000 }),
      [makeProgram({ maxLoanAmount: 350_000 })],
      'rate',
    );

    expect(result.matches).toEqual([]);
    expect(result.nearMisses).toEqual([]);
    expect(result.closestAvailable).toHaveLength(1);

    const [only] = result.closestAvailable;
    expect(only!.misses).toHaveLength(1);
    expect(only!.misses[0]!.severity).toBe('hard');
    expect(only!.misses[0]!.field).toBe('maxLoanAmount');
    expect(only!.misses[0]!.text).toBe('Caps at $350,000 — borrower needs $400,000');
  });

  it('sends a hard miss on business type to Closest Available (F4, F7)', () => {
    const result = matchPrograms(
      makeCriteria({ businessType: 'Retail' }),
      [makeProgram({ eligibleBusinessTypes: 'Manufacturing' })],
      'rate',
    );

    expect(result.matches).toEqual([]);
    expect(result.nearMisses).toEqual([]);
    expect(result.closestAvailable).toHaveLength(1);

    const [only] = result.closestAvailable;
    expect(only!.misses[0]).toEqual({
      field: 'eligibleBusinessTypes',
      severity: 'hard',
      text: 'Serves Manufacturing only — borrower is Retail',
    });
    // Business-type mismatch alone is weighted 3.0 (F12).
    expect(only!.closenessScore).toBeCloseTo(3.0);
  });

  it('returns a blocker naming the network max when nothing fits (F11, F14, F15)', () => {
    const programs = [
      makeProgram({ lenderName: 'Atlas', maxLoanAmount: 5_500_000 }),
      makeProgram({ lenderName: 'Coastal', maxLoanAmount: 5_000_000 }),
      makeProgram({ lenderName: 'Summit', maxLoanAmount: 350_000 }),
    ];
    const result = matchPrograms(makeCriteria({ loanAmount: 6_000_000 }), programs, 'rate');

    expect(result.matches).toEqual([]);
    expect(result.nearMisses).toEqual([]);
    expect(result.blocker).toEqual({
      headline: 'No programs cover $6,000,000 — the highest in our network is $5,500,000',
    });
    // F11: Closest Available is still populated — it carries the answer.
    expect(result.closestAvailable).toHaveLength(3);
    // Closest first: the 5.5M cap is the smallest proportional overage.
    expect(result.closestAvailable[0]!.program.lenderName).toBe('Atlas');
    expect(result.closestAvailable.at(-1)!.program.lenderName).toBe('Summit');
  });

  // --- rules the six cases do not pin down --------------------------------

  it('classifies every program into exactly one section (F7)', () => {
    const programs = [
      makeProgram({ lenderName: 'match' }),
      makeProgram({ lenderName: 'near', minYearsInBusiness: 9 }),
      makeProgram({ lenderName: 'hard', eligibleBusinessTypes: 'Healthcare' }),
    ];
    const result = matchPrograms(makeCriteria(), programs, 'rate');

    const placed = [...result.matches, ...result.nearMisses, ...result.closestAvailable];
    expect(placed).toHaveLength(programs.length);
    expect(new Set(placed.map((c) => c.program.lenderName)).size).toBe(programs.length);
  });

  it('sends three soft misses to Closest Available, not Near Miss (F9, F10)', () => {
    const result = matchPrograms(
      makeCriteria({ loanAmount: 10_000, yearsInBusiness: 0, creditTier: 'Fair' }),
      [makeProgram({ minLoanAmount: 50_000, minYearsInBusiness: 2, creditTierRequired: 'Good' })],
      'rate',
    );

    expect(result.nearMisses).toEqual([]);
    expect(result.closestAvailable).toHaveLength(1);
    expect(result.closestAvailable[0]!.misses).toHaveLength(3);
  });

  it('treats credit tier as a floor: Excellent clears every program (F5)', () => {
    const programs = [
      makeProgram({ creditTierRequired: 'Fair' }),
      makeProgram({ creditTierRequired: 'Good' }),
    ];
    const result = matchPrograms(makeCriteria({ creditTier: 'Excellent' }), programs, 'rate');

    expect(result.matches).toHaveLength(2);
  });

  it("matches 'Other' only against rows marked All (F4)", () => {
    const programs = [
      makeProgram({ lenderName: 'open', eligibleBusinessTypes: 'All' }),
      makeProgram({ lenderName: 'retail-only', eligibleBusinessTypes: 'Retail' }),
    ];
    const result = matchPrograms(makeCriteria({ businessType: 'Other' }), programs, 'rate');

    expect(result.matches.map((c) => c.program.lenderName)).toEqual(['open']);
    expect(result.closestAvailable.map((c) => c.program.lenderName)).toEqual(['retail-only']);
  });

  it('never filters on the display-only fields (F6)', () => {
    const result = matchPrograms(
      makeCriteria(),
      [
        makeProgram({
          minCreditScore: 800,
          maxExistingDebtRatio: 0.01,
          requiresCollateral: 'Yes',
          specialRequirements: 'Real estate purchase only',
        }),
      ],
      'rate',
    );

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]!.misses).toEqual([]);
  });

  it('sorts Match by rate asc, or turnaround asc when toggled (F8, F18)', () => {
    const programs = [
      makeProgram({ lenderName: 'slow-cheap', interestRateMin: 7.0, turnaroundDays: 73 }),
      makeProgram({ lenderName: 'fast-pricey', interestRateMin: 12.6, turnaroundDays: 7 }),
      makeProgram({ lenderName: 'middle', interestRateMin: 11.0, turnaroundDays: 23 }),
    ];

    const byRate = matchPrograms(makeCriteria(), programs, 'rate');
    expect(byRate.matches.map((c) => c.program.lenderName)).toEqual([
      'slow-cheap',
      'middle',
      'fast-pricey',
    ]);

    const byTurnaround = matchPrograms(makeCriteria(), programs, 'turnaround');
    expect(byTurnaround.matches.map((c) => c.program.lenderName)).toEqual([
      'fast-pricey',
      'middle',
      'slow-cheap',
    ]);
  });

  it('sorts Near Miss by miss count asc, tie-broken by rate asc (F9)', () => {
    const programs = [
      makeProgram({ lenderName: 'two-misses', minYearsInBusiness: 9, creditTierRequired: 'Good' }),
      // creditTierRequired must be 'Fair' here: the fixture default of 'Good' would add a
      // second miss for this Fair borrower and flatten the miss-count ordering.
      makeProgram({
        lenderName: 'one-miss-pricey',
        minYearsInBusiness: 9,
        creditTierRequired: 'Fair',
        interestRateMin: 12.6,
      }),
      makeProgram({
        lenderName: 'one-miss-cheap',
        minYearsInBusiness: 9,
        creditTierRequired: 'Fair',
        interestRateMin: 9.9,
      }),
    ];
    const result = matchPrograms(makeCriteria({ yearsInBusiness: 1, creditTier: 'Fair' }), programs, 'rate');

    expect(result.nearMisses.map((c) => c.program.lenderName)).toEqual([
      'one-miss-cheap',
      'one-miss-pricey',
      'two-misses',
    ]);
  });

  it('caps Near Miss and Closest Available at 5 but leaves Match uncapped (F8, F9, F11)', () => {
    const matches = Array.from({ length: 7 }, (_, i) =>
      makeProgram({ lenderName: `m${i}`, minYearsInBusiness: 1, interestRateMin: 8 + i }),
    );
    const nears = Array.from({ length: 7 }, (_, i) =>
      makeProgram({ lenderName: `n${i}`, minYearsInBusiness: 9, interestRateMin: 8 + i }),
    );
    const fars = Array.from({ length: 7 }, (_, i) =>
      makeProgram({ lenderName: `f${i}`, eligibleBusinessTypes: 'Healthcare', interestRateMin: 8 + i }),
    );
    const result = matchPrograms(makeCriteria({ yearsInBusiness: 1 }), [...matches, ...nears, ...fars], 'rate');

    // F8: full list returned so the view can offer "Show all N".
    expect(result.matches).toHaveLength(7);
    expect(result.nearMisses).toHaveLength(SECTION_CAP);
    expect(result.nearMissTotal).toBe(7);
    expect(result.closestAvailable).toHaveLength(SECTION_CAP);
    expect(result.closestAvailableTotal).toBe(7);
  });

  it('blocks on business type when no row is open to it (F15)', () => {
    const result = matchPrograms(
      makeCriteria({ businessType: 'Healthcare' }),
      [makeProgram({ eligibleBusinessTypes: 'Retail' }), makeProgram({ eligibleBusinessTypes: 'Manufacturing' })],
      'rate',
    );

    expect(result.blocker).toEqual({
      headline:
        'No programs serve Healthcare businesses — none of the 2 programs in our network are open to it',
    });
  });

  it('handles an empty dataset without inventing a blocker', () => {
    const result = matchPrograms(makeCriteria(), [], 'rate');

    expect(result.matches).toEqual([]);
    expect(result.nearMisses).toEqual([]);
    expect(result.closestAvailable).toEqual([]);
    expect(result.blocker).toBeNull();
  });
});
