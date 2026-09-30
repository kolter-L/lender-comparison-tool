import type { BorrowerCriteria } from '../models/BorrowerCriteria';
import type { LenderProgram } from '../models/LenderProgram';
import type { ClassifiedProgram, MissReason, ResultSet } from '../models/MatchResult';

/**
 * F4–F10. The single public entry point of the domain layer: classification,
 * sorting and orchestration. Pure. Called only by views/ComparisonView.tsx.
 */

/** F18: the Match-section sort toggle. Applies to Match only. */
export type MatchSortKey = 'rate' | 'turnaround';

/** F8–F10: every section is capped at 5 rows. */
export const SECTION_CAP = 5;

export function matchPrograms(
  criteria: BorrowerCriteria,
  programs: LenderProgram[],
  sortKey: MatchSortKey,
): ResultSet {
  throw new Error('matchPrograms not implemented');
}

// --- internals (not exported from the module's public surface once implemented) ---

/** F4: max_loan_amount and eligible_business_types. 'Other' matches only rows marked 'All'. */
function hardMisses(criteria: BorrowerCriteria, program: LenderProgram): MissReason[] {
  throw new Error('matchPrograms.hardMisses not implemented');
}

/** F5: min_loan_amount, min_years_in_business, credit_tier_required. */
function softMisses(criteria: BorrowerCriteria, program: LenderProgram): MissReason[] {
  throw new Error('matchPrograms.softMisses not implemented');
}

/** F7: exclusive sections. Match → Near Miss → Closest Available, in that order. */
function classify(criteria: BorrowerCriteria, program: LenderProgram): ClassifiedProgram {
  throw new Error('matchPrograms.classify not implemented');
}

/** F15: names the dominant hard failure when Match and Near Miss are both empty. */
function buildBlocker(
  criteria: BorrowerCriteria,
  programs: LenderProgram[],
): ResultSet['blocker'] {
  throw new Error('matchPrograms.buildBlocker not implemented');
}
