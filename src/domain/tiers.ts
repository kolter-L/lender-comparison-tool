import type { CreditTier } from '../models/enums';

/**
 * F5: credit tier is a floor — Excellent >= Good >= Fair. Pure.
 *
 * 'Excellent' clears every program: it is the top of the order, and no row in the CSV
 * requires it (only 'Fair' and 'Good' occur). So an Excellent borrower never takes a
 * credit-tier soft miss.
 */

/** Higher rank is a stronger tier. */
export function tierRank(tier: CreditTier): number {
  throw new Error('tiers.tierRank not implemented');
}

/** True when the borrower's tier meets or exceeds the program's required tier. */
export function meetsTier(borrowerTier: CreditTier, requiredTier: CreditTier): boolean {
  throw new Error('tiers.meetsTier not implemented');
}

/** How many tier steps the borrower falls short by. 0 when they meet the floor. Feeds F12. */
export function tierStepsShort(borrowerTier: CreditTier, requiredTier: CreditTier): number {
  throw new Error('tiers.tierStepsShort not implemented');
}
