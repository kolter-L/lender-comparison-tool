import { expect, test } from '@playwright/test';

import { scaleCsv } from './csv';
import {
  COLUMN,
  closestSection,
  columnValues,
  matchSection,
  nearMissSection,
  programRows,
  serveFixedCsv,
  submitCriteria,
  waitForReady,
} from './helpers';

/**
 * E17 (F8, F11, F16) — a 1000-row sheet.
 *
 * Correctness at scale is what is asserted here. Perceived responsiveness is not: it is a
 * human judgement, and wall-clock thresholds on a shared runner fail for reasons unrelated
 * to this app. The timings below are RECORDED, not gated — see TEST_PLAN.md.
 */
const ROWS = 1000;

test.describe('E17 — 1000-row rate sheet', () => {
  test.slow();

  test('loads, filters, caps and re-sorts correctly at scale', async ({ page }) => {
    await serveFixedCsv(page, scaleCsv(ROWS));

    const startedAt = Date.now();
    await page.goto('/');
    await waitForReady(page);
    const loadMs = Date.now() - startedAt;

    await submitCriteria(page, { amount: '100000', businessType: 'Other', years: '10', tier: 'Excellent' });

    const section = matchSection(page);

    // F8: still the top 5 until asked, with a truthful total.
    await expect(programRows(section)).toHaveCount(5);
    const expand = section.getByRole('button', { name: /^Show all \d+$/ });
    const total = Number((await expand.innerText()).replace(/\D/g, ''));
    expect(total).toBe(ROWS);

    // F9/F10/F11: the caps hold no matter how large the sheet is.
    expect(await programRows(nearMissSection(page)).count()).toBeLessThanOrEqual(5);
    expect(await programRows(closestSection(page)).count()).toBeLessThanOrEqual(5);

    // The real risk at this size: several hundred rows in the DOM at once.
    const expandedAt = Date.now();
    await expand.click();
    await expect(programRows(section)).toHaveCount(ROWS);
    const expandMs = Date.now() - expandedAt;

    // And re-sorting after expansion, which re-runs the whole match.
    const sortedAt = Date.now();
    await section.getByRole('button', { name: 'Fastest turnaround' }).click();
    await expect(section.getByRole('button', { name: 'Fastest turnaround' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const sortMs = Date.now() - sortedAt;

    // Read the column AFTER stopping the clock — see columnValues' note on round trips.
    const turnaround = (await columnValues(section, COLUMN.turnaround)).map((v) => parseInt(v, 10));

    // Correctness of the sort across all 1000 rows, not just the visible five.
    expect(turnaround).toHaveLength(ROWS);
    expect(turnaround).toEqual([...turnaround].sort((a, b) => a - b));

    console.log(
      `[E17] ${ROWS} rows — load ${loadMs}ms, expand ${expandMs}ms, re-sort ${sortMs}ms`,
    );
  });

  test('F16: every one of the rendered rows stays structurally aligned', async ({ page }) => {
    await serveFixedCsv(page, scaleCsv(ROWS));
    await page.goto('/');
    await waitForReady(page);
    await submitCriteria(page, { amount: '100000', businessType: 'Other', years: '10', tier: 'Excellent' });

    const section = matchSection(page);
    await section.getByRole('button', { name: /^Show all \d+$/ }).click();
    await expect(programRows(section)).toHaveCount(ROWS);

    const cellCounts = await programRows(section).evaluateAll((trs) =>
      Array.from(new Set(trs.map((tr) => tr.querySelectorAll('th,td').length))),
    );
    expect(cellCounts).toEqual([7]);
  });
});
