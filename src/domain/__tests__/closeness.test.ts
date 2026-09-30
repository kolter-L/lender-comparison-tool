import { describe, it } from 'vitest';

import { closenessScore } from '../closeness';

/** F12: weights — years 1.0, tier steps/2 1.0, under-min 0.5, over-max 2.0, type 3.0. */
describe('closenessScore', () => {
  it.todo('scores 0 when the borrower clears every criterion');
  it.todo('weights a business-type mismatch at 3.0');
  it.todo('weights over-max loan at 2.0 of the proportional overage');
  it.todo('weights under-min loan at 0.5 of the proportional shortfall');
  it.todo('halves tier steps short before applying the 1.0 weight');
  it.todo('sums multiple shortfalls');
});
