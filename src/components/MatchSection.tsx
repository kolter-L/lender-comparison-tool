import type { JSX } from 'react';

import type { MatchSortKey } from '../domain/matchPrograms';
import type { ClassifiedProgram } from '../models/MatchResult';
import { ProgramRow, ProgramTableHead } from './ProgramRow';

/**
 * F8: 0 misses, sorted by rate asc with a toggle to turnaround asc (F18).
 * Top 5 plus 'Show all N'. F14: empty state is a plain message, not a blank area.
 * Presentational — the toggle and expansion state live in ComparisonView.
 *
 * F20: the heading says "Likely fits" — never qualified / approved / eligible.
 */

const SORT_LABELS: Record<MatchSortKey, string> = {
  rate: 'Lowest starting rate',
  turnaround: 'Fastest turnaround',
};

export interface MatchSectionProps {
  /** Already sorted and capped by the view. */
  visible: ClassifiedProgram[];
  totalCount: number;
  sortKey: MatchSortKey;
  onSortChange: (sortKey: MatchSortKey) => void;
  expanded: boolean;
  onExpand: () => void;
  isStale: (classified: ClassifiedProgram) => boolean;
  /** F21: copies the top 3. Hidden when there is nothing to copy. */
  onCopy: () => void;
  copyNotice: string | null;
}

export function MatchSection({
  visible,
  totalCount,
  sortKey,
  onSortChange,
  expanded,
  onExpand,
  isStale,
  onCopy,
  copyNotice,
}: MatchSectionProps): JSX.Element {
  return (
    <section className="section">
      <header className="section-head">
        <h2>
          Likely fits{totalCount > 0 && <span className="count">{totalCount}</span>}
        </h2>

        {totalCount > 0 && (
          <div className="section-controls">
            <div className="sort-toggle" role="group" aria-label="Sort likely fits">
              {(Object.keys(SORT_LABELS) as MatchSortKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={key === sortKey ? 'is-active' : undefined}
                  aria-pressed={key === sortKey}
                  onClick={() => onSortChange(key)}
                >
                  {SORT_LABELS[key]}
                </button>
              ))}
            </div>
            <button type="button" className="copy" onClick={onCopy}>
              Copy top 3
            </button>
            {copyNotice !== null && <span className="copy-notice">{copyNotice}</span>}
          </div>
        )}
      </header>

      {/* F14: a plain message, never a blank area. Closest Available carries the answer. */}
      {totalCount === 0 ? (
        <p className="empty">
          No programs match every criterion. See the sections below for the nearest options.
        </p>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <ProgramTableHead />
              <tbody>
                {visible.map((classified) => (
                  <ProgramRow
                    key={classified.program.id}
                    classified={classified}
                    isStale={isStale(classified)}
                    showMisses={false}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {totalCount > visible.length && (
            <button type="button" className="expand" onClick={onExpand}>
              Show all {totalCount}
            </button>
          )}
          {expanded && totalCount > 0 && (
            <p className="section-note">Showing all {totalCount}.</p>
          )}
        </>
      )}
    </section>
  );
}
