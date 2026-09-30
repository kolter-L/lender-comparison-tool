import { expect, test } from '@playwright/test';

import { stalenessCsv } from './csv';
import { programRows, serveFixedCsv, submitCriteria, waitForReady } from './helpers';

/**
 * E15 (F22). Only proves the badge is wired to the screen for a row over the threshold and
 * absent for one under it. The exact 30-vs-31-day boundary is date arithmetic and belongs
 * in a unit test — see TEST_PLAN.md.
 */
test.describe('E15 — staleness badge (F22)', () => {
  test('flags the old row and leaves the fresh one plain', async ({ page }) => {
    const { text, freshDate, staleDate } = stalenessCsv(new Date());
    await serveFixedCsv(page, text);

    await page.goto('/');
    await waitForReady(page);
    // Both fixture rows are open to every type and have no minimums, so both match.
    await submitCriteria(page, { amount: '100000', businessType: 'Other', years: '5', tier: 'Fair' });

    const rows = programRows(page.locator('section.section:has(h2:has-text("Likely fits"))'));
    await expect(rows).toHaveCount(2);

    const stale = rows.filter({ hasText: 'Stale Bank' });
    const fresh = rows.filter({ hasText: 'Fresh Bank' });

    // 40 days old: badged, and the badge names the date it is complaining about.
    await expect(stale.locator('.badge-stale')).toBeVisible();
    await expect(stale.locator('.badge-age')).toHaveText('30+ days old');
    await expect(stale.locator('.badge-date')).toHaveText(staleDate);

    // 5 days old: F17's last_updated still shows, with no badge.
    await expect(fresh.locator('.badge-stale')).toHaveCount(0);
    await expect(fresh.locator('.updated-on')).toHaveText(freshDate);
  });
});
