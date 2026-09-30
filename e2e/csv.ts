import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Fixture CSVs for the E2E suite.
 *
 * The baseline is read from the real `public/lender_programs.csv` rather than a committed
 * copy: that file is gitignored ops data (F25), and duplicating 49 rows of it into the
 * repo would create a second source of truth that silently drifts.
 *
 * Every variant is DERIVED from that baseline at run time and served via request
 * interception — no test ever writes to `public/`. Swapping the file on disk would be
 * closer to what ops does, but it serialises the suite and, because the file is
 * gitignored, a crashed run could leave the only copy of the real rate sheet replaced by
 * a deliberately broken fixture. Interception trades that risk for one seam.
 */

// package.json sets "type": "module", so this file is ESM — no __dirname.
const CSV_PATH = fileURLToPath(new URL('../public/lender_programs.csv', import.meta.url));

export interface Csv {
  header: string;
  rows: string[];
}

function readBaseline(): Csv {
  let text: string;
  try {
    text = readFileSync(CSV_PATH, 'utf8');
  } catch {
    throw new Error(
      `E2E fixtures need ${CSV_PATH}, which is gitignored ops data (F25). ` +
        'Put the 49-row rate sheet there before running the suite.',
    );
  }
  // The real sheet is CRLF (Excel is what ops edits it in). Normalise to LF here so that
  // derived fixtures never mix the two: PapaParse detects ONE newline sequence for the whole
  // file, so a single LF-only boundary in a CRLF file silently merges two rows into one.
  const lines = text.replace(/\r\n?/g, '\n').trim().split('\n');
  const [header, ...rows] = lines;
  if (header === undefined || rows.length === 0) {
    throw new Error('The baseline rate sheet is empty.');
  }
  return { header, rows };
}

export const baseline: Csv = readBaseline();

/** Column index by snake_case name, so fixtures never hard-code positions. */
const COLUMN_INDEX: Record<string, number> = Object.fromEntries(
  baseline.header.split(',').map((name, index) => [name.trim(), index]),
);

function columnIndex(name: string): number {
  const index = COLUMN_INDEX[name];
  if (index === undefined) throw new Error(`No such CSV column: ${name}`);
  return index;
}

export function serialise(csv: Csv): string {
  return [csv.header, ...csv.rows].join('\n') + '\n';
}

/** The untouched 49 rows. */
export function baselineCsv(): string {
  return serialise(baseline);
}

function withCell(row: string, column: string, value: string): string {
  const cells = row.split(',');
  cells[columnIndex(column)] = value;
  return cells.join(',');
}

/** Row count in the baseline — asserted against in a few places. */
export const BASELINE_ROW_COUNT = baseline.rows.length;

/** F27: header missing a required column. Dropped from the header AND every row. */
export function missingColumnCsv(column = 'interest_rate_max'): string {
  const index = columnIndex(column);
  const drop = (line: string) => line.split(',').filter((_, i) => i !== index).join(',');
  return serialise({ header: drop(baseline.header), rows: baseline.rows.map(drop) });
}

/** F27: valid header, every row unusable. The floor under partial loading. */
export function allBadCsv(count = 10): string {
  const template = baseline.rows[0]!;
  const rows = Array.from({ length: count }, (_, i) =>
    withCell(withCell(template, 'credit_tier_required', 'Platinum'), 'lender_name', `Broken ${i}`),
  );
  return serialise({ header: baseline.header, rows });
}

/**
 * E11: 49 good rows plus 3 distinct kinds of bad row.
 * One unknown credit tier, one non-numeric rate, one impossible date.
 */
export function partialCsv(): { text: string; good: number; total: number } {
  const template = baseline.rows[0]!;
  const bad = [
    withCell(withCell(template, 'credit_tier_required', 'Platinum'), 'lender_name', 'Bad Tier Bank'),
    withCell(withCell(template, 'interest_rate_min', 'eleven'), 'lender_name', 'Bad Rate Bank'),
    withCell(withCell(template, 'last_updated', '13/45/2026'), 'lender_name', 'Bad Date Bank'),
  ];
  const rows = [...baseline.rows, ...bad];
  return { text: serialise({ header: baseline.header, rows }), good: BASELINE_ROW_COUNT, total: rows.length };
}

/**
 * E15: one row updated well over the 30-day threshold, one well under it, both matching
 * the same criteria so they render together. Dates are relative to the real clock —
 * ComparisonView reads `new Date()` once per session, so there is no clock to mock.
 */
export function stalenessCsv(today: Date): { text: string; freshDate: string; staleDate: string } {
  const offsetDate = (days: number): string => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  };
  const freshDate = offsetDate(5);
  const staleDate = offsetDate(40);

  const open = (name: string, updated: string) =>
    withCell(
      withCell(
        withCell(
          withCell(
            withCell(withCell(baseline.rows[0]!, 'lender_name', name), 'last_updated', updated),
            'eligible_business_types',
            'All',
          ),
          'min_loan_amount',
          '10000',
        ),
        'max_loan_amount',
        '5000000',
      ),
      'min_years_in_business',
      '0',
    );

  const rows = [open('Fresh Bank', freshDate), open('Stale Bank', staleDate)].map((row) =>
    withCell(row, 'credit_tier_required', 'Fair'),
  );
  return { text: serialise({ header: baseline.header, rows }), freshDate, staleDate };
}

/**
 * E17: a large sheet. Rows are cloned from the baseline with varied rates, turnarounds and
 * limits so that a broad ask produces hundreds of matches — the case where rendering, not
 * matching, is the risk.
 */
export function scaleCsv(count = 1000): string {
  const template = baseline.rows[0]!;
  const rows = Array.from({ length: count }, (_, i) => {
    const rateMin = 6 + (i % 80) / 10;
    let row = withCell(template, 'lender_name', `Bank ${String(i).padStart(4, '0')}`);
    row = withCell(row, 'interest_rate_min', rateMin.toFixed(1));
    row = withCell(row, 'interest_rate_max', (rateMin + 2.4).toFixed(1));
    row = withCell(row, 'turnaround_days', String(5 + (i % 60)));
    row = withCell(row, 'eligible_business_types', 'All');
    row = withCell(row, 'min_loan_amount', '10000');
    row = withCell(row, 'max_loan_amount', '5000000');
    row = withCell(row, 'min_years_in_business', '0');
    row = withCell(row, 'credit_tier_required', 'Fair');
    return row;
  });
  return serialise({ header: baseline.header, rows });
}
