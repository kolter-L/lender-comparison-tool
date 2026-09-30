import { describe, it } from 'vitest';

import { matchPrograms } from '../matchPrograms';

describe('matchPrograms', () => {
  /** F7 */
  it.todo('places every program in exactly one section');
  /** F4 */
  it.todo('treats max_loan_amount and business type as hard criteria');
  it.todo("matches 'Other' only against rows marked All");
  /** F5 */
  it.todo('treats credit tier as a floor: Excellent >= Good >= Fair');
  /** F6 */
  it.todo('never filters on min_credit_score, debt ratio, collateral or special requirements');
  /** F8, F18 */
  it.todo('sorts Match by interest_rate_min asc, or turnaround_days asc when toggled');
  /** F9 */
  it.todo('sorts Near Miss by miss count asc, tie-broken by interest_rate_min asc');
  /** F10, F11 */
  it.todo('always populates Closest Available and caps it at 5');
  /** F15 */
  it.todo('returns a blocker headline when Match and Near Miss are both empty');
});
