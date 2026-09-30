import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LenderProgram } from '../../models/LenderProgram';
import { BUSINESS_TYPES, CREDIT_TIERS } from '../../models/enums';
import { matchPrograms } from '../../domain/matchPrograms';
import { datasetFreshness, evaluateStaleness } from '../../domain/staleness';
import { loadPrograms } from '../loadPrograms';

/**
 * End-to-end over the real file, through the real parser — no hand-rolled mapping, so
 * parseProgram.ts stays the only place that knows the CSV's column names.
 *
 * The file is gitignored (ops-supplied), so these skip rather than fail on a fresh clone.
 */
const CSV_FILE = 'public/lender_programs.csv';
const present = existsSync(CSV_FILE);

async function loadReal(): Promise<LenderProgram[]> {
  const body = readFileSync(CSV_FILE, 'utf8');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/csv' }),
        text: async () => body,
      }) as unknown as Response),
  );
  return loadPrograms(new Date(2026, 8, 30));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.skipIf(!present)('the real lender_programs.csv', () => {
  it('parses every row without throwing', async () => {
    const programs = await loadReal();
    expect(programs).toHaveLength(49);
    expect(new Set(programs.map((p) => p.lenderName)).size).toBe(15);
  });

  it('gives all 49 rows unique ids', async () => {
    const programs = await loadReal();
    expect(new Set(programs.map((p) => p.id)).size).toBe(49);
    expect(programs[0]!.id).toBe('row-2');
    expect(programs.at(-1)!.id).toBe('row-50');
  });

  it('produces only finite numbers and real dates', async () => {
    for (const p of await loadReal()) {
      for (const key of [
        'minLoanAmount', 'maxLoanAmount', 'minCreditScore', 'minYearsInBusiness',
        'interestRateMin', 'interestRateMax', 'maxTermMonths', 'sbaGuaranteePct', 'turnaroundDays',
      ] as const) {
        expect(Number.isFinite(p[key]), `${p.lenderName}.${key}`).toBe(true);
      }
      expect(Number.isNaN(p.lastUpdated.getTime())).toBe(false);
      expect(p.interestRateMin).toBeLessThanOrEqual(p.interestRateMax);
      expect(p.minLoanAmount).toBeLessThanOrEqual(p.maxLoanAmount);
    }
  });

  it('reproduces F23 freshness and F22 staleness on real dates', async () => {
    const programs = await loadReal();
    const newest = datasetFreshness(programs)!;
    expect(newest.toLocaleDateString('en-US')).toBe('2/8/2026');

    const newestRow = programs.find((p) => p.lastUpdated.getTime() === newest.getTime())!;
    // Exactly 30 days later is not stale — F22 says "more than".
    expect(evaluateStaleness(newestRow, new Date(2026, 2, 10))).toBe(false);
    expect(evaluateStaleness(newestRow, new Date(2026, 2, 11))).toBe(true);
  });

  it("reproduces F15's literal example", async () => {
    const result = matchPrograms(
      { loanAmount: 6_000_000, businessType: 'Retail', yearsInBusiness: 5, creditTier: 'Good' },
      await loadReal(),
      'rate',
    );
    expect(result.blocker?.headline).toBe(
      'No programs cover $6,000,000 — the highest in our network is $5,500,000',
    );
    expect(result.closestAvailable).toHaveLength(5);
  });

  it('places all 49 rows exactly once for every criteria combination (F7, F11, F15)', async () => {
    const programs = await loadReal();

    for (const businessType of BUSINESS_TYPES) {
      for (const creditTier of CREDIT_TIERS) {
        for (const yearsInBusiness of [0, 1, 2, 3, 10]) {
          for (const loanAmount of [1, 5_000, 100_000, 400_000, 5_500_000, 6_000_000]) {
            const label = `${businessType}/${creditTier}/${yearsInBusiness}y/$${loanAmount}`;
            const r = matchPrograms({ loanAmount, businessType, yearsInBusiness, creditTier }, programs, 'rate');

            expect(r.matches.length + r.nearMissTotal + r.closestAvailableTotal, label).toBe(49);
            expect(r.nearMisses.length, label).toBeLessThanOrEqual(5);
            expect(r.closestAvailable.length, label).toBeLessThanOrEqual(5);
            // F11: populated whenever anything landed there.
            expect(r.closestAvailable.length > 0, label).toBe(r.closestAvailableTotal > 0);
            // F15: a blocker appears exactly when Match and Near Miss are both empty.
            expect(r.blocker !== null, label).toBe(r.matches.length === 0 && r.nearMisses.length === 0);
            // Match rows have no misses, by definition.
            expect(r.matches.every((c) => c.misses.length === 0), label).toBe(true);
            // Near-miss rows have 1–2 soft misses and no hard miss.
            for (const c of r.nearMisses) {
              expect(c.misses.length, label).toBeGreaterThanOrEqual(1);
              expect(c.misses.length, label).toBeLessThanOrEqual(2);
              expect(c.misses.every((m) => m.severity === 'soft'), label).toBe(true);
            }
          }
        }
      }
    }
  });

  it('never renders a banned word in miss text or blocker copy (F20)', async () => {
    const programs = await loadReal();
    const banned = /qualified|approved|eligible/i;

    for (const businessType of BUSINESS_TYPES) {
      for (const loanAmount of [1, 100_000, 6_000_000]) {
        const r = matchPrograms(
          { loanAmount, businessType, yearsInBusiness: 0, creditTier: 'Fair' },
          programs,
          'rate',
        );
        const copy = [
          r.blocker?.headline ?? '',
          ...[...r.nearMisses, ...r.closestAvailable].flatMap((c) => c.misses.map((m) => m.text)),
        ];
        for (const text of copy) expect(text, text).not.toMatch(banned);
      }
    }
  });
});
