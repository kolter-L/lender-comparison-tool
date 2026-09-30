import type { JSX } from 'react';

import type { Blocker } from '../models/MatchResult';

/** F15: shown when Match and Near Miss are both empty. Names the dominant hard failure. */
export interface BlockerHeadlineProps {
  blocker: Blocker;
}

export function BlockerHeadline({ blocker }: BlockerHeadlineProps): JSX.Element {
  return <p className="blocker">{blocker.headline}</p>;
}
