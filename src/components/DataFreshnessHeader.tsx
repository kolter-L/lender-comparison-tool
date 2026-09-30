import type { JSX } from 'react';

import { shortDate } from '../services/format';

/** F23: 'Rates as of 2/8/2026'. */
export interface DataFreshnessHeaderProps {
  asOf: Date | null;
}

export function DataFreshnessHeader({ asOf }: DataFreshnessHeaderProps): JSX.Element | null {
  if (asOf === null) return null;
  return <p className="freshness">Rates as of {shortDate(asOf)}</p>;
}
