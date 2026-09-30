import type { LenderProgram } from './LenderProgram';
import type { MissField, MissSeverity } from './enums';

/** F13: one red inline chip. `text` is the full chip copy, no tooltip. */
export interface MissReason {
  field: MissField;
  severity: MissSeverity;
  /** e.g. 'Needs 2 yrs in business — borrower has 1' */
  text: string;
}

/** A program plus why it landed where it did (F7). */
export interface ClassifiedProgram {
  program: LenderProgram;
  misses: MissReason[];
  /** F12. Only meaningful for Closest Available; 0 elsewhere. */
  closenessScore: number;
}

/** F15: named dominant hard failure, shown when Match and Near Miss are both empty. */
export interface Blocker {
  headline: string;
}

/** F7: exclusive sections — every program appears in exactly one array. */
export interface ResultSet {
  /** F8: 0 misses. */
  matches: ClassifiedProgram[];
  /** F9: 0 hard, 1–2 soft misses. */
  nearMisses: ClassifiedProgram[];
  /** F10, F11: everything else, capped at 5. */
  closestAvailable: ClassifiedProgram[];
  /** F15. Present only when matches and nearMisses are both empty. */
  blocker: Blocker | null;
}
