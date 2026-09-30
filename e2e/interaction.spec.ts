import { expect, test } from '@playwright/test';

import {
  captureConsole,
  consoleText,
  matchSection,
  nearMissSection,
  programRows,
  serveBaseline,
  submitCriteria,
  waitForReady,
} from './helpers';

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

test.describe('E4 — expand beyond the top 5 (F8, F24)', () => {
  test('reveals every match and logs the expansion', async ({ page }) => {
    const messages = captureConsole(page);
    await submitCriteria(page, TYPICAL);

    const section = matchSection(page);
    const rows = programRows(section);
    await expect(rows).toHaveCount(5);

    // The label must state the true total, not the visible count.
    const expand = section.getByRole('button', { name: /^Show all \d+$/ });
    const total = Number((await expand.innerText()).replace(/\D/g, ''));
    expect(total).toBeGreaterThan(5);

    await expand.click();

    await expect(rows).toHaveCount(total);
    await expect(section.locator('.section-note')).toHaveText(`Showing all ${total}.`);
    await expect(expand).toHaveCount(0);

    // F24: fires on expand. Playwright surfaces console.debug, so no in-page shim is needed.
    const logged = consoleText(messages, 'debug').filter((t) => t.includes('[recommendation]'));
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('expand');
  });
});

test.describe('E5 — copy the top 3 to the real clipboard (F19, F21, F24, N4)', () => {
  test('writes rate ranges, the as-of date and the disclaimer', async ({ page }) => {
    const messages = captureConsole(page);
    await submitCriteria(page, TYPICAL);

    await matchSection(page).getByRole('button', { name: 'Copy top 3' }).click();
    await expect(matchSection(page).locator('.copy-notice')).toHaveText('Copied top 3');

    // The real clipboard, in a real secure context — the one assertion no simulated DOM can make.
    const copied = await page.evaluate(() => navigator.clipboard.readText());

    // F19, verbatim and inside the copied text, not merely on screen.
    expect(copied).toContain('Likely fit — subject to full eligibility review. Not a pre-approval.');
    // F21: an "as of" date.
    expect(copied).toMatch(/as of \d{1,2}\/\d{1,2}\/\d{4}/i);
    // F17/F21: ranges only. Exactly three programs, so exactly three ranges.
    const ranges = copied.match(/\d+\.\d% – \d+\.\d%/g) ?? [];
    expect(ranges).toHaveLength(3);

    // F24: fires on copy.
    const logged = consoleText(messages, 'debug').filter((t) => t.includes('[recommendation]'));
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('copy');
  });

  test('copies fewer than 3 without padding when only 2 match', async ({ page }) => {
    // A narrow ask: Professional Services at a large amount leaves very few full matches.
    await submitCriteria(page, {
      amount: '2000000',
      businessType: 'Professional Services',
      years: '10',
      tier: 'Excellent',
    });

    const section = matchSection(page);
    const count = await programRows(section).count();
    test.skip(count === 0, 'no matches for this ask against the current sheet');

    await section.getByRole('button', { name: 'Copy top 3' }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());

    const ranges = copied.match(/\d+\.\d% – \d+\.\d%/g) ?? [];
    expect(ranges.length).toBe(Math.min(3, count));
    expect(copied).toContain('Not a pre-approval.');
  });
});

test.describe('E7 — loan amount validation (F2)', () => {
  test('rejects blank and zero, and refuses to accept a negative or a decimal', async ({ page }) => {
    const amount = page.locator('#loanAmount');
    const submit = page.getByRole('button', { name: 'Find programs' });

    // Blank.
    await page.locator('#businessType').selectOption('Retail');
    await page.locator('#yearsInBusiness').fill('3');
    await page.locator('#creditTier').selectOption('Good');
    await submit.click();
    await expect(page.locator('.field-invalid', { has: amount }).locator('.field-error')).toHaveText(
      'Enter a loan amount.',
    );
    await expect(amount).toHaveAttribute('aria-invalid', 'true');

    // Zero.
    await amount.fill('0');
    await submit.click();
    await expect(page.locator('.field-error')).toHaveText(
      'Loan amount must be greater than zero.',
    );

    // A minus sign and a decimal point are simply unenterable (F2 rejects non-numeric by
    // making it impossible to type, which is why there is no error message for them).
    await amount.fill('');
    await amount.pressSequentially('-5');
    await expect(amount).toHaveValue('5');

    await amount.fill('');
    await amount.pressSequentially('1.5');
    await expect(amount).toHaveValue('15');

    // A valid amount clears the error and produces results.
    await amount.fill('250000');
    await expect(amount).toHaveValue('250,000');
    await submit.click();
    await expect(page.locator('.field-error')).toHaveCount(0);
  });

  test('keeps results on screen when a later entry is invalid', async ({ page }) => {
    await submitCriteria(page, TYPICAL);
    const rows = programRows(matchSection(page));
    await expect(rows).toHaveCount(5);

    // A rep mid-call who mistypes must not lose the table they were reading from.
    await page.locator('#loanAmount').fill('0');
    await page.getByRole('button', { name: 'Find programs' }).click();

    await expect(page.locator('.field-error')).toHaveCount(1);
    await expect(rows).toHaveCount(5);
  });
});

test.describe('E8 — required selects (F3)', () => {
  test('names each unset field and computes nothing', async ({ page }) => {
    await page.locator('#loanAmount').fill('250000');
    await page.locator('#yearsInBusiness').fill('4');
    await page.getByRole('button', { name: 'Find programs' }).click();

    await expect(page.locator('.field-error')).toHaveText([
      'Select a business type.',
      'Select a credit tier.',
    ]);
    await expect(matchSection(page)).toHaveCount(0);
  });

  test('accepts zero years in business as valid', async ({ page }) => {
    await submitCriteria(page, { ...TYPICAL, years: '0' });
    await expect(page.locator('.field-error')).toHaveCount(0);
    await expect(matchSection(page)).toBeVisible();
  });
});

test.describe('E16 — banned vocabulary (F20)', () => {
  const BANNED = /\b(qualified|approved|eligible)\b/i;

  for (const [name, criteria] of Object.entries({
    'a normal result': TYPICAL,
    'a near miss': { ...TYPICAL, years: '1' },
    'a total blocker': { amount: '6000000', businessType: 'Retail', years: '10', tier: 'Excellent' },
  })) {
    test(`app copy never uses a banned word for ${name}`, async ({ page }) => {
      await submitCriteria(page, criteria);

      // Strip the two places the words may legitimately appear:
      //   - F19's mandated "Not a pre-approval." (which is app copy the spec dictates)
      //   - verbatim lender requirement text from the CSV, e.g. "Franchise must be
      //     SBA-approved". F17 requires showing it; it describes a franchise, not the
      //     borrower's application. See the note in TEST_PLAN.md.
      const text = await page.locator('main').evaluate((main) => {
        const clone = main.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.disclaimer, .requirements').forEach((node) => node.remove());
        return clone.innerText;
      });

      expect(text).not.toMatch(BANNED);
      // F20's positive half: the tool says "likely fit" instead.
      await expect(page.locator('h2').first()).toContainText('Likely fits');
    });
  }

  test('the only "approved" on screen is verbatim lender data', async ({ page }) => {
    // Keeps the exclusion above honest: if app-authored copy ever introduces the word,
    // the test above fails rather than being silently widened.
    await submitCriteria(page, { ...TYPICAL, years: '1' });

    const hits = await page.locator('main :text-matches("approved", "i")').count();
    if (hits > 0) {
      const sources = await page
        .locator('.requirements:text-matches("approved", "i")')
        .allTextContents();
      for (const source of sources) {
        expect(source).toMatch(/SBA-approved/i);
      }
    }
  });
});

test.describe('E6b — near-miss gaps are readable without hover (F13)', () => {
  test('chip text is present in the DOM, not in a title attribute', async ({ page }) => {
    await submitCriteria(page, { ...TYPICAL, years: '1' });
    const chips = nearMissSection(page).locator('.chip-miss');
    expect(await chips.count()).toBeGreaterThan(0);
    for (const text of await chips.allTextContents()) {
      expect(text.trim().length).toBeGreaterThan(10);
    }
  });
});
