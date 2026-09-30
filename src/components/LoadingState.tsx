import type { JSX } from 'react';

/** F26: explicit loading state during fetch/parse. */
export function LoadingState(): JSX.Element {
  return (
    <p className="state-loading" role="status">
      Loading rate data…
    </p>
  );
}
