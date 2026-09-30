import type { JSX, ReactNode } from 'react';

import { BUSINESS_TYPES, CREDIT_TIERS } from '../models/enums';

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
  onSubmit: () => void;
  errors: CriteriaErrors;
  disabled: boolean;
}

export interface CriteriaDraft {
  loanAmount: string;
  businessType: string;
  yearsInBusiness: string;
  creditTier: string;
}

export type CriteriaErrors = Partial<Record<keyof CriteriaDraft, string>>;

export function CriteriaForm({
  draft,
  onChange,
  onSubmit,
  errors,
  disabled,
}: CriteriaFormProps): JSX.Element {
  const set = (field: keyof CriteriaDraft, value: string) =>
    onChange({ ...draft, [field]: value });

  return (
    <form
      className="criteria"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      noValidate
    >
      <Field label="Loan amount" htmlFor="loanAmount" error={errors.loanAmount}>
        <div className="input-money">
          <span className="prefix" aria-hidden="true">
            $
          </span>
          <input
            id="loanAmount"
            name="loanAmount"
            // Not type="number": that would defeat the thousands separators F2 asks for.
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="250,000"
            value={draft.loanAmount}
            aria-invalid={errors.loanAmount !== undefined}
            onChange={(event) => set('loanAmount', event.target.value)}
          />
        </div>
      </Field>

      <Field label="Business type" htmlFor="businessType" error={errors.businessType}>
        <select
          id="businessType"
          name="businessType"
          value={draft.businessType}
          aria-invalid={errors.businessType !== undefined}
          onChange={(event) => set('businessType', event.target.value)}
        >
          <option value="">Select…</option>
          {BUSINESS_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Years in business" htmlFor="yearsInBusiness" error={errors.yearsInBusiness}>
        <input
          id="yearsInBusiness"
          name="yearsInBusiness"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="2"
          value={draft.yearsInBusiness}
          aria-invalid={errors.yearsInBusiness !== undefined}
          onChange={(event) => set('yearsInBusiness', event.target.value)}
        />
      </Field>

      <Field label="Credit tier" htmlFor="creditTier" error={errors.creditTier}>
        <select
          id="creditTier"
          name="creditTier"
          value={draft.creditTier}
          aria-invalid={errors.creditTier !== undefined}
          onChange={(event) => set('creditTier', event.target.value)}
        >
          <option value="">Select…</option>
          {CREDIT_TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </select>
      </Field>

      <button type="submit" className="primary" disabled={disabled}>
        Find programs
      </button>
    </form>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error: string | undefined;
  children: ReactNode;
}

function Field({ label, htmlFor, error, children }: FieldProps): JSX.Element {
  return (
    <div className={error === undefined ? 'field' : 'field field-invalid'}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error !== undefined && <p className="field-error">{error}</p>}
    </div>
  );
}
