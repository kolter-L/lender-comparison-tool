import Papa from 'papaparse';

import type { LenderProgram } from '../models/LenderProgram';
import type { RawProgramRow } from './parseProgram';
import { csvLineNumber, hasRequiredColumns, parseProgram } from './parseProgram';

/**
 * N7, F25–F28. The ONLY CSV-aware file besides parseProgram.ts.
 * V2 swaps this body for `fetch('/api/programs')` and nothing else changes.
 */

/**
 * F25: static path, ops-replaceable, no rebuild.
 * NOTE: SPEC.md's tree says `public/data/lenders.csv`; the actual file is
 * `public/lender_programs.csv`. This constant is the only place that path appears.
 */
export const CSV_PATH = '/lender_programs.csv';

/** F28: cache-bust so reps never get stale rates after an ops update. */
export function csvUrl(now: Date): string {
  return `${CSV_PATH}?v=${now.getTime()}`;
}

/**
 * F26, F27: rejects on fetch failure, malformed CSV, or zero parsed rows.
 *
 * Every failure path throws with a message the error state can show verbatim — the one
 * thing F27 forbids is resolving with something that renders as a blank screen.
 */
export async function loadPrograms(now: Date): Promise<LenderProgram[]> {
  const response = await fetch(csvUrl(now), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Could not load rate data (${response.status} ${response.statusText}).`);
  }

  const text = (await response.text()).trim();
  if (text === '') {
    throw new Error('The rate data file is empty.');
  }

  // A missing file usually does NOT arrive as a 404: dev servers and most static hosts
  // fall back to index.html with a 200, which would otherwise be parsed as a CSV whose
  // header is HTML and reported as "missing required columns".
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('html') || text.startsWith('<')) {
    throw new Error(`No rate data file found at ${CSV_PATH}.`);
  }

  const parsed = Papa.parse<RawProgramRow>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  // Header first: a dropped or renamed column is the likeliest real failure (ops edits the
  // file by hand), and PapaParse would otherwise report it as a vague field-count mismatch.
  const header = parsed.meta.fields ?? [];
  if (header.length === 0) {
    throw new Error('The rate data file has no header row.');
  }
  if (!hasRequiredColumns(header)) {
    throw new Error('The rate data file is missing required columns.');
  }

  // PapaParse reports damage instead of throwing, and most of it is row-scoped (a row with
  // the wrong field count, a bad quote). Those are rejected row by row below. Only an error
  // with no row — a file-level problem such as an undetectable delimiter — aborts the load.
  const fileError = parsed.errors.find((error) => error.row === undefined);
  if (fileError !== undefined) {
    throw new Error(`The rate data file is malformed: ${fileError.message}`);
  }

  const malformedRows = new Map<number, string>();
  for (const error of parsed.errors) {
    if (error.row !== undefined) malformedRows.set(error.row, error.message);
  }

  if (parsed.data.length === 0) {
    throw new Error('The rate data file contains no programs.');
  }

  // One malformed row must not cost the rep the other 48. Each row is parsed on its own,
  // the bad ones are dropped, and the count is logged. The index still comes from the
  // row's position in the FILE, so a skipped row does not renumber the ids after it —
  // `row-14` keeps naming CSV line 14 whatever else failed.
  const programs: LenderProgram[] = [];
  const rejections: string[] = [];

  parsed.data.forEach((row, index) => {
    const malformed = malformedRows.get(index);
    if (malformed !== undefined) {
      rejections.push(`${malformed} (row ${csvLineNumber(index)})`);
      return;
    }
    try {
      programs.push(parseProgram(row, index));
    } catch (error: unknown) {
      rejections.push(error instanceof Error ? error.message : String(error));
    }
  });

  if (rejections.length > 0) {
    console.warn(
      `[rate data] Rejected ${rejections.length} of ${parsed.data.length} rows:`,
      rejections,
    );
  }

  // F27 still applies when NOTHING survived — that is a blank screen, not partial data.
  if (programs.length === 0) {
    throw new Error(
      `The rate data file contains no usable programs (all ${parsed.data.length} rows were rejected).`,
    );
  }

  return programs;
}
