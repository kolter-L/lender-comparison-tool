# SPEC.md

Lender Comparison Tool — V1 Specification

## Resolved ambiguities

- **Section membership is exclusive.** A row appears in exactly one section. Closest Available = everything not already in Match or Near Miss. Otherwise the same program shows up twice.
- **Near-miss sort.** Near-miss rows have zero hard misses by definition, so sorting uses **miss count ascending (1 before 2), tie-broken by `interest_rate_min`.** Explainable, no weight tuning needed.

---

## Stack

**Language: TypeScript.** Chosen primarily for the AI feedback loop — the compiler catches hallucinated field names before runtime, which matters given 17 snake_case CSV columns an AI will inconsistently camelCase. In JS that failure mode is a silently blank cell; in TS it does not compile. Also enables typed refactors and encodes the domain directly (`type CreditTier = 'Excellent' | 'Good' | 'Fair'`).

| Layer | Pick | Why |
|---|---|---|
| Scaffold | Vite + `react-ts` | Fastest cold start, no config |
| Language | TypeScript | Above |
| CSV parsing | PapaParse | Handles quoting, headers, and the nulls in the data |
| Styling | Plain CSS or Tailwind | Whichever is faster. No component library |
| State | `useState` | 49 rows, one form. No Redux, no Zustand |
| Tests | Vitest (ships with Vite) | Optional. `matchPrograms` is pure — a handful of unit tests here is the strongest QA artifact |

**TypeScript guardrails (to protect the time budget):**

- Scaffold with `npm create vite@latest -- --template react-ts`. Do not hand-roll a build setup
- Keep `strict: true`, but disable `noUnusedLocals` / `noUnusedParameters` if they block mid-iteration builds. They are lint preferences, not safety
- Do not perfectly type the parse boundary. PapaParse returns `any` — cast once at the edge into `LenderProgram`, validate required fields exist, move on. No runtime validation library

---

## Architecture

### Logic containers: pure functions, not classes

All matching, scoring and sorting logic lives in `src/domain/` as **pure module functions**. No classes — there is no state to hold, and a stateless single-method class is a function in a costume. The organizational benefit ("all the logic in one obvious place") comes from the folder, not the construct.

| | Class | Pure module functions |
|---|---|---|
| Holds state | Yes — but there is none to hold | N/A |
| Testable | `new Matcher(...).run()` | `matchPrograms(criteria, programs)` |
| Meets N8 (pure, no DOM/fetch/`Date.now()`) | Only if disciplined | By construction |
| Movable to a backend in V2 | Yes | Yes, verbatim |
| AI-generated correctly | Usually | Almost always |

**Dependency injection without classes:** pass `today` as a parameter — `evaluateStaleness(program, today: Date)` — so staleness is testable without mocking the clock.

### File structure

```
src/
├── models/                     # Types + domain vocabulary. No logic.
│   ├── LenderProgram.ts        # interface matching the 17 CSV columns
│   ├── BorrowerCriteria.ts     # the 4 rep inputs
│   ├── MatchResult.ts          # ClassifiedProgram, MissReason, ResultSet
│   └── enums.ts                # CreditTier, BusinessType, ProgramType, MissField
│
├── domain/                     # ALL business logic. Pure. No React, no fetch.
│   ├── matchPrograms.ts        # classification + sorting + orchestration.
│   │                           # Single public entry point. (F4–F10)
│   ├── closeness.ts            # weighted score (F12)
│   ├── staleness.ts            # last_updated vs today (F22)
│   └── tiers.ts                # Excellent ≥ Good ≥ Fair ordering (F5)
│
├── data/
│   ├── loadPrograms.ts         # the ONLY file that knows data is a CSV (N7, F25–F28)
│   └── parseProgram.ts         # raw row → LenderProgram, snake_case → typed
│
├── services/
│   ├── clipboard.ts            # format + copy top 3 (F21)
│   └── logRecommendation.ts    # no-op seam for V2 analytics (F24)
│
├── views/                      # Page-level composition. Owns state.
│   └── ComparisonView.tsx      # the one screen: form + three sections
│
├── components/                 # Presentational. Props in, JSX out.
│   ├── CriteriaForm.tsx
│   ├── MatchSection.tsx            # (F8) owns the sort toggle
│   ├── NearMissSection.tsx         # (F9)
│   ├── ClosestAvailableSection.tsx # (F10, F15)
│   ├── ProgramRow.tsx          # aligned columns (F16, F17)
│   ├── MissChip.tsx            # red inline gap text (F13)
│   ├── StalenessBadge.tsx      # (F22)
│   ├── BlockerHeadline.tsx     # (F15)
│   ├── Disclaimer.tsx          # (F19)
│   ├── DataFreshnessHeader.tsx # (F23)
│   ├── LoadingState.tsx        # (F26)
│   └── ErrorState.tsx          # (F27)
│
├── App.tsx
└── main.tsx

public/
└── data/lenders.csv            # ops-replaceable, fetched at runtime

src/domain/__tests__/
├── closeness.test.ts
└── matchPrograms.test.ts
```

**Decisions baked in:**

- Classification and sorting are **merged into `matchPrograms.ts`** rather than split across `classify.ts` / `sorting.ts`. Fewer files for a 3-hour build
- The three result sections are **three separate components**, not one generic component with a `variant` prop. More code, but each one is obvious and independently editable

### Layering rules

| Rule | Why |
|---|---|
| `domain/` imports **nothing** from React, `data/`, or `components/` | This is N8. It also lets the folder lift to a server in V2 untouched |
| `models/` contains types only, zero logic | Prevents "where does this function live" drift |
| `components/` are presentational — no fetching, no matching | Props in, JSX out. Trivially AI-generatable |
| `views/` owns `useState` and calls `matchPrograms` | Exactly one place state lives |
| `loadPrograms.ts` is the only CSV-aware file | V2 swaps its body for `fetch('/api/programs')`. Nothing else changes |

### The snake_case boundary

`parseProgram.ts` is the single translation point:

```
CSV: max_loan_amount  →  parseProgram.ts  →  LenderProgram.maxLoanAmount
```

Everything downstream is camelCase and typed. This is the file that prevents the silent blank-cell failure mode, and the one file worth reviewing line by line against the CSV header.

---

## Functional requirements — V1

### Input

| # | Requirement |
|---|---|
| F1 | Four inputs: loan amount, business type, years in business, credit tier |
| F2 | Loan amount in **plain dollars**. Positive integer only. Reject blank, zero, negative, non-numeric. Display with thousands separators as typed (`250,000`) |
| F3 | Business type: 7 fixed values + "Other". Years in business: non-negative integer. Credit tier: Excellent / Good / Fair |

### Matching

| # | Requirement |
|---|---|
| F4 | **Hard criteria:** `max_loan_amount` and `eligible_business_types`. `All` matches any type; "Other" matches only rows marked `All` |
| F5 | **Soft criteria:** `min_loan_amount`, `min_years_in_business`, `credit_tier_required`. Tier is a floor: Excellent ≥ Good ≥ Fair |
| F6 | `min_credit_score`, `max_existing_debt_ratio`, `requires_collateral`, `special_requirements` are **display-only** — never filtered on |
| F7 | Every row is classified into exactly one section: Match (0 hard, 0 soft misses) → Near Miss (0 hard, 1–2 soft) → Closest Available (everything else) |

### Results — three sections

| # | Section | Contents | Sort | Cap |
|---|---|---|---|---|
| F8 | **Match** | 0 misses | `interest_rate_min` asc, toggle to `turnaround_days` asc | Top 5 + "Show all N" |
| F9 | **Near Miss** | 0 hard, 1–2 soft misses | Miss count asc, tie-break `interest_rate_min` asc | Top 5 |
| F10 | **Closest Available** | All remaining rows | Weighted closeness score asc | Top 5, always |

| # | Requirement |
|---|---|
| F11 | Closest Available is always shown and always populated (unless no rows remain). Never unbounded — hard cap 5 |
| F12 | Closeness weights (Closest Available only): years short `(req−actual)/req` ×1.0 · tier steps short ÷2 ×1.0 · under min loan `(req−reqd)/req` ×0.5 · over max loan `(reqd−max)/max` ×2.0 · business type mismatch ×3.0 |
| F13 | In Near Miss and Closest Available, each missed field is a **red chip with inline text**, no tooltip: `⚠ Needs 2 yrs in business — borrower has 1`. Chip is red, card is not |
| F14 | Empty Match section shows a plain message, not a blank area. Closest Available carries the answer |
| F15 | When Match and Near Miss are both empty, show a blocker headline naming the dominant hard failure: *"No programs cover $6,000,000 — the highest in our network is $5,500,000"* |

### Display & output

| # | Requirement |
|---|---|
| F16 | Results render as aligned columns — side-by-side comparison is inherent. No separate compare flow |
| F17 | Each row shows: lender name, program type, rate **range** (never a single figure), max term, SBA guarantee %, turnaround days, collateral, special requirements, `last_updated` |
| F18 | Sort control labeled "Lowest starting rate" / "Fastest turnaround". Applies only to Match |
| F19 | Non-binding disclaimer on screen and in every copied output: *"Likely fit — subject to full eligibility review. Not a pre-approval."* |
| F20 | Never display "qualified," "approved," or "eligible" — use "likely fit" |
| F21 | Copy top 3 matches to clipboard as plain text, including rate ranges, "as of" date, and F19 |
| F22 | Staleness badge per row where `last_updated` > 30 days before system date |
| F23 | Dataset freshness in header: "Rates as of 2/8/2026" |
| F24 | `logRecommendation({criteria, programIds, action})` fires on copy and on expand. `console.debug` in V1 |

### Data loading

| # | Requirement |
|---|---|
| F25 | CSV fetched at runtime from a static path. Ops replaces the file; no rebuild |
| F26 | Explicit loading state during fetch/parse |
| F27 | Explicit error state on fetch failure, malformed CSV, or zero parsed rows. Never a silent blank screen |
| F28 | Cache-bust the CSV request (`?v=<timestamp>` or no-cache headers) so reps don't get stale rates after an update |

---

## Non-functional — changed items only

| # | Requirement |
|---|---|
| N4 | HTTPS or localhost — clipboard API needs a secure context, and `fetch` of a local file needs a server (`file://` will fail CORS) |
| N9 | ~~CSV bundled at build~~ → **CSV fetched at runtime.** Rate updates are an ops task, not a developer task |
| N13 | README must state where the CSV lives and how to replace it |

All other NFRs unchanged.