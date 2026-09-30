# Lender Comparison Tool

SBA lender comparison for sales reps on live borrower calls. Enter four borrower details and
get likely fits, near misses and the closest available programs side by side.

See `SPEC.md` for the numbered requirements (F1–F28, N1–N13) and `TEST_PLAN.md` for the
end-to-end acceptance matrix.

## What it does

- **Four inputs:** loan amount, business type, years in business, credit tier.
- **Three result sections**, every program in exactly one of them — likely fits, close with
  gaps, and closest available. Aligned columns, so programs compare side by side with no
  separate compare flow.
- **Named gaps.** A program that falls short says why, inline: *"Needs 2 yrs in business —
  borrower has 1."*
- **A blocker headline** when nothing in the network fits: *"No programs cover $6,000,000 —
  the highest in our network is $5,500,000."*
- **Sort** likely fits by lowest starting rate or fastest turnaround.
- **Copy the top 3** to the clipboard as plain text, disclaimer included.
- **Rates always as a range**, never a single figure. Results are "likely fits", never
  qualified, approved or eligible.
- **Freshness signals:** a "Rates as of" header, and a badge on any row not updated in over
  30 days.

Static site. No backend, no accounts, no database — all program data comes from one CSV.

## Setup

Needs **Node 22.12+ or 24+**. Nothing else to install or configure.

```bash
git clone <repo-url>
cd lender-comparison-tool
npm install
```

Then add the rate sheet. It is **not in the repo** — it is ops-owned data, so a fresh clone
does not have one:

```
public/lender_programs.csv
```

Without it the app loads and shows its error state rather than a blank screen. See
[The rate data](#the-rate-data) for the format.

```bash
npm run dev      # http://localhost:5173
```

It must be served over localhost or HTTPS. Opening the built `index.html` as a `file://`
URL will not work — the CSV fetch fails CORS, and copying to the clipboard needs a secure
context.

### Other commands

```bash
npm run build      # production build into dist/
npm run preview    # serve the production build
npm run typecheck  # tsc -b
npm run lint       # oxlint
```

Use `npm run typecheck`, not `tsc --noEmit`: the root `tsconfig.json` is a solution file, so
non-build-mode `tsc` compiles nothing and exits 0 no matter what is broken.

## Running the tests

```bash
npm test           # unit — the matching, parsing and formatting logic
npm run test:e2e   # end-to-end — the real app in a real browser
```

The unit suite runs on a fresh clone with no rate sheet; the handful of tests that read the
real file skip themselves. The end-to-end suite builds its fixtures from that file, so it
does need one present.

The end-to-end suite needs a browser the first time, and nothing else:

```bash
npx playwright install chromium
```

It builds the app and serves it on `http://localhost:4173` by itself, so no dev server has
to be running. Fixtures — a partly broken sheet, a sheet missing a column, a 1000-row sheet
— are derived from your CSV in memory and served by intercepting the request, so **the
suite never modifies your rate data.**

```bash
npm run test:e2e:ui                   # pick and step through one scenario
npx playwright test --repeat-each=3   # flake check
```

## The rate data

All rates and program terms come from one CSV, fetched at runtime from:

```
public/lender_programs.csv
```

**To replace it:** overwrite the file and reload the page. No rebuild and no developer
involved. The app fetches it with a cache-busting query string, so reps see new rates on
their next page load rather than a cached copy. In a deployed build the file sits at the web
root (`dist/lender_programs.csv`) and is replaced the same way.

The first row must be a header with these 17 columns; extras are ignored:

```
lender_name, program_type, min_loan_amount, max_loan_amount, min_credit_score,
credit_tier_required, min_years_in_business, interest_rate_min, interest_rate_max,
max_term_months, sba_guarantee_pct, eligible_business_types, requires_collateral,
max_existing_debt_ratio, turnaround_days, special_requirements, last_updated
```

- `credit_tier_required` — `Excellent`, `Good` or `Fair`
- `eligible_business_types` — one type, or `All` to accept any
- `requires_collateral` — `Yes`, `No` or `Varies`
- `last_updated` — `M/D/YYYY`, e.g. `2/8/2026`
- `max_existing_debt_ratio` and `special_requirements` may be blank; every other column is
  required

A row with a bad or missing cell is **skipped** and the rest of the sheet still loads, so one
bad row never costs a rep the whole sheet mid-call. Skipped rows are reported in the browser
console with their CSV line numbers. Only two problems fail the whole load, because neither
leaves anything to show: a missing or malformed header, and a file in which every row was
rejected.
