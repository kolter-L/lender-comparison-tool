import type { JSX } from 'react';
import type { ClassifiedProgram } from '../models/MatchResult';

/**
 * F16, F17: one aligned row — lender, program type, rate RANGE (never a single figure),
 * max term, SBA guarantee %, turnaround days, collateral, special requirements, last_updated.
 */
export interface ProgramRowProps {
  classified: ClassifiedProgram;
  /** F22. Computed by the view via domain/staleness.ts — this component owns no clock. */
  isStale: boolean;
  /** F13. Misses render only in Near Miss and Closest Available. */
  showMisses: boolean;
}

export function ProgramRow(props: ProgramRowProps): JSX.Element | null {
  return null;
}
