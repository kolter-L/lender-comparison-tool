import type { JSX } from 'react';

import { BlockerHeadline } from '../components/BlockerHeadline';
import { ClosestAvailableSection } from '../components/ClosestAvailableSection';
import { CriteriaForm } from '../components/CriteriaForm';
import { DataFreshnessHeader } from '../components/DataFreshnessHeader';
import { Disclaimer } from '../components/Disclaimer';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { MatchSection } from '../components/MatchSection';
import { NearMissSection } from '../components/NearMissSection';
import { loadPrograms } from '../data/loadPrograms';
import { matchPrograms } from '../domain/matchPrograms';
import { datasetFreshness, evaluateStaleness } from '../domain/staleness';
import { copyToClipboard, formatForClipboard } from '../services/clipboard';
import { logRecommendation } from '../services/logRecommendation';

/**
 * The one screen: form + three sections.
 *
 * This file owns ALL useState and is the only caller of matchPrograms (CLAUDE.md).
 * It also owns `today` — the single place a clock is read, passed down into the
 * pure domain functions that need it (N8).
 */
export function ComparisonView(): JSX.Element | null {
  // TODO: state — programs, loadStatus, loadError, draft, criteria, sortKey, matchExpanded
  // TODO: effect — loadPrograms(new Date()) on mount (F25–F28)
  // TODO: derive — matchPrograms(criteria, programs, sortKey) when criteria is set
  // TODO: handlers — onSubmit, onSortChange, onExpand (F24), onCopy (F21, F24)
  return null;
}
