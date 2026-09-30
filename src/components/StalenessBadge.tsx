import type { JSX } from 'react';

import { STALENESS_THRESHOLD_DAYS } from '../domain/staleness';
import { shortDate } from '../services/format';

/**
 * F22: flags a row whose last_updated is more than 30 days before the system date.
 *
 * This owns the whole "Updated" cell rather than just the warning, so that the date is
 * rendered exactly once. ProgramRow used to print the date and then place a bare
 * "30+ days old" pill under it; folding both in here lets the badge state the date it is
 * complaining about, and keeps last_updated on every row for F17 whether stale or not.
 */
export interface StalenessBadgeProps {
  lastUpdated: Date;
  isStale: boolean;
}

export function StalenessBadge({ lastUpdated, isStale }: StalenessBadgeProps): JSX.Element {
  const updatedOn = shortDate(lastUpdated);

  if (!isStale) {
    return <span className="updated-on">{updatedOn}</span>;
  }

  return (
    <span className="badge-stale" title={`Not updated in over ${STALENESS_THRESHOLD_DAYS} days`}>
      <span className="badge-date">{updatedOn}</span>
      <span className="badge-age">{STALENESS_THRESHOLD_DAYS}+ days old</span>
    </span>
  );
}
