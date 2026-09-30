import type { JSX } from 'react';
import type { ClassifiedProgram } from '../models/MatchResult';

/** F9: 0 hard, 1–2 soft misses. Miss count asc, tie-broken by interestRateMin asc. Top 5. */
export interface NearMissSectionProps {
  visible: ClassifiedProgram[];
  totalCount: number;
  isStale: (classified: ClassifiedProgram) => boolean;
}

export function NearMissSection(props: NearMissSectionProps): JSX.Element | null {
  return null;
}
