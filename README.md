# Lender Comparison Tool

SBA lender comparison for sales reps on live borrower calls. Enter four borrower details,
get likely fits, near misses and closest available programs side by side.

See `SPEC.md` for the numbered requirements (F1–F28, N1–N13).

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest
npm run typecheck  # tsc -b
npm run build    # tsc -b && vite build
```

Note: use `npm run typecheck` (or `tsc -b`), **not** `tsc --noEmit`. The root `tsconfig.json`
is a solution file (`"files": []` plus project references), so non-build-mode `tsc` compiles
nothing and exits 0 no matter what is broken.

**It must be served over localhost or HTTPS (N4).** Opening `dist/index.html` as a `file://`
URL will not work: the CSV fetch fails CORS and the clipboard API needs a secure context.

## The rate data (N13)

All rates and program terms come from one CSV, fetched at runtime:

```
public/lender_programs.csv
```

### Replacing it

Overwrite the file and reload the page. **No rebuild and no developer involvement (F25).**
The app fetches it with a cache-busting query string and `no-store`, so reps see the new
rates on their next page load rather than a cached copy (F28).

In a deployed build the file sits at the web root — `dist/lender_programs.csv` — and can be
replaced the same way.

### Format

The first row must be a header. These 17 columns are required; extra columns are ignored:

`lender_name`, `program_type`, `min_loan_amount`, `max_loan_amount`, `min_credit_score`,
`credit_tier_required`, `min_years_in_business`, `interest_rate_min`, `interest_rate_max`,
`max_term_months`, `sba_guarantee_pct`, `eligible_business_types`, `requires_collateral`,
`max_existing_debt_ratio`, `turnaround_days`, `special_requirements`, `last_updated`

- `credit_tier_required` — `Excellent`, `Good` or `Fair`
- `eligible_business_types` — one value, or `All` to accept any business type
- `requires_collateral` — `Yes`, `No` or `Varies`
- `last_updated` — `M/D/YYYY`, e.g. `2/8/2026`. Drives the "Rates as of" header (F23) and
  the per-row staleness badge (F22)
- `max_existing_debt_ratio` and `special_requirements` may be blank. Every other column is
  required — a blank or unparseable cell rejects that row rather than rendering a silently
  empty cell (F27)

### When a row is bad

A row with a missing required cell, an unparseable number or date, an unknown credit tier
or collateral value, or the wrong number of fields is **skipped**. The rest of the sheet
still loads, so one bad row never costs reps the whole rate sheet mid-call.

Rejections are reported in the browser console:

```
[rate data] Rejected 2 of 49 rows: [
  'credit_tier_required is not a known tier: "Platinum" (row 14: Coastal Capital)',
  'last_updated is not a real date: "2/30/2026" (row 31: Atlas Financial Services)'
]
```

The row numbers match the CSV's own line numbers, so they can be opened directly in a
spreadsheet. Two cases still fail the whole load, because neither leaves anything to show:
a missing or malformed header, and a file in which **every** row was rejected.

Note that a skipped row is currently visible only in the console — the rep sees a shorter
list with no indication anything was dropped.

### Note for developers

The CSV is **gitignored** — it is ops-owned data, not source. Two consequences:

1. A fresh clone has no CSV. `npm run dev` will show the error state until you add one, and
   the real-file tests in `src/data/__tests__/realCsv.test.ts` skip rather than fail.
2. `vite build` copies `public/` from your working tree, so a CI build without the file
   produces a bundle that shows the error state. Supply the file at deploy time.

`src/data/parseProgram.ts` is the only file that knows these column names. If the header
changes, that is the only file to edit.
