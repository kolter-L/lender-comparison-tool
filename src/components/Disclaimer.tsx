import type { JSX } from 'react';

import { DISCLAIMER_TEXT } from '../models/enums';

/** F19: non-binding disclaimer, on screen. The same text goes into copied output. */
export function Disclaimer(): JSX.Element {
  return <p className="disclaimer">{DISCLAIMER_TEXT}</p>;
}
