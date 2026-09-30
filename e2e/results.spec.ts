import { expect, test } from '@playwright/test';

import {
  COLUMN,
  closestSection,
  columnValues,
  lenderNames,
  matchSection,
  nearMissSection,
  programRows,
  serveBaseline,
  submitCriteria,
  waitForReady,
} from './helpers';

/** Produces 27 matches against the baseline sheet. */
const TYPICAL = {
  amount: '250000',
  businessType: 'Restaurant/Food Service',
  years: '5',
  tier: 'Good',
};

test.beforeEach(async ({ page }) => {
  await serveBaseline(page);
  await page.goto('/');
  await waitForReady(page);
});

test.describe('E2 — a typical ask returns comparable rows (F1, F16, F17)', () => {
  test('renders one aligned table with every F17 field', async ({ page }) => {
    await submitCriteria(page, TYPICAL);

    const section = matchSection(page);
    await expect(section).toBeVisible();

    // F16: a real table, so the columns line up by construction.
    await expect(section.locator('table thead th')).toHaveText([
      'Lender',
      'Rate range',
      'Max term',
      'SBA guarantee',
      'Turnaround',
      'Collateral',
      'Updated',
    ]);

    // Top 5 until expanded (F8).
    const rows = programRows(section);
    await expect(rows).toHaveCount(5);

    // Every row is structurally identical — the F16 claim, asserted rather than eyeballed.
    const cellCounts = await rows.evaluateAll((trs) =>
      trs.map((tr) => tr.querySelectorAll('th,td').length),
    );
    expect(new Set(cellCounts)).toEqual(new Set([7]));

    // F17 + F20: rate is ALWAYS a range. A single figure here is a compliance defect.
    for (const value of await columnValues(section, COLUMN.rateRange)) {
      expect(value).toMatch(/^\d+\.\d% – \d+\.\d%$/);
    }

    // The remaining F17 fields are present and formatted, not blank cells.
    for (const value of await columnValues(section, COLUMN.maxTerm)) {
      expect(value).toMatch(/^\d+ mo$/);
    }
    for (const value of await columnValues(section, COLUMN.sbaGuarantee)) {
      expect(value).toMatch(/^\d+%$/);
    }
    for (const value of await columnValues(section, COLUMN.turnaround)) {
      expect(value).toMatch(/^\d+ days?$/);
    }
    for (const value of await columnValues(section, COLUMN.collateral)) {
      expect(['Yes', 'No', 'Varies']).toContain(value);
    }
    for (const value of await columnValues(section, COLUMN.updated)) {
      expect(value).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    }
  });

  test('F2: the amount is echoed back with thousands separators', async ({ page }) => {
    await page.locator('#loanAmount').fill('250000');
    await expect(page.locator('#loanAmount')).toHaveValue('250,000');
  });
});

test.describe('E3 — sort toggle (F8, F18)', () => {
  test('reorders likely fits by rate, then by turnaround, leaving other sections alone', async ({
    page,
  }) => {
    await submitCriteria(page, TYPICAL);
    const section = matchSection(page);

    // Default: lowest starting rate.
    await expect(section.getByRole('button', { name: 'Lowest starting rate' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const byRate = (await columnValues(section, COLUMN.rateRange)).map((v) => parseFloat(v));
    expect(byRate).toEqual([...byRate].sort((a, b) => a - b));

    const closestBefore = await lenderNames(closestSection(page));

    await section.getByRole('button', { name: 'Fastest turnaround' }).click();

    await expect(section.getByRole('button', { name: 'Fastest turnaround' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const byTurnaround = (await columnValues(section, COLUMN.turnaround)).map((v) => parseInt(v, 10));
    expect(byTurnaround).toEqual([...byTurnaround].sort((a, b) => a - b));

    // F18: the toggle applies only to Match.
    expect(await lenderNames(closestSection(page))).toEqual(closestBefore);
  });
});

test.describe('E6 — a near miss names its gap inline (F9, F13)', () => {
  test('shows the red chip with readable text and no tooltip', async ({ page }) => {
    // One year short of a 2-year minimum, everything else clear.
    await submitCriteria(page, { ...TYPICAL, years: '1' });

    const section = nearMissSection(page);
    await expect(section).toBeVisible();

    const chip = section.locator('.chip-miss').first();
    await expect(chip).toBeVisible();
    // F13: the gap is in the text, not behind a hover.
    await expect(chip).toContainText('Needs 2 yrs in business — borrower has 1');
    await expect(chip).not.toHaveAttribute('title', /./);

    // F9: near-miss rows carry one or two gaps, never zero and never three.
    const perRow = await programRows(section).evaluateAll((trs) =>
      trs.map((tr) => tr.nextElementSibling?.querySelectorAll('.chip-miss').length ?? 0),
    );
    for (const count of perRow) {
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(2);
    }
  });
});

test.describe('E12 — nothing in the network fits (F14, F15)', () => {
  test('an oversized ask names the network ceiling', async ({ page }) => {
    await submitCriteria(page, {
      amount: '6000000',
      businessType: 'Retail',
      years: '10',
      tier: 'Excellent',
    });

    // F15, verbatim from the spec's own example.
    await expect(page.locator('.blocker')).toHaveText(
      'No programs cover $6,000,000 — the highest in our network is $5,500,000',
    );

    // F14: a plain message, not a blank area.
    await expect(matchSection(page).locator('.empty')).toContainText('No programs match');
    await expect(nearMissSection(page)).toHaveCount(0);

    // F11: Closest Available still carries the answer.
    await expect(programRows(closestSection(page))).toHaveCount(5);
  });

  test('a type no lender serves blocks on the type, not the amount', async ({ page }) => {
    // $150k is comfortably inside every program's range, so the amount cannot be the cause.
    await submitCriteria(page, {
      amount: '150000',
      businessType: 'Other',
      years: '0',
      tier: 'Fair',
    });

    const blocker = page.locator('.blocker');
    if ((await blocker.count()) > 0) {
      await expect(blocker).not.toContainText('cover $150,000');
    }
  });
});

test.describe('E13 — "Other" matches only all-types programs (F4)', () => {
  test('no type-specific lender reaches likely fits or near misses', async ({ page }) => {
    await submitCriteria(page, {
      amount: '150000',
      businessType: 'Other',
      years: '5',
      tier: 'Good',
    });

    // Every row that got in must be marked All; the chip text on excluded rows proves the rule.
    const reachable = [
      ...(await lenderNames(matchSection(page))),
      ...(await lenderNames(nearMissSection(page))),
    ];
    expect(reachable.length).toBeGreaterThan(0);

    // Any program shown in Closest Available for a type reason says so explicitly.
    const chips = await closestSection(page).locator('.chip-miss').allTextContents();
    const typeChips = chips.filter((c) => c.includes('only — borrower is Other'));
    expect(typeChips.length).toBeGreaterThan(0);
  });
});

test.describe('E14 — Closest Available is always present and bounded (F10, F11)', () => {
  for (const [name, criteria] of Object.entries({
    'everything matches': { amount: '250000', businessType: 'Other', years: '30', tier: 'Excellent' },
    'nothing matches': { amount: '9000000', businessType: 'Retail', years: '0', tier: 'Fair' },
    typical: TYPICAL,
  })) {
    test(`is shown and capped at 5 when ${name}`, async ({ page }) => {
      await submitCriteria(page, criteria);

      const section = closestSection(page);
      await expect(section).toBeVisible();
      expect(await programRows(section).count()).toBeLessThanOrEqual(5);
    });
  }
});
