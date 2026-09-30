import type { LenderProgram } from './LenderProgram';
import type { MissField, MissSeverity } from './enums';

/** F13: one red inline chip. `text` is the full chip copy, no tooltip. */
export interface MissReason {
  field: MissField;
  severity: MissSeverity;
  /** e.g. 'Needs 2 yrs in business — borrower has 1'. The ⚠ glyph is the component's. */
  text: string;
}

/** A program plus why it landed where it did (F7). */
export interface ClassifiedProgram {
  program: LenderProgram;
  misses: MissReason[];
  /** F12. Always computed; 0 for Match rows by construction. Sorts Closest Available (F10). */
  closenessScore: number;
}

/** F15: named dominant hard failure, shown when Match and Near Miss are both empty. */
export interface Blocker {
  headline: string;
}

/**
 * F7: exclusive sections — every program appears in exactly one array.
 *
 * `matches` is the FULL sorted list because F8 offers "Show all N"; the view slices it to
 * SECTION_CAP until expanded. `nearMisses` and `closestAvailable` have no expansion, so
 * the domain caps them (F9, F10, F11) and reports what was withheld via their totals.
 */
export interface ResultSet {
  /** F8: 0 misses. Full sorted list, not capped. */
  matches: ClassifiedProgram[];
  /** F9: 0 hard, 1–2 soft misses. Capped at SECTION_CAP. */
  nearMisses: ClassifiedProgram[];
  /** How many rows qualified as near misses before the cap. */
  nearMissTotal: number;
  /** F10, F11: everything else. Capped at SECTION_CAP. */
  closestAvailable: ClassifiedProgram[];
  /** How many rows landed in Closest Available before the cap. */
  closestAvailableTotal: number;
  /** F15. Present only when matches and nearMisses are both empty. */
  blocker: Blocker | null;
}
