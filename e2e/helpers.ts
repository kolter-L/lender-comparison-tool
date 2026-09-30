import type { ConsoleMessage, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { baselineCsv } from './csv';

/** What the intercepted CSV request should answer with. */
export interface CsvResponse {
  body: string;
  status?: number;
  contentType?: string;
}

/**
 * Intercepts the runtime CSV fetch (F25, F28 — the URL carries a cache-busting `?v=`).
 * `next` is called per request, so a test can change the answer between the first load
 * and a retry without re-registering the route.
 */
export async function serveCsv(page: Page, next: () => CsvResponse): Promise<void> {
  await page.route('**/lender_programs.csv*', async (route) => {
    const { body, status = 200, contentType = 'text/csv' } = next();
    await route.fulfill({ status, contentType, body });
  });
}

/** The common case: one fixed body for every request. */
export async function serveFixedCsv(page: Page, body: string): Promise<void> {
  await serveCsv(page, () => ({ body }));
}

/** The real 49-row sheet. */
export async function serveBaseline(page: Page): Promise<void> {
  await serveFixedCsv(page, baselineCsv());
}

/**
 * Collects browser console output. Playwright surfaces every level, including the
 * `console.debug` that F24 logs through and the `console.warn` that reports skipped rows —
 * so no in-page shim is needed.
 */
export function captureConsole(page: Page): ConsoleMessage[] {
  const messages: ConsoleMessage[] = [];
  page.on('console', (message) => messages.push(message));
  return messages;
}

export function consoleText(messages: ConsoleMessage[], type?: string): string[] {
  return messages.filter((m) => type === undefined || m.type() === type).map((m) => m.text());
}

export interface Criteria {
  amount: string;
  businessType: string;
  years: string;
  tier: string;
}

/** Fills the four F1 inputs and submits. */
export async function submitCriteria(page: Page, criteria: Criteria): Promise<void> {
  await page.locator('#loanAmount').fill(criteria.amount);
  await page.locator('#businessType').selectOption(criteria.businessType);
  await page.locator('#yearsInBusiness').fill(criteria.years);
  await page.locator('#creditTier').selectOption(criteria.tier);
  await page.getByRole('button', { name: 'Find programs' }).click();
}

/** Waits for the load to finish so a click never races the fetch (the form is disabled until then). */
export async function waitForReady(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Find programs' })).toBeEnabled();
}

// --- section locators -------------------------------------------------------
// Headings carry a count span, so these match on the heading's leading text.

export function matchSection(page: Page): Locator {
  return page.locator('section.section:has(h2:has-text("Likely fits"))');
}

export function nearMissSection(page: Page): Locator {
  return page.locator('section.section:has(h2:has-text("Close, with gaps"))');
}

export function closestSection(page: Page): Locator {
  return page.locator('section.section:has(h2:has-text("Closest available"))');
}

/** Program rows only — ProgramRow emits a second `tr.sub` for chips and requirements. */
export function programRows(section: Locator): Locator {
  return section.locator('tbody tr.row');
}

/** The lender name cell of every row in a section, in render order. */
export async function lenderNames(section: Locator): Promise<string[]> {
  return programRows(section).locator('.lender-name').allTextContents();
}

/**
 * Column indices into a row's `<td>` list. The lender cell is a `<th scope="row">`, so it
 * is not in this list — the six data cells follow it in ProgramRow's order.
 */
export const COLUMN = {
  rateRange: 0,
  maxTerm: 1,
  sbaGuarantee: 2,
  turnaround: 3,
  collateral: 4,
  updated: 5,
} as const;

/**
 * Reads one column across a section's rows, in render order.
 *
 * One round trip, not one per row: at E17's 1000 rows a per-row `await` costs seconds and
 * would contaminate any timing measured around this call.
 */
export async function columnValues(section: Locator, column: number): Promise<string[]> {
  return programRows(section).evaluateAll(
    (trs, col) =>
      trs.map((tr) => (tr.querySelectorAll('td')[col] as HTMLElement | undefined)?.innerText.trim() ?? ''),
    column,
  );
}
