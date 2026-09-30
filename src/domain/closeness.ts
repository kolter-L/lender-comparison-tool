import type { BorrowerCriteria } from '../models/BorrowerCriteria';
import type { LenderProgram } from '../models/LenderProgram';

/**
 * F12: weighted closeness score, used to sort Closest Available only (F10).
 * Lower is closer. Pure — no clock, no DOM.
 *
 * years short          (req − actual) / req    × 1.0
 * tier steps short     steps / 2               × 1.0
 * under min loan       (req − reqd) / req      × 0.5
 * over max loan        (reqd − max) / max      × 2.0
 * business mismatch    1                       × 3.0
 */
export const CLOSENESS_WEIGHTS = {
  yearsShort: 1.0,
  tierStepsShort: 1.0,
  underMinLoan: 0.5,
  overMaxLoan: 2.0,
  businessTypeMismatch: 3.0,
} as const;

export function closenessScore(program: LenderProgram, criteria: BorrowerCriteria): number {
  throw new Error('closeness.closenessScore not implemented');
}
