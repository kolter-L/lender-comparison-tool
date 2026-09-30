import type { BorrowerCriteria } from '../models/BorrowerCriteria';
import type { LenderProgram } from '../models/LenderProgram';
import type { Blocker, ClassifiedProgram, MissReason, ResultSet } from '../models/MatchResult';
import { ALL_BUSINESS_TYPES } from '../models/enums';
import { closenessScore } from './closeness';
import { meetsTier } from './tiers';

/**
 * F4–F10. The single public entry point of the domain layer: classification,
 * sorting and orchestration. Pure. Called only by views/ComparisonView.tsx.
 */

/** F18: the Match-section sort toggle. Applies to Match only. */
export type MatchSortKey = 'rate' | 'turnaround';

/** F8–F10: every section is capped at 5 rows. */
export const SECTION_CAP = 5;

/** F9: a near miss carries at most this many soft misses. Beyond it, Closest Available. */
const NEAR_MISS_MAX_SOFT = 2;

export function matchPrograms(
  criteria: BorrowerCriteria,
  programs: LenderProgram[],
  sortKey: MatchSortKey,
): ResultSet {
  const matches: ClassifiedProgram[] = [];
  const nearMisses: ClassifiedProgram[] = [];
  const closestAvailable: ClassifiedProgram[] = [];

  // F7: one pass, one destination per row. Exclusivity is structural, not a filter
  // convention that a later edit could break.
  for (const program of programs) {
    const classified = classify(criteria, program);
    const hardCount = classified.misses.filter((m) => m.severity === 'hard').length;
    const softCount = classified.misses.length - hardCount;

    if (hardCount === 0 && softCount === 0) {
      matches.push(classified);
    } else if (hardCount === 0 && softCount <= NEAR_MISS_MAX_SOFT) {
      nearMisses.push(classified);
    } else {
      closestAvailable.push(classified);
    }
  }

  matches.sort(byMatchSort(sortKey));
  nearMisses.sort(byNearMissSort);
  closestAvailable.sort(byCloseness);

  const noLikelyFits = matches.length === 0 && nearMisses.length === 0;

  return {
    matches,
    nearMisses: nearMisses.slice(0, SECTION_CAP),
    nearMissTotal: nearMisses.length,
    closestAvailable: closestAvailable.slice(0, SECTION_CAP),
    closestAvailableTotal: closestAvailable.length,
    blocker: noLikelyFits ? buildBlocker(criteria, programs) : null,
  };
}

// --- classification ---------------------------------------------------------

/** F7: exclusive sections. Match → Near Miss → Closest Available, in that order. */
function classify(criteria: BorrowerCriteria, program: LenderProgram): ClassifiedProgram {
  return {
    program,
    misses: [...hardMisses(criteria, program), ...softMisses(criteria, program)],
    closenessScore: closenessScore(program, criteria),
  };
}

/** F4: max_loan_amount and eligible_business_types. 'Other' matches only rows marked 'All'. */
function hardMisses(criteria: BorrowerCriteria, program: LenderProgram): MissReason[] {
  const misses: MissReason[] = [];

  if (criteria.loanAmount > program.maxLoanAmount) {
    misses.push({
      field: 'maxLoanAmount',
      severity: 'hard',
      text: `Caps at ${money(program.maxLoanAmount)} — borrower needs ${money(criteria.loanAmount)}`,
    });
  }

  if (!servesBusinessType(program, criteria)) {
    misses.push({
      field: 'eligibleBusinessTypes',
      severity: 'hard',
      text: `Serves ${program.eligibleBusinessTypes} only — borrower is ${criteria.businessType}`,
    });
  }

  return misses;
}

/** F5: min_loan_amount, min_years_in_business, credit_tier_required. */
function softMisses(criteria: BorrowerCriteria, program: LenderProgram): MissReason[] {
  const misses: MissReason[] = [];

  if (criteria.loanAmount < program.minLoanAmount) {
    misses.push({
      field: 'minLoanAmount',
      severity: 'soft',
      text: `Minimum is ${money(program.minLoanAmount)} — borrower needs ${money(criteria.loanAmount)}`,
    });
  }

  if (criteria.yearsInBusiness < program.minYearsInBusiness) {
    misses.push({
      field: 'minYearsInBusiness',
      severity: 'soft',
      text: `Needs ${program.minYearsInBusiness} yrs in business — borrower has ${criteria.yearsInBusiness}`,
    });
  }

  if (!meetsTier(criteria.creditTier, program.creditTierRequired)) {
    misses.push({
      field: 'creditTierRequired',
      severity: 'soft',
      text: `Needs ${program.creditTierRequired} credit — borrower is ${criteria.creditTier}`,
    });
  }

  return misses;
}

/**
 * F4. 'All' matches any type. A borrower type of 'Other' never appears in the column, so
 * it falls through to the equality check and matches only 'All' rows — no special case.
 */
function servesBusinessType(program: LenderProgram, criteria: BorrowerCriteria): boolean {
  return (
    program.eligibleBusinessTypes === ALL_BUSINESS_TYPES ||
    program.eligibleBusinessTypes === criteria.businessType
  );
}

// --- sorting ----------------------------------------------------------------

type Comparator = (a: ClassifiedProgram, b: ClassifiedProgram) => number;

/** F8, F18: interest_rate_min asc, toggled to turnaround_days asc. Array.sort is stable. */
function byMatchSort(sortKey: MatchSortKey): Comparator {
  if (sortKey === 'turnaround') {
    return (a, b) => a.program.turnaroundDays - b.program.turnaroundDays;
  }
  return (a, b) => a.program.interestRateMin - b.program.interestRateMin;
}

/** F9: miss count asc, tie-broken by interest_rate_min asc. */
const byNearMissSort: Comparator = (a, b) =>
  a.misses.length - b.misses.length || a.program.interestRateMin - b.program.interestRateMin;

/**
 * F10: closeness score asc. Tie-broken by interest_rate_min asc — exact ties are common
 * here (every business-type-only mismatch scores exactly 3.0), so without a tie-break the
 * order would depend on CSV row order.
 */
const byCloseness: Comparator = (a, b) =>
  a.closenessScore - b.closenessScore || a.program.interestRateMin - b.program.interestRateMin;

// --- F15 blocker ------------------------------------------------------------

/**
 * F15: names the dominant hard failure when Match and Near Miss are both empty.
 *
 * Loan amount is checked first because it is the sharper answer — it names a number the
 * rep can take back to the borrower. Both branches fire only on a network-wide failure,
 * so the headline is never contradicted by a row in Closest Available.
 */
function buildBlocker(criteria: BorrowerCriteria, programs: LenderProgram[]): Blocker | null {
  if (programs.length === 0) return null;

  const networkMax = Math.max(...programs.map((p) => p.maxLoanAmount));
  if (criteria.loanAmount > networkMax) {
    return {
      headline: `No programs cover ${money(criteria.loanAmount)} — the highest in our network is ${money(networkMax)}`,
    };
  }

  if (!programs.some((p) => servesBusinessType(p, criteria))) {
    // Reached only when no row is marked 'All', so an 'Other' borrower gets its own wording.
    if (criteria.businessType === 'Other') {
      return {
        headline: `No programs are open to all business types, so none can cover "Other"`,
      };
    }
    return {
      headline: `No programs serve ${criteria.businessType} businesses — none of the ${programs.length} programs in our network are open to it`,
    };
  }

  return { headline: 'No likely fits for these criteria — the closest available programs are below' };
}

// --- formatting -------------------------------------------------------------

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function money(amount: number): string {
  return MONEY.format(amount);
}
