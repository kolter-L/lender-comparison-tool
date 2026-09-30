import type { JSX } from 'react';
import type { ClassifiedProgram } from '../models/MatchResult';
import type { MatchSortKey } from '../domain/matchPrograms';

/**
 * F8: 0 misses, sorted by rate asc with a toggle to turnaround asc (F18).
 * Top 5 plus 'Show all N'. F14: empty state is a plain message, not a blank area.
 * Presentational — the toggle and expansion state live in ComparisonView.
 */
export interface MatchSectionProps {
  /** Already sorted and capped by the view. */
  visible: ClassifiedProgram[];
  totalCount: number;
  sortKey: MatchSortKey;
  onSortChange: (sortKey: MatchSortKey) => void;
  expanded: boolean;
  onExpand: () => void;
  isStale: (classified: ClassifiedProgram) => boolean;
}

export function MatchSection(props: MatchSectionProps): JSX.Element | null {
  return null;
}
