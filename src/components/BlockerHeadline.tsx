import type { JSX } from 'react';
import type { Blocker } from '../models/MatchResult';

/** F15: shown when Match and Near Miss are both empty. Names the dominant hard failure. */
export interface BlockerHeadlineProps {
  blocker: Blocker;
}

export function BlockerHeadline(props: BlockerHeadlineProps): JSX.Element | null {
  return null;
}
