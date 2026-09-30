import type { CreditTier } from '../models/enums';

/**
 * F5: credit tier is a floor — Excellent >= Good >= Fair. Pure.
 *
 * 'Excellent' clears every program: it is the top of the order, and no row in the CSV
 * requires it (only 'Fair' and 'Good' occur). So an Excellent borrower never takes a
 * credit-tier soft miss.
 */

const RANK: Record<CreditTier, number> = {
  Excellent: 3,
  Good: 2,
  Fair: 1,
};

/** Higher rank is a stronger tier. */
export function tierRank(tier: CreditTier): number {
  return RANK[tier];
}

/** True when the borrower's tier meets or exceeds the program's required tier. */
export function meetsTier(borrowerTier: CreditTier, requiredTier: CreditTier): boolean {
  return tierRank(borrowerTier) >= tierRank(requiredTier);
}

/** How many tier steps the borrower falls short by. 0 when they meet the floor. Feeds F12. */
export function tierStepsShort(borrowerTier: CreditTier, requiredTier: CreditTier): number {
  return Math.max(0, tierRank(requiredTier) - tierRank(borrowerTier));
}
