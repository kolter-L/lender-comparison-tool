import type { JSX } from 'react';

/** F27: fetch failure, malformed CSV, or zero parsed rows. Never a silent blank screen. */
export interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps): JSX.Element {
  return (
    <div className="state-error" role="alert">
      <p className="state-error-title">Rate data could not be loaded</p>
      <p className="state-error-detail">{message}</p>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
