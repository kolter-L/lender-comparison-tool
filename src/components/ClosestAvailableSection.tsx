import type { JSX } from 'react';
import type { Blocker, ClassifiedProgram } from '../models/MatchResult';

/** F10, F11, F15: always shown, closeness score asc, hard cap 5. Carries the answer (F14). */
export interface ClosestAvailableSectionProps {
  visible: ClassifiedProgram[];
  totalCount: number;
  /** F15. Non-null only when Match and Near Miss are both empty. */
  blocker: Blocker | null;
  isStale: (classified: ClassifiedProgram) => boolean;
}

export function ClosestAvailableSection(
  props: ClosestAvailableSectionProps,
): JSX.Element | null {
  return null;
}
