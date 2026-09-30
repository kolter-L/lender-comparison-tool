import type { JSX } from 'react';
/** F27: fetch failure, malformed CSV, or zero parsed rows. Never a silent blank screen. */
export interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState(props: ErrorStateProps): JSX.Element | null {
  return null;
}
