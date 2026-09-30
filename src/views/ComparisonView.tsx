import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ClosestAvailableSection } from '../components/ClosestAvailableSection';
import { CriteriaForm } from '../components/CriteriaForm';
import type { CriteriaDraft, CriteriaErrors } from '../components/CriteriaForm';
import { DataFreshnessHeader } from '../components/DataFreshnessHeader';
import { Disclaimer } from '../components/Disclaimer';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { MatchSection } from '../components/MatchSection';
import { NearMissSection } from '../components/NearMissSection';
import { loadPrograms } from '../data/loadPrograms';
import type { MatchSortKey } from '../domain/matchPrograms';
import { SECTION_CAP, matchPrograms } from '../domain/matchPrograms';
import { datasetFreshness, evaluateStaleness } from '../domain/staleness';
import type { BorrowerCriteria } from '../models/BorrowerCriteria';
import type { ClassifiedProgram } from '../models/MatchResult';
import type { BusinessType, CreditTier } from '../models/enums';
import type { LenderProgram } from '../models/LenderProgram';
import { BUSINESS_TYPES, CREDIT_TIERS } from '../models/enums';
import { copyToClipboard, formatForClipboard } from '../services/clipboard';
import { groupDigits } from '../services/format';
import { logRecommendation } from '../services/logRecommendation';

/**
 * The one screen: form + three sections.
 *
 * This file owns ALL useState and is the only caller of matchPrograms (CLAUDE.md).
 * It also owns `today` — the single place a clock is read, passed down into the
 * pure domain functions that need it (N8).
 */

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; programs: LenderProgram[] }
  | { status: 'error'; message: string };

const EMPTY_DRAFT: CriteriaDraft = {
  loanAmount: '',
  businessType: '',
  yearsInBusiness: '',
  creditTier: '',
};

export function ComparisonView(): JSX.Element {
  // One clock read per session, injected into every date-aware call (N8).
  const [today] = useState(() => new Date());

  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [draft, setDraft] = useState<CriteriaDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<CriteriaErrors>({});
  const [criteria, setCriteria] = useState<BorrowerCriteria | null>(null);
  const [sortKey, setSortKey] = useState<MatchSortKey>('rate');
  const [matchExpanded, setMatchExpanded] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  // F25–F28. Re-runs when the rep retries after an error.
  useEffect(() => {
    let cancelled = false;
    setLoad({ status: 'loading' });

    loadPrograms(today)
      .then((programs) => {
        if (!cancelled) setLoad({ status: 'ready', programs });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [today, reloadKey]);

  const programs = load.status === 'ready' ? load.programs : [];

  // F23. Dataset-level date, not per row.
  const asOf = useMemo(() => datasetFreshness(programs), [programs]);

  // The only call to matchPrograms in the app.
  const results = useMemo(
    () => (criteria === null ? null : matchPrograms(criteria, programs, sortKey)),
    [criteria, programs, sortKey],
  );

  // F22. The view holds the clock; the components receive a boolean.
  const isStale = useCallback(
    (classified: ClassifiedProgram) => evaluateStaleness(classified.program, today),
    [today],
  );

  const handleDraftChange = (next: CriteriaDraft) => {
    setDraft({
      // F2: thousands separators as typed. Stripping non-digits also makes a negative or
      // decimal amount unenterable, leaving blank and zero as the cases to validate.
      loanAmount: groupDigits(digitsOnly(next.loanAmount, MAX_AMOUNT_DIGITS)),
      businessType: next.businessType,
      yearsInBusiness: digitsOnly(next.yearsInBusiness, MAX_YEARS_DIGITS),
      creditTier: next.creditTier,
    });
  };

  const handleSubmit = () => {
    const { criteria: parsed, errors: found } = validateDraft(draft);
    setErrors(found);
    if (parsed === null) {
      // Deliberately keeps any results already on screen. A rep mid-call who mistypes the
      // loan amount should get the error without losing the table they were reading from.
      return;
    }
    setCriteria(parsed);
    setMatchExpanded(false);
    setCopyNotice(null);
  };

  const handleExpand = () => {
    setMatchExpanded(true);
    // F24: fires on expand.
    if (criteria !== null && results !== null) {
      logRecommendation({
        criteria,
        programIds: results.matches.map((c) => c.program.id),
        action: 'expand',
      });
    }
  };

  const handleCopy = async () => {
    if (criteria === null || results === null || asOf === null) return;
    const top = results.matches.slice(0, 3);

    try {
      await copyToClipboard(formatForClipboard(top, asOf));
      setCopyNotice(`Copied top ${top.length}`);
      // F24: fires on copy.
      logRecommendation({
        criteria,
        programIds: top.map((c) => c.program.id),
        action: 'copy',
      });
    } catch (error: unknown) {
      setCopyNotice(error instanceof Error ? error.message : 'Could not copy.');
    }
  };

  return (
    <main>
      <header className="app-head">
        <h1>Lender comparison</h1>
        <DataFreshnessHeader asOf={asOf} />
      </header>

      <CriteriaForm
        draft={draft}
        onChange={handleDraftChange}
        onSubmit={handleSubmit}
        errors={errors}
        disabled={load.status !== 'ready'}
      />

      <Disclaimer />

      {load.status === 'loading' && <LoadingState />}
      {load.status === 'error' && (
        <ErrorState message={load.message} onRetry={() => setReloadKey((key) => key + 1)} />
      )}

      {load.status === 'ready' && results === null && (
        <p className="empty">Enter the borrower's details to see programs.</p>
      )}

      {load.status === 'ready' && results !== null && (
        <>
          <MatchSection
            visible={matchExpanded ? results.matches : results.matches.slice(0, SECTION_CAP)}
            totalCount={results.matches.length}
            sortKey={sortKey}
            onSortChange={setSortKey}
            expanded={matchExpanded}
            onExpand={handleExpand}
            isStale={isStale}
            onCopy={() => void handleCopy()}
            copyNotice={copyNotice}
          />
          <NearMissSection
            visible={results.nearMisses}
            totalCount={results.nearMissTotal}
            isStale={isStale}
          />
          <ClosestAvailableSection
            visible={results.closestAvailable}
            totalCount={results.closestAvailableTotal}
            blocker={results.blocker}
            isStale={isStale}
          />
          <Disclaimer />
        </>
      )}
    </main>
  );
}

// --- input handling ---------------------------------------------------------

/** Guards Number() precision rather than imposing a business maximum — F2 has no upper bound. */
const MAX_AMOUNT_DIGITS = 12;
const MAX_YEARS_DIGITS = 3;

function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

function validateDraft(draft: CriteriaDraft): {
  criteria: BorrowerCriteria | null;
  errors: CriteriaErrors;
} {
  const errors: CriteriaErrors = {};

  const amountDigits = draft.loanAmount.replace(/\D/g, '');
  const loanAmount = Number(amountDigits);
  if (amountDigits === '') {
    errors.loanAmount = 'Enter a loan amount.';
  } else if (loanAmount <= 0) {
    errors.loanAmount = 'Loan amount must be greater than zero.';
  }

  const businessType = BUSINESS_TYPES.find((t): t is BusinessType => t === draft.businessType);
  if (businessType === undefined) {
    errors.businessType = 'Select a business type.';
  }

  const yearsDigits = draft.yearsInBusiness;
  const yearsInBusiness = Number(yearsDigits);
  if (yearsDigits === '') {
    errors.yearsInBusiness = 'Enter years in business (0 is allowed).';
  }

  const creditTier = CREDIT_TIERS.find((t): t is CreditTier => t === draft.creditTier);
  if (creditTier === undefined) {
    errors.creditTier = 'Select a credit tier.';
  }

  if (
    Object.keys(errors).length > 0 ||
    businessType === undefined ||
    creditTier === undefined
  ) {
    return { criteria: null, errors };
  }

  return { criteria: { loanAmount, businessType, yearsInBusiness, creditTier }, errors };
}
