import type { JSX } from 'react';

import type { Blocker, ClassifiedProgram } from '../models/MatchResult';
import { BlockerHeadline } from './BlockerHeadline';
import { ProgramRow, ProgramTableHead } from './ProgramRow';

/** F10, F11, F15: always shown, closeness score asc, hard cap 5. Carries the answer (F14). */
export interface ClosestAvailableSectionProps {
  visible: ClassifiedProgram[];
  totalCount: number;
  /** F15. Non-null only when Match and Near Miss are both empty. */
  blocker: Blocker | null;
  isStale: (classified: ClassifiedProgram) => boolean;
}

export function ClosestAvailableSection({
  visible,
  totalCount,
  blocker,
  isStale,
}: ClosestAvailableSectionProps): JSX.Element {
  return (
    <section className="section">
      <header className="section-head">
        <h2>
          Closest available{totalCount > 0 && <span className="count">{totalCount}</span>}
        </h2>
        {blocker !== null && <BlockerHeadline blocker={blocker} />}
      </header>

      {/* F11: always shown. Empty only when the dataset itself has no rows left. */}
      {visible.length === 0 ? (
        <p className="empty">No other programs in the network to show.</p>
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
                    showMisses
                  />
                ))}
              </tbody>
            </table>
          </div>

          {totalCount > visible.length && (
            <p className="section-note">
              Showing the {visible.length} closest of {totalCount}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
