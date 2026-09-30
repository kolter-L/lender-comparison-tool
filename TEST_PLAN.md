# TEST_PLAN.md

Acceptance test matrix for V1. Scoped to **22 scenarios** — the happy paths a rep
actually walks on a call, the ways the data can fail them, and the edges where the
spec is easy to get subtly wrong. Requirement numbers refer to `SPEC.md` (F1–F28,
N1–N13).

This is a deliberately capped list, not a coverage target. See
[Not in this pass](#not-in-this-pass) for what was left out and why.

## How to run

- **Unit** — `npm test` (Vitest, pure `domain/`, `data/`, `services/`).
- **Manual** — `npm run dev`, then localhost in a browser. Never `file://` (N4:
  `fetch` needs a server, clipboard needs a secure context).
- Fixture data is the real `public/lender_programs.csv`: 49 rows, network max
  `$5,500,000`, newest `last_updated` `2/8/2026`, 19 rows open to `All` business types.

## Matrix

| # | Type | Req | Scenario | Input / setup | Expected result | Layer |
|---|---|---|---|---|---|---|
| T1 | Happy | F23, F25, F26 | Cold load | Dev server up, CSV in place | Loading state shows during fetch, then form renders with header "Rates as of 2/8/2026" and a prompt to enter details — no empty table, no results yet | Manual |
| T2 | Happy | F1, F4, F5, F7, F16, F17 | Typical ask returns matches | `250,000` · Restaurant/Food Service · `5` yrs · Good | Match section populated. Each row shows lender, program type, rate **range**, max term, SBA guarantee %, turnaround days, collateral, special requirements, `last_updated` — in aligned columns | Manual + unit (`matchPrograms.test.ts`) |
| T3 | Happy | F8, F18 | Sort toggle | From T2, switch "Lowest starting rate" → "Fastest turnaround" | Match reorders by `turnaroundDays` asc. Near Miss and Closest Available are untouched | Manual + unit |
| T4 | Happy | F8, F24 | Expand beyond top 5 | Criteria yielding >5 matches (e.g. `100,000` · Other · `10` · Excellent) | Top 5 shown with "Show all N"; click reveals all N rows and fires one `logRecommendation` `expand` via `console.debug` | Manual |
| T5 | Happy | F19, F21, F24, N4 | Copy top 3 | From T2, click copy | Clipboard holds ≤3 programs with rate ranges, the "as of" date, and the F19 disclaimer verbatim. `copy` log event fires. Confirmation shown | Manual + unit (`clipboard.test.ts`) |
| T6 | Happy | F5, F9, F13 | Near miss with inline gap chip | Amount/type clear a program, but borrower is `1` yr against a `2` yr minimum | Row lands in Near Miss with a red chip reading `⚠ Needs 2 yrs in business — borrower has 1`. Chip is red; the card is not. No tooltip needed to read the gap | Manual + unit |
| T7 | Error | F2 | Loan amount rejected | Submit blank; then `0`; then attempt `-5` and `1.5` | Blank → "Enter a loan amount." Zero → must be greater than zero. Minus sign and decimal point are unenterable (digits only). Valid input displays as `250,000` while typing. Results already on screen are retained | Manual |
| T8 | Error | F3 | Required selects unset | Submit with business type and credit tier unchosen | One inline error per unset field; no results computed | Manual |
| T9 | Error | F27 | CSV missing | Rename `public/lender_programs.csv`, reload | Explicit error state with a readable message and a retry control. Retry after restoring the file recovers. Never a blank screen | Manual + unit (`loadPrograms.test.ts`) |
| T10 | Error | F27 | Structurally malformed CSV — fatal | (a) drop the `credit_tier_required` column; (b) header-only file; (c) undetectable delimiter | Each aborts the load with a distinct message. These are file-level faults: no row is salvageable, so partial loading does not apply | Unit + manual spot-check |
| T11 | Error | F27 | Every row unusable | 10-row sheet, valid header, all 10 rows bad | Error state naming the count ("all 10 rows were rejected"). This is the floor under T21: partial loading must not degrade into a blank results page | Unit |
| T12 | Edge | F11, F14, F15 | Ask above the whole network | `6,000,000` · Retail · `10` · Excellent | Match and Near Miss both empty with plain messages. Blocker headline: "No programs cover $6,000,000 — the highest in our network is $5,500,000". Closest Available still populated | Manual + unit (`realCsv.test.ts`) |
| T13 | Edge | F15 | Blocker names business type, not amount | Amount every program covers, but a type no row is open to | Blocker names the dominant hard failure as the type mismatch, not the loan amount | Unit |
| T14 | Edge | F4 | "Other" business type | `150,000` · Other · `5` · Good | Only rows marked `All` (19 of 49) can reach Match or Near Miss. Every type-specific row is a hard miss → Closest Available | Manual + unit |
| T15 | Edge | F5, F6 | Tier floor, and display-only fields | Same criteria at Excellent, then Fair | Excellent clears every program's tier requirement (floor, not equality); Fair only clears Fair rows. `min_credit_score`, `max_existing_debt_ratio`, `requires_collateral`, `special_requirements` never move a row between sections — they only render | Unit |
| T16 | Edge | F7 | Exclusive membership across the real dataset | Sweep amount × type × years × tier combinations over all 49 rows | Every row appears in exactly one section every time. No duplicates, no dropped rows | Unit (`realCsv.test.ts`) |
| T17 | Edge | F10, F11, F12 | Closest Available is bounded and correctly ordered | Criteria producing >5 non-matching rows | Exactly 5 rows, sorted by weighted closeness asc. Weights per F12: years ×1.0 · tier steps ÷2 ×1.0 · under-min ×0.5 · over-max ×2.0 · type mismatch ×3.0. An over-max row outranks a type mismatch | Unit (`closeness.test.ts`) + manual |
| T18 | Edge | F22 | Staleness badge boundary | Fix `today`; rows at exactly 30 and at 31 days older | Badge appears only past 30 days. A row updated 30 days ago carries none | Unit (`realCsv.test.ts` covers real dates; the 30/31-day boundary needs a direct `staleness` test) |
| T19 | Edge | F20 | Banned vocabulary | Scan all rendered result text, chip text, blocker copy and clipboard output | "qualified", "approved", "eligible" never appear for a borrower result. "Likely fit" is used. Only exception: F19's mandated "…Not a pre-approval." | Unit + manual read-through |
| T20 | Edge | F28 | Ops rate update reaches the rep | Load app, edit a rate in the CSV, reload without restarting the server | Fresh rate appears — request is cache-busted and sent `no-store`. No rebuild required (F25, N9) | Manual + unit |
| T21 | Error | F26, F27 | Partial load — bad rows skipped, not fatal | 52-row sheet: 49 good, plus one unknown credit tier, one non-numeric rate, one `last_updated` = `13/45/2026`. Also a row-scoped PapaParse fault (wrong field count) | App reaches the ready state with 49 programs and **no** error screen. One `console.warn` reports "Rejected 3 of 52 rows" and names each offending CSV line. Survivor ids stay pinned to file position, so a skipped line does not renumber the rows after it. Matching runs against the 49 as normal | Unit (`loadPrograms.test.ts`) + manual |
| T22 | Edge | F8, F10, F11, F16 | Scale — 1000-row rate sheet | Generated 1000-row CSV in place of the 49-row file. Submit criteria that match broadly (e.g. `100,000` · Other · `10` · Excellent) | Loads and filters without a visible stall. Budgets: parse+load ≤ 500 ms, one `matchPrograms` call ≤ 50 ms. Caps hold — Near Miss and Closest Available still 5 rows, Match still top 5 with a truthful "Show all N". Expanding a several-hundred-row Match set and toggling the sort afterwards stay responsive | Unit (timed) + manual |

## Coverage summary

| Requirement group | Covered by |
|---|---|
| Input F1–F3 | T2, T7, T8 |
| Matching F4–F7 | T2, T6, T13, T14, T15, T16 |
| Sections F8–F15 | T3, T4, T6, T12, T13, T17, T22 |
| Display F16–F20 | T2, T6, T12, T19 |
| Output F21–F24 | T1, T4, T5, T18 |
| Loading F25–F28 | T1, T9, T10, T11, T20, T21 |

Current automated suite: 69 Vitest tests across 6 files, all passing.

## Not in this pass

Deliberately excluded to keep this bounded — add only if a scenario below actually bites.

- **Component render tests.** No React Testing Library. `components/` are
  presentational (props in, JSX out), so their behavior is asserted through T1–T20
  in the browser rather than through a DOM harness.
- **Cross-browser / responsive.** Single target: a rep on a desktop browser.
- **Performance.** 49 rows, one synchronous pure function. No load testing.
- **Accessibility audit.** Beyond labelled form controls, out of V1 scope.
- **`logRecommendation` payload assertions.** It is a `console.debug` seam for V2
  (F24); T4 and T5 confirm it fires, not what an analytics backend would receive.
- **Exhaustive per-column parse tests.** `parseProgram.test.ts` already walks all 17
  columns; T10 tests the failure modes that reach the rep, not every cell.
