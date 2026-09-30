import type { JSX } from 'react';

import type { MissReason } from '../models/MatchResult';

/** F13: red chip, inline text, no tooltip. The chip is red; the card is not. */
export interface MissChipProps {
  miss: MissReason;
}

export function MissChip({ miss }: MissChipProps): JSX.Element {
  return (
    <span className="chip-miss">
      <span aria-hidden="true">⚠</span> {miss.text}
    </span>
  );
}
