# CLAUDE.md

Read `SPEC.md` first. It is the source of truth. Requirements are numbered F1–F28 and N1–N13 — cite the number when you implement one.

## Project

SBA lender comparison tool for sales reps on live borrower calls. React + TypeScript + Vite. Static, no backend. Data is a CSV fetched at runtime from `public/data/lenders.csv`. Build budget is ~3 hours — prefer the simple version.

## Hard rules

- **`src/domain/` imports nothing from React, `src/data/`, or `src/components/`.** No fetch, no DOM, no `Date.now()` inside. Pass `today: Date` as a parameter.
- **snake_case dies in `src/data/parseProgram.ts`.** The CSV has 17 snake_case columns. That file is the only translation point. Everything downstream is camelCase and typed against `LenderProgram`. Check every field name against the actual CSV header — do not infer them.
- **`src/models/` is types only.** Zero logic.
- **`src/components/` are presentational.** Props in, JSX out. No fetching, no matching, no sorting.
- **`src/views/ComparisonView.tsx` owns all `useState`** and is the only caller of `matchPrograms`.
- **`src/data/loadPrograms.ts` is the only CSV-aware file.** V2 swaps its body for an API call and nothing else changes.

## Language rules (compliance-sensitive)

- Never render the words "qualified", "approved", or "eligible" for a borrower result. Use "likely fit".
- Always show interest rate as a **range** (`11.0% – 13.6%`), never a single figure.
- The non-binding disclaimer (F19) appears on screen and inside any copied text.

## Style

- Keep `strict: true`. Disable `noUnusedLocals` / `noUnusedParameters` if they block mid-iteration builds.
- Cast PapaParse output once at the edge. No runtime validation library.
- No component library, no state library, no router. `useState` only.
- Plain functions over classes. Small files over clever abstraction.
- Do not add features that are not in SPEC.md. The cut list is deliberate.

## Verify before claiming done

Run `npx tsc --noEmit` and the dev server. Do not report a task complete on unverified code.