import { describe, expect, it } from 'vitest';

import { makeProgram } from '../../domain/__tests__/fixtures';
import type { ClassifiedProgram } from '../../models/MatchResult';
import { DISCLAIMER_TEXT } from '../../models/enums';
import { COPY_LIMIT, formatForClipboard } from '../clipboard';
import { rateRange } from '../format';

const classify = (overrides = {}): ClassifiedProgram => ({
  program: makeProgram(overrides),
  misses: [],
  closenessScore: 0,
});

const ASOF = new Date(2026, 1, 8);

describe('formatForClipboard', () => {
  it('copies at most the top 3 (F21)', () => {
    const five = Array.from({ length: 5 }, (_, i) => classify({ lenderName: `Lender ${i}` }));
    const text = formatForClipboard(five, ASOF);

    expect(COPY_LIMIT).toBe(3);
    expect(text).toContain('Lender 0');
    expect(text).toContain('Lender 2');
    expect(text).not.toContain('Lender 3');
  });

  it('includes the F19 disclaimer verbatim', () => {
    expect(formatForClipboard([classify()], ASOF)).toContain(DISCLAIMER_TEXT);
  });

  it("includes the 'as of' date (F21)", () => {
    expect(formatForClipboard([classify()], ASOF)).toContain('2/8/2026');
  });

  it('writes the rate as a range, never a single figure (F17, F21)', () => {
    const program = makeProgram({ interestRateMin: 11, interestRateMax: 13.6 });
    const text = formatForClipboard([{ program, misses: [], closenessScore: 0 }], ASOF);

    expect(text).toContain('11.0% – 13.6%');
    // A bare "11%" anywhere would mean a single figure leaked out.
    expect(text).not.toMatch(/Rate: \d+(\.\d+)?%\s*$/m);
    expect(text).toContain(rateRange(program));
  });

  it('never uses a banned word outside the mandated disclaimer (F20)', () => {
    const text = formatForClipboard([classify()], ASOF);
    const withoutDisclaimer = text.replace(DISCLAIMER_TEXT, '');

    expect(withoutDisclaimer).not.toMatch(/qualified|approved|eligible/i);
  });

  it('omits the notes line when a program has no special requirements', () => {
    const text = formatForClipboard([classify({ specialRequirements: null })], ASOF);
    expect(text).not.toContain('Notes:');
  });

  it('handles an empty list without producing a bare disclaimer-only blob', () => {
    const text = formatForClipboard([], ASOF);
    expect(text).toContain('Likely fits');
    expect(text).toContain(DISCLAIMER_TEXT);
  });
});

describe('rateRange (F17)', () => {
  it('always shows one decimal on both ends so columns line up', () => {
    expect(rateRange(makeProgram({ interestRateMin: 7, interestRateMax: 8 }))).toBe('7.0% – 8.0%');
  });
});
