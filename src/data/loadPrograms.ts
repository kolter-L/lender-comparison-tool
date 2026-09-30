import type { LenderProgram } from '../models/LenderProgram';

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
  throw new Error('loadPrograms.csvUrl not implemented');
}

/** F26, F27: rejects on fetch failure, malformed CSV, or zero parsed rows. */
export async function loadPrograms(now: Date): Promise<LenderProgram[]> {
  throw new Error('loadPrograms not implemented');
}
