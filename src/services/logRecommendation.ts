import type { BorrowerCriteria } from '../models/BorrowerCriteria';

/** F24: no-op analytics seam for V2. console.debug in V1. */

export type LogAction = 'copy' | 'expand';

export interface RecommendationEvent {
  criteria: BorrowerCriteria;
  programIds: string[];
  action: LogAction;
}

export function logRecommendation(event: RecommendationEvent): void {
  // V2 replaces this body with a real transport. Nothing else changes.
  console.debug('[recommendation]', event);
}
