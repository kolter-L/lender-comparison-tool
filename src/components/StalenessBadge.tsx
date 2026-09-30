import type { JSX } from 'react';
/** F22: shown per row when last_updated is more than 30 days before the system date. */
export interface StalenessBadgeProps {
  lastUpdated: Date;
  isStale: boolean;
}

export function StalenessBadge(props: StalenessBadgeProps): JSX.Element | null {
  return null;
}
