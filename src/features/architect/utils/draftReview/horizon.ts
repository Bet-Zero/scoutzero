/** Exact owner exception, independently qualified in PR582 comment6404582411.
 * Team-published explanation; never a league memorandum or ownership proof.
 */
export const QUALIFIED_JUNE5_DRAFT_HORIZON = Object.freeze({
  id: 'bze329-seven-upcoming-drafts-20260605',
  asOf: '2026-06-05T12:19:56.526Z',
  firstFutureDraftYear: 2026,
  lastTradableDraftYear: 2032,
  firstRoundDate: '2026-06-23',
  secondRoundDate: '2026-06-24',
  explanationSha256:
    '3a937d68aaeffc633c25f3e4fb5e09a3c74dcb577046ff01fc27923224cc14a6',
  calendarSha256:
    'fe7355ff1e8f3000977369bf9d540e8b0978aad35a5b072f4af53c7e11b05d5c',
  acceptance:
    'https://github.com/Bet-Zero/scoutzero/pull/582#issuecomment-6404582411',
});

/** Trading availability is separate from Stepien's retained-rights test. */
export function reviewJune5DraftTradingWindow(asOf: string, years: number[]) {
  const scope = QUALIFIED_JUNE5_DRAFT_HORIZON;
  if (
    asOf !== scope.asOf ||
    !years.length ||
    years.some((y) => !Number.isInteger(y))
  )
    return {
      status: 'needs-input' as const,
      reason: 'qualified-dated-draft-window-required',
    };
  const outside = years.filter(
    (y) => y < scope.firstFutureDraftYear || y > scope.lastTradableDraftYear
  );
  return outside.length
    ? {
        status: 'prohibits' as const,
        reason: `outside-seven-upcoming-draft-window:${outside.join(',')}`,
      }
    : { status: 'permits' as const, reason: null };
}
