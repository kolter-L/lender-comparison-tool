import type { JSX } from 'react';
import type { BorrowerCriteria } from '../models/BorrowerCriteria';

/**
 * F1–F3: loan amount (plain dollars, positive integer, thousands separators as typed),
 * business type (the 6 types present in the CSV + 'Other'), years in business
 * (non-negative integer), credit tier. Presentational — the view owns the state.
 *
 * Loan amount has NO upper bound. Reject only blank, zero, negative and non-numeric (F2).
 * An amount above every program's max_loan_amount is a valid entry that produces the F15
 * blocker headline — it is not an input error.
 */
export interface CriteriaFormProps {
  /** Raw field text, so invalid input can be shown back as typed (F2). */
  draft: CriteriaDraft;
  onChange: (draft: CriteriaDraft) => void;
  onSubmit: (criteria: BorrowerCriteria) => void;
  errors: CriteriaErrors;
}

export interface CriteriaDraft {
  loanAmount: string;
  businessType: string;
  yearsInBusiness: string;
  creditTier: string;
}

export type CriteriaErrors = Partial<Record<keyof CriteriaDraft, string>>;

export function CriteriaForm(props: CriteriaFormProps): JSX.Element | null {
  return null;
}
