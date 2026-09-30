import type { JSX } from 'react';

import type { ClassifiedProgram } from '../models/MatchResult';
import { ProgramRow, ProgramTableHead } from './ProgramRow';

/** F9: 0 hard, 1–2 soft misses. Miss count asc, tie-broken by interestRateMin asc. Top 5. */
export interface NearMissSectionProps {
  visible: ClassifiedProgram[];
  totalCount: number;
  isStale: (classified: ClassifiedProgram) => boolean;
}

export function NearMissSection({
  visible,
  totalCount,
  isStale,
}: NearMissSectionProps): JSX.Element | null {
  if (totalCount === 0) return null;

  return (
    <section className="section">
      <header className="section-head">
        <h2>
          Close, with gaps<span className="count">{totalCount}</span>
        </h2>
        <p className="section-sub">One or two criteria short. The gap is named on each row.</p>
      </header>

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
    </section>
  );
}
