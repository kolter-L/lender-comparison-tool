# TEST_PLAN.md

**End-to-end acceptance tests for V1.** Every scenario here drives the real app in a
real browser: CSV fetched over HTTP → parsed → matched → rendered → read or copied by
a rep. Nothing below asserts against a function directly.

Unit coverage is deliberately **out of scope for this document**. The pure layers
(`domain/`, `data/`, `services/`) are covered by the Vitest suite — 79 tests, run with
`npm test`. Requirements that are *only* verifiable there (F12's weight arithmetic, F6's
display-only fields, F7's exclusivity sweep, the 30-day staleness boundary) are listed
under [Covered by unit tests instead](#covered-by-unit-tests-instead) and have no row in
this matrix.

Scoped to **17 scenarios**. Requirement numbers refer to `SPEC.md`.

**Status: all 17 are implemented in Playwright** — 34 tests in 5 spec files under `e2e/`,
run with `npm run test:e2e`. Four of them keep a manual residue (colour, perceived
responsiveness, tone, and alignment-as-comparison), marked in the last column and listed
under [Manual-only](#manual-only).

## Preconditions

- App served over HTTP — `npm run dev`, or `npm run build && npm run preview`. Never
  `file://`: N4 requires a server for `fetch` and a secure context for the clipboard.
  `localhost` counts as secure, so the real clipboard works without HTTPS.
- **Fixtures are intercepted, not swapped on disk.** `e2e/csv.ts` reads the real
  `public/lender_programs.csv` once and derives every variant from it in memory
  (`missingColumnCsv`, `allBadCsv`, `partialCsv`, `stalenessCsv`, `scaleCsv`), which
  `e2e/helpers.ts` serves via `page.route('**/lender_programs.csv*')`.

  This reverses an earlier plan to swap the file on disk. Swapping is closer to what ops
  actually does, but that file is gitignored, so a crashed run could leave the only copy
  of the real rate sheet replaced by a deliberately broken fixture — and it serialises a
  suite that otherwise runs fully parallel. Interception costs one seam and buys back both.
  The trade-off: these tests do not exercise real static-file serving, so **E9's
  404 and HTML-fallback cases prove the app's handling, not the host's.**

  Note for anyone writing a new fixture: the ops sheet is **CRLF**. `csv.ts` normalises to
  LF on read, because PapaParse detects a single newline sequence per file — one LF-only
  boundary in a CRLF file silently merges two rows, which then fail as "too many fields".
- Baseline facts: 49 rows, network max `$5,500,000`, newest `last_updated` `2/8/2026`,
  19 rows open to `All` business types.

## Matrix

| # | Type | Req | Scenario | Setup / steps | Expected on screen | Automated in |
|---|---|---|---|---|---|---|
| E1 | Happy | F23, F25, F26 | Cold load | Baseline fixture, open app | Loading state appears, then the form, with header "Rates as of 2/8/2026" and a prompt to enter details. No empty table, no results | `load.spec.ts` |
| E2 | Happy | F1, F16, F17 | Typical ask returns matches | `250,000` · Restaurant/Food Service · `5` · Good → submit | Match section populated. One `<table>`, 7 column headers, every row the same cell count. Rate cell is a **range** (`11.0% – 13.6%`), never one figure | `results.spec.ts` · alignment-as-comparison manual |
| E3 | Happy | F8, F18 | Sort toggle | From E2, switch "Lowest starting rate" → "Fastest turnaround" | Match reorders by turnaround asc. Near Miss and Closest Available unchanged | `results.spec.ts` |
| E4 | Happy | F8, F24 | Expand beyond top 5 | Criteria yielding >5 matches (`100,000` · Other · `10` · Excellent), click "Show all N" | 5 rows become N rows, N matching the label. One `logRecommendation` `expand` event fires | `interaction.spec.ts` |
| E5 | Happy | F19, F21, F24, N4 | Copy top 3 to the real clipboard | From E2, click copy, then read the OS clipboard back | Clipboard holds ≤3 programs with rate ranges, the "as of" date, and the F19 disclaimer verbatim. Confirmation shown. A `copy` event fires | `interaction.spec.ts` |
| E6 | Happy | F9, F13 | Near miss shows its gap inline | Criteria where amount and type clear a program but years fall one short | Row sits in Near Miss with visible text `⚠ Needs 2 yrs in business — borrower has 1`. No hover needed to read it | `results.spec.ts` + `interaction.spec.ts` · colour manual |
| E7 | Error | F2 | Loan amount rejected | Submit blank; then `0`; then type `-5` and `1.5`; then `250000` | Blank → "Enter a loan amount." Zero → must exceed zero. Minus and decimal are unenterable. Valid input displays as `250,000`. Results already on screen survive the error | `interaction.spec.ts` |
| E8 | Error | F3 | Required selects unset | Submit with business type and credit tier unchosen | One inline error per unset field. No results computed | `interaction.spec.ts` |
| E9 | Error | F27 | Rate sheet missing | Delete the CSV, open app; then restore it and click retry | Explicit error state with a readable message and a retry control. Retry recovers to a working table. Never a blank screen | `load.spec.ts` |
| E10 | Error | F27 | Rate sheet structurally unusable | Two runs: (a) `missing-column.csv`; (b) `all-bad.csv` | (a) names missing columns; (b) names the count — "all 10 rows were rejected". Distinct messages, error screen both times | `load.spec.ts` |
| E11 | Error | F26, F27 | Partial load — bad rows skipped | `partial.csv` (49 good + 3 bad), open app, submit E2's criteria | App reaches the normal ready state with **no** error screen and matches over the 49 survivors. A console warning reports "Rejected 3 of 52 rows" and names each bad CSV line | `load.spec.ts` |
| E12 | Edge | F14, F15 | Nothing in the network fits | (a) `6,000,000` · Retail · `10` · Excellent; (b) an amount all programs cover with a type no row accepts | (a) blocker reads "No programs cover $6,000,000 — the highest in our network is $5,500,000". (b) blocker names the **type** failure, not the amount. Match and Near Miss show plain messages, not blank areas | `results.spec.ts` |
| E13 | Edge | F4 | "Other" business type | `150,000` · Other · `5` · Good | No type-specific lender appears in Match or Near Miss — only rows marked `All` reach them. The rest are visible in Closest Available | `results.spec.ts` |
| E14 | Edge | F10, F11 | Closest Available is always there and always bounded | Several criteria sets, including one where everything matches and one where nothing does | Section is present and populated in every case, never more than 5 rows | `results.spec.ts` |
| E15 | Edge | F22 | Staleness badge renders | Fixture with rows ~40 days and ~5 days older than today; submit anything matching both | Badge visible on the old row's `last_updated` cell, absent on the fresh one | `staleness.spec.ts` |
| E16 | Edge | F20 | Banned vocabulary anywhere on screen | Walk E2, E6, E11 and E12, scraping the full rendered page text each time | "qualified", "approved" and "eligible" never appear for a borrower result. Sole exception: F19's mandated "…Not a pre-approval." | `interaction.spec.ts` · tone manual |
| E17 | Edge | F8, F11, F16 | 1000-row rate sheet | `scale-1000.csv`, open app, submit broad criteria, expand Match, then toggle sort | Loads and filters with no visible stall. Caps hold: 5 in Near Miss and Closest Available, Match top 5 with a truthful "Show all N". Expanding several hundred rows and re-sorting afterwards stay responsive | `scale.spec.ts` · responsiveness manual |

## Automation notes

```
npm run test:e2e        # headless, all 17 scenarios
npm run test:e2e:ui     # pick and step through one
npx playwright test --repeat-each=3   # flake check
```

`playwright.config.ts` builds the app and serves it with `vite preview` on
`http://localhost:4173`, so the suite runs against the same production build and static
file serving ops deploys — not a dev-only middleware path. `localhost` satisfies N4's
secure-context requirement, so the clipboard is real.

Four things worth knowing, three of which are Playwright making an earlier worry moot:

1. **`console.debug` needs no shim.** Playwright's `page.on('console')` surfaces every
   level, so F24's `logRecommendation` (`console.debug`) and the skipped-row
   `console.warn` are both readable directly. The in-page override this plan previously
   called for — a Selenium workaround, since Chrome's WebDriver log endpoint drops
   verbose entries — is not needed.
2. **The clipboard needs no permission dance.** `permissions: ['clipboard-read',
   'clipboard-write']` in the config is enough for E5 to read back what the app wrote
   with `navigator.clipboard.readText()`. No textarea-and-paste trick.
3. **Auto-waiting replaces explicit waits.** Web-first assertions retry, so there are no
   `sleep` calls and no `WebDriverWait` equivalents. The one place a wait is explicit is
   `waitForReady`, which waits for the submit button to enable — the form is disabled
   until the CSV resolves, so clicking earlier would race the fetch.
4. **Timings are recorded, not gated.** E17 prints `load / expand / re-sort` to the
   console and asserts none of them. A wall-clock threshold on a shared runner fails for
   reasons unrelated to this app.

### Measuring E17 honestly

The first run of E17 reported a 6.2-second re-sort. That was the *test*, not the app: the
column-reading helper made one round trip per row, 1000 of them, inside the timed window.
Reading the column in a single `evaluateAll` — and stopping the clock before reading at
all — puts the same operation at ~130 ms.

Recorded on an M-series laptop, 1000 rows: **load 69–83 ms, expand to 1000 rows
124–133 ms, re-sort 131–140 ms.** No stall, and the `useMemo` re-running the whole match
on a sort toggle is not the problem it looked like it might be. Anyone changing
`ComparisonView`'s memo dependencies should re-read these numbers rather than trust them.

### F17 and F20 collide in the data, and E16 has to take a side

F20 forbids ever displaying "approved". F17 requires displaying `special_requirements`
verbatim. Four rows of the real sheet carry **"Franchise must be SBA-approved"** — so a
naive banned-word scan of the rendered page fails on the data, not on the code.

E16 resolves this by scanning `main` with two nodes removed: the F19 disclaimer (whose
"Not a pre-approval." is app copy the spec dictates) and `.requirements` spans (verbatim
lender data describing a franchise, not the borrower's application). A companion test then
keeps that exclusion honest — it asserts that every on-screen "approved" is inside a
`.requirements` span and matches `SBA-approved`, so if app-authored copy ever introduces
the word, the main scan fails instead of being quietly widened.

Worth a compliance read either way: the tests encode the judgement that lender requirement
text is out of F20's scope. If that is wrong, the fix is in the data or in F17, not here.

## Manual-only

These have no honest automated form. Keep them as a short pre-ship checklist.

- **Colour and emphasis (F13).** E6 asserts the chip's text and that it carries no
  `title` attribute, so the gap is readable without hover. It cannot judge that the chip
  reads as red while the card stays neutral.
- **Column alignment as *comparison* (F16).** E2 and E17 prove the table is structurally
  regular — one `<table>`, seven headers, every row exactly seven cells, checked at 5 rows
  and at 1000. Whether three programs are genuinely scannable side by side is a human read.
- **"No visible stall" (E17).** The numbers above are reassuring, but the acceptance
  criterion is what a rep perceives on their own machine.
- **Tone beyond the word list (F20).** A scan catches three forbidden words. It cannot
  catch a phrasing that implies approval without using them — the actual compliance risk.

## Covered by unit tests instead

Not in this matrix because driving a browser adds nothing over calling the function:

- **F12** closeness weights and their relative ordering — `closeness.test.ts`.
- **F6** display-only fields never affecting classification — `matchPrograms.test.ts`.
- **F7** exclusive section membership swept across all 49 rows and many criteria
  combinations — `realCsv.test.ts`. A sweep is a loop, not a user journey.
- **F5** credit tier as a floor — `matchPrograms.test.ts`.
- **F22** the exact 30-vs-31-day boundary — pure date arithmetic. E15 only proves the
  badge is wired to the screen. *(Still needs writing.)*
- **F28** cache-bust URL shape and `no-store` header — `loadPrograms.test.ts`. The
  end-to-end version, "ops edits the file and the rep sees the new rate on reload," is a
  one-line manual check folded into E11's fixture swap.
- **Row-level parse failures** per column — `parseProgram.test.ts`.

## Not in this pass

- **Component tests in a simulated DOM.** Out of scope by definition — see the note on
  jsdom below.
- **Cross-browser.** One target: a desktop Chrome-class browser.
- **Accessibility audit** beyond labelled form controls.
- **Load/perf beyond E17's 1000 rows.** One user, one synchronous pure function.

### Why no jsdom layer

`jsdom` is a JavaScript reimplementation of a browser's DOM APIs that runs inside Node —
it parses HTML, builds a document tree, and answers `querySelector`, event dispatch and
so on, so React components can be rendered and poked at in a plain test process with no
browser. It is what React Testing Library normally runs on, and it is fast.

It is also **not end-to-end**: there is no network stack, no layout engine, no real
clipboard, and no rendering. Tests written on it sit between unit and E2E — useful for
component wiring, but they would answer a different question than this document asks. So
they are out of scope here, and correspondingly nothing in the matrix above depends on
them.
