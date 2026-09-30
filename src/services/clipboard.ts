import type { ClassifiedProgram } from '../models/MatchResult';

/** F21: copy the top 3 as plain text. F19's disclaimer is part of the copied text. */

export const COPY_LIMIT = 3;

/** Rate ranges only (F17, never a single figure), plus 'as of' date and the F19 disclaimer. */
export function formatForClipboard(programs: ClassifiedProgram[], asOf: Date): string {
  throw new Error('clipboard.formatForClipboard not implemented');
}

/** N4: needs a secure context (HTTPS or localhost). */
export async function copyToClipboard(text: string): Promise<void> {
  throw new Error('clipboard.copyToClipboard not implemented');
}
