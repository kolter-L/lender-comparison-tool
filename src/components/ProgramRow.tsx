import type { JSX } from 'react';

import type { ClassifiedProgram } from '../models/MatchResult';
import { days, percent, rateRange, termMonths } from '../services/format';
import { MissChip } from './MissChip';
import { StalenessBadge } from './StalenessBadge';

/**
 * F16, F17: one aligned row — lender, program type, rate RANGE (never a single figure),
 * max term, SBA guarantee %, turnaround days, collateral, special requirements, last_updated.
 *
 * A real <table> does the aligning, so every section compares column-for-column for free.
 * Special requirements and miss chips go in a full-width second row rather than a cramped
 * column, which keeps the comparable numbers aligned.
 */

const COLUMNS = [
  'Lender',
  'Rate range',
  'Max term',
  'SBA guarantee',
  'Turnaround',
  'Collateral',
  'Updated',
] as const;

export function ProgramTableHead(): JSX.Element {
  return (
    <thead>
      <tr>
        {COLUMNS.map((column) => (
          <th key={column} scope="col">
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export interface ProgramRowProps {
  classified: ClassifiedProgram;
  /** F22. Computed by the view via domain/staleness.ts — this component owns no clock. */
  isStale: boolean;
  /** F13. Misses render only in Near Miss and Closest Available. */
  showMisses: boolean;
}

export function ProgramRow({ classified, isStale, showMisses }: ProgramRowProps): JSX.Element {
  const { program, misses } = classified;
  const chips = showMisses ? misses : [];
  const hasSubRow = chips.length > 0 || program.specialRequirements !== null;

  return (
    <>
      <tr className={hasSubRow ? 'row row-has-sub' : 'row'}>
        <th scope="row" className="cell-lender">
          <span className="lender-name">{program.lenderName}</span>
          <span className="lender-program">{program.programType}</span>
        </th>
        <td className="num">{rateRange(program)}</td>
        <td className="num">{termMonths(program.maxTermMonths)}</td>
        <td className="num">{percent(program.sbaGuaranteePct)}</td>
        <td className="num">{days(program.turnaroundDays)}</td>
        <td>{program.requiresCollateral}</td>
        <td className="cell-updated">
          {/* F17's last_updated and F22's staleness flag are one cell — see StalenessBadge. */}
          <StalenessBadge lastUpdated={program.lastUpdated} isStale={isStale} />
        </td>
      </tr>
      {hasSubRow && (
        <tr className="sub">
          <td colSpan={COLUMNS.length}>
            {chips.length > 0 && (
              <span className="chips">
                {chips.map((miss) => (
                  <MissChip key={miss.field} miss={miss} />
                ))}
              </span>
            )}
            {program.specialRequirements !== null && (
              <span className="requirements">{program.specialRequirements}</span>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
