import { expect, test } from '@playwright/test';

import { BASELINE_ROW_COUNT, allBadCsv, baselineCsv, missingColumnCsv, partialCsv } from './csv';
import {
  captureConsole,
  consoleText,
  matchSection,
  programRows,
  serveBaseline,
  serveCsv,
  serveFixedCsv,
  submitCriteria,
  waitForReady,
} from './helpers';

const BROAD = { amount: '100000', businessType: 'Other', years: '10', tier: 'Excellent' };

test.describe('E1 — cold load (F23, F25, F26)', () => {
  test('shows a loading state, then the form and the dataset date', async ({ page }) => {
    // Hold the response open so the loading state is observable rather than a race.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/lender_programs.csv*', async (route) => {
      await held;
      await route.fulfill({ status: 200, contentType: 'text/csv', body: baselineCsv() });
    });

    await page.goto('/');

    // F26: explicit loading state, and the form is not yet usable.
    await expect(page.getByRole('status')).toHaveText(/Loading rate data/);
    await expect(page.getByRole('button', { name: 'Find programs' })).toBeDisabled();

    release();

    // F23: newest last_updated in the sheet.
    await expect(page.locator('.freshness')).toHaveText('Rates as of 2/8/2026');
    await waitForReady(page);

    // No results before the rep asks for any, and no blank area either.
    await expect(page.locator('.empty')).toHaveText(/Enter the borrower's details/);
    await expect(matchSection(page)).toHaveCount(0);
  });

  test('F19: the disclaimer is on screen before any search', async ({ page }) => {
    await serveBaseline(page);
    await page.goto('/');
    await expect(page.locator('.disclaimer').first()).toHaveText(
      'Likely fit — subject to full eligibility review. Not a pre-approval.',
    );
  });
});

test.describe('E9 — rate sheet missing (F27)', () => {
  test('shows an error with a working retry, never a blank screen', async ({ page }) => {
    let broken = true;
    await serveCsv(page, () =>
      broken ? { body: 'not found', status: 404 } : { body: baselineCsv() },
    );

    await page.goto('/');

    const error = page.getByRole('alert');
    await expect(error).toBeVisible();
    await expect(error).toContainText('Rate data could not be loaded');
    await expect(error).toContainText('404');
    // F27: the failure is stated, not implied by an empty page.
    await expect(matchSection(page)).toHaveCount(0);

    broken = false;
    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByRole('alert')).toHaveCount(0);
    await waitForReady(page);
    await submitCriteria(page, BROAD);
    await expect(programRows(matchSection(page)).first()).toBeVisible();
  });

  test('reports a missing file when the host serves index.html with a 200', async ({ page }) => {
    // The realistic shape of a missing static file: most hosts fall back to the SPA shell.
    await serveCsv(page, () => ({
      body: '<!doctype html><html><body><div id="root"></div></body></html>',
      contentType: 'text/html',
    }));

    await page.goto('/');

    await expect(page.getByRole('alert')).toContainText('No rate data file found');
  });
});

test.describe('E10 — structurally unusable sheet (F27)', () => {
  test('a dropped column is named as a missing column', async ({ page }) => {
    await serveFixedCsv(page, missingColumnCsv('interest_rate_max'));
    await page.goto('/');
    await expect(page.getByRole('alert')).toContainText('missing required columns');
  });

  test('a sheet where every row is bad names the count, not a blank table', async ({ page }) => {
    await serveFixedCsv(page, allBadCsv(10));
    await page.goto('/');

    const error = page.getByRole('alert');
    await expect(error).toContainText('no usable programs');
    await expect(error).toContainText('all 10 rows were rejected');
  });

  test('a header-only sheet is an error, not an empty result set', async ({ page }) => {
    await serveFixedCsv(page, baselineCsv().split('\n')[0]! + '\n');
    await page.goto('/');
    await expect(page.getByRole('alert')).toContainText('no programs');
  });
});

test.describe('E11 — partial load: bad rows skipped, not fatal (F26, F27)', () => {
  test('loads the survivors, warns the count, and matches normally', async ({ page }) => {
    const messages = captureConsole(page);
    const { text, good, total } = partialCsv();
    await serveFixedCsv(page, text);

    await page.goto('/');

    // The whole point: a partly broken sheet is NOT an error screen.
    await expect(page.getByRole('alert')).toHaveCount(0);
    await waitForReady(page);

    const warnings = consoleText(messages, 'warning').join('\n');
    expect(warnings).toContain(`Rejected ${total - good} of ${total} rows`);
    // Each of the three distinct faults is named, so ops can find the lines.
    expect(warnings).toMatch(/not a known tier|Platinum/);
    expect(warnings).toMatch(/interest_rate_min/);
    expect(warnings).toMatch(/last_updated/);

    // And matching runs over the survivors.
    await submitCriteria(page, BROAD);
    const rows = programRows(matchSection(page));
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);

    // None of the three bad lenders reached the screen.
    const body = await page.locator('main').innerText();
    expect(body).not.toContain('Bad Tier Bank');
    expect(body).not.toContain('Bad Rate Bank');
    expect(body).not.toContain('Bad Date Bank');
  });

  test('the good rows are all still there', async ({ page }) => {
    // Guards against a regression that drops more than the three bad rows.
    const { text } = partialCsv();
    await serveFixedCsv(page, text);
    await page.goto('/');
    await waitForReady(page);

    // Excellent + Other + a small amount clears every All-typed program; counting the three
    // sections back up must account for all 49 survivors exactly once (F7).
    await submitCriteria(page, { amount: '50000', businessType: 'Other', years: '30', tier: 'Excellent' });

    const total = await page.locator('h2 .count').evaluateAll((spans) =>
      spans.reduce((sum, span) => sum + Number(span.textContent ?? '0'), 0),
    );
    expect(total).toBe(BASELINE_ROW_COUNT);
  });
});
