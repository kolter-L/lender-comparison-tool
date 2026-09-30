import { describe, expect, it } from 'vitest';

import {
  CSV_COLUMNS,
  csvLineNumber,
  hasRequiredColumns,
  makeProgramId,
  parseProgram,
} from '../parseProgram';
import type { RawProgramRow } from '../parseProgram';

/** A real row of public/lender_programs.csv, verbatim. */
const REAL_ROW: RawProgramRow = {
  lender_name: 'First National Bank',
  program_type: 'Community Advantage',
  min_loan_amount: '10000',
  max_loan_amount: '250000',
  min_credit_score: '620',
  credit_tier_required: 'Fair',
  min_years_in_business: '1',
  interest_rate_min: '11',
  interest_rate_max: '13.6',
  max_term_months: '84',
  sba_guarantee_pct: '85',
  eligible_business_types: 'All',
  requires_collateral: 'Varies',
  max_existing_debt_ratio: '0.5',
  turnaround_days: '23',
  special_requirements: 'No recent bankruptcies (7 years)',
  last_updated: '1/16/2026',
};

const row = (overrides: RawProgramRow = {}): RawProgramRow => ({
  ...REAL_ROW,
  ...overrides,
});

describe('hasRequiredColumns', () => {
  it('accepts the real header', () => {
    expect(hasRequiredColumns([...CSV_COLUMNS])).toBe(true);
  });

  it('accepts extra columns — ops may add one without breaking the app', () => {
    expect(hasRequiredColumns([...CSV_COLUMNS, 'notes'])).toBe(true);
  });

  it('rejects a header missing even one column (F27)', () => {
    const short = CSV_COLUMNS.filter((c) => c !== 'max_term_months');
    expect(hasRequiredColumns([...short])).toBe(false);
  });
});

describe('parseProgram', () => {
  it('maps all 17 snake_case columns to camelCase', () => {
    expect(parseProgram(REAL_ROW, 0)).toEqual({
      id: 'row-2',
      lenderName: 'First National Bank',
      programType: 'Community Advantage',
      minLoanAmount: 10_000,
      maxLoanAmount: 250_000,
      minCreditScore: 620,
      creditTierRequired: 'Fair',
      minYearsInBusiness: 1,
      interestRateMin: 11,
      interestRateMax: 13.6,
      maxTermMonths: 84,
      sbaGuaranteePct: 85,
      eligibleBusinessTypes: 'All',
      requiresCollateral: 'Varies',
      maxExistingDebtRatio: 0.5,
      turnaroundDays: 23,
      specialRequirements: 'No recent bankruptcies (7 years)',
      lastUpdated: new Date(2026, 0, 16),
    });
  });

  // --- ids --------------------------------------------------------------

  it('gives two byte-identical rows distinct ids', () => {
    const first = parseProgram(REAL_ROW, 0);
    const duplicate = parseProgram(REAL_ROW, 1);

    expect(first.lenderName).toBe(duplicate.lenderName);
    expect(first.programType).toBe(duplicate.programType);
    // The old composite key would have collided here.
    expect(first.id).not.toBe(duplicate.id);
  });

  it('names the CSV line, so row 0 is line 2 of the file', () => {
    expect(parseProgram(REAL_ROW, 0).id).toBe('row-2');
    expect(parseProgram(REAL_ROW, 12).id).toBe('row-14');
    expect(makeProgramId(0)).toBe(`row-${csvLineNumber(0)}`);
  });

  it('reports the CSV line in parse errors (F27)', () => {
    expect(() => parseProgram(row({ turnaround_days: '' }), 12)).toThrow(/row 14/);
  });

  it('turns the two nullable columns blank into null, not 0 or ""', () => {
    const parsed = parseProgram(row({ max_existing_debt_ratio: '', special_requirements: '' }), 0);
    expect(parsed.maxExistingDebtRatio).toBeNull();
    expect(parsed.specialRequirements).toBeNull();
  });

  it('parses M/D/YYYY as a local date, not a UTC-shifted one', () => {
    const parsed = parseProgram(row({ last_updated: '2/8/2026' }), 0);
    expect(parsed.lastUpdated.getFullYear()).toBe(2026);
    expect(parsed.lastUpdated.getMonth()).toBe(1);
    expect(parsed.lastUpdated.getDate()).toBe(8);
    expect(parsed.lastUpdated.toLocaleDateString('en-US')).toBe('2/8/2026');
  });

  it('keeps a whole-number rate as a number, not a string', () => {
    expect(parseProgram(row({ interest_rate_min: '11' }), 0).interestRateMin).toBe(11);
  });

  it('accepts all three collateral values', () => {
    for (const value of ['Yes', 'No', 'Varies']) {
      expect(parseProgram(row({ requires_collateral: value }), 0).requiresCollateral).toBe(value);
    }
  });

  // --- the failures that would otherwise become silent blank cells ---------

  it('throws on a blank required cell instead of coercing it to 0 (F27)', () => {
    expect(() => parseProgram(row({ max_loan_amount: '' }), 0)).toThrow(/max_loan_amount is required/);
  });

  it('names the offending row so the error state is actionable', () => {
    expect(() => parseProgram(row({ turnaround_days: '' }), 0)).toThrow(/First National Bank/);
  });

  it('throws on a non-numeric number', () => {
    expect(() => parseProgram(row({ interest_rate_min: 'n/a' }), 0)).toThrow(/not a number/);
  });

  it('throws on an unknown credit tier rather than letting tier maths go NaN', () => {
    expect(() => parseProgram(row({ credit_tier_required: 'Platinum' }), 0)).toThrow(
      /not a known tier/,
    );
  });

  it('throws on an unknown collateral value', () => {
    expect(() => parseProgram(row({ requires_collateral: 'Maybe' }), 0)).toThrow(/Yes\/No\/Varies/);
  });

  it('throws on a malformed date', () => {
    expect(() => parseProgram(row({ last_updated: '2026-01-16' }), 0)).toThrow(/not M\/D\/YYYY/);
  });

  it('throws on a date that does not exist rather than rolling into next month', () => {
    // new Date(2026, 1, 30) silently becomes 2026-03-02.
    expect(() => parseProgram(row({ last_updated: '2/30/2026' }), 0)).toThrow(/not a real date/);
  });

  it('tolerates surrounding whitespace in cells', () => {
    const parsed = parseProgram(row({ lender_name: '  Coastal Capital  ', max_loan_amount: ' 500000 ' }), 0);
    expect(parsed.lenderName).toBe('Coastal Capital');
    expect(parsed.maxLoanAmount).toBe(500_000);
  });

  it('treats a missing key the same as a blank cell', () => {
    const withoutColumn: RawProgramRow = { ...REAL_ROW };
    delete withoutColumn['min_credit_score'];
    expect(() => parseProgram(withoutColumn, 0)).toThrow(/min_credit_score is required/);
  });
});
