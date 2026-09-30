import type { LenderProgram } from '../models/LenderProgram';

/** F22. `today` is injected — never call Date.now() in here (CLAUDE.md, N8). */

export const STALENESS_THRESHOLD_DAYS = 30;

/** True when program.lastUpdated is more than 30 days before `today`. */
export function evaluateStaleness(program: LenderProgram, today: Date): boolean {
  throw new Error('staleness.evaluateStaleness not implemented');
}

/** F23: the dataset-level 'Rates as of' date — the newest lastUpdated across all rows. */
export function datasetFreshness(programs: LenderProgram[]): Date | null {
  throw new Error('staleness.datasetFreshness not implemented');
}
