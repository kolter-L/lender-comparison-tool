import type { BusinessType, CreditTier } from './enums';

/** F1: the four rep inputs, after validation (F2, F3). */
export interface BorrowerCriteria {
  /** Plain dollars. Positive integer (F2). */
  loanAmount: number;
  businessType: BusinessType;
  /** Non-negative integer (F3). */
  yearsInBusiness: number;
  creditTier: CreditTier;
}
