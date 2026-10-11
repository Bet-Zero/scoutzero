import React from 'react';
import { useRealDraftReview, type DraftReviewTeam } from './useRealDraftReview';

export function RealDraftReviewPanel({
  teams,
  asOfDate,
  worldId,
}: {
  teams: DraftReviewTeam[];
  asOfDate: string | null;
  worldId: string | null;
}) {
  const state = useRealDraftReview(teams, asOfDate, worldId);
  if (!state) return null;
  return (
    <section
      className="rounded-lg border border-cockpit-edge bg-cockpit-surface p-3 my-2 text-sm"
      aria-label="First-round pick review"
      data-testid="real-draft-review"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-cockpit-text-primary">
          First-round pick review
        </h3>
        <span className="text-xs text-cockpit-watch">
          {'review' in state &&
          state.review?.records.some((r) => r.status === 'prohibited')
            ? 'Blocked'
            : 'Needs input'}{' '}
          · Apply unavailable
        </span>
      </div>
      {'loading' in state ? (
        <p className="text-cockpit-text-muted mt-2" role="status">
          Reading retained pick evidence…
        </p>
      ) : state.error ? (
        <p className="text-cockpit-watch mt-2" role="status">
          {state.error}
        </p>
      ) : state.review ? (
        <>
          <p className="text-xs text-cockpit-text-muted mt-1">
            Starting position: {state.review.asOf.slice(0, 10)}. This review
            does not certify later changes in a saved world or approve a trade.
          </p>
          <div className="divide-y divide-cockpit-edge">
            {state.review.records.map((row, index) => (
              <details
                key={`${row.entitlementId}:${index}`}
                className="py-2"
                open={state.review!.records.length === 1}
              >
                <summary className="cursor-pointer text-cockpit-text-primary">
                  {row.label}{' '}
                  <span className="text-xs text-cockpit-text-muted">
                    ·{' '}
                    {row.role === 'generated-alias'
                      ? 'Archived pool entry'
                      : row.role === 'source-native'
                        ? 'Recorded right'
                        : 'Pick review'}
                  </span>
                </summary>
                <p className="text-cockpit-text-secondary mt-2">{row.reason}</p>
                {row.components?.status === 'reviewed' && (
                  <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                    <p>
                      Recorded ownership:{' '}
                      {row.components.ownership.status === 'component-permits'
                        ? 'Supported for this team'
                        : row.components.ownership.status ===
                            'component-prohibits'
                          ? 'Held by another team'
                          : 'Needs complete ownership evidence'}
                    </p>
                    <p>
                      Consecutive first-round picks: Needs every possible
                      outcome
                    </p>
                    <p>
                      Apron restriction:{' '}
                      {row.components.apron.every(
                        (a) =>
                          a.status === 'evaluated' &&
                          a.result.frozen.status === 'non-applicable'
                      )
                        ? 'Does not apply to this draft year'
                        : 'Needs team-season evidence'}
                    </p>
                    <p>Exchange terms: Needs all cash and asset terms</p>
                  </div>
                )}
                {row.evidence.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-cockpit-text-secondary">
                    {row.evidence.map((e) => (
                      <li key={e.dependencyId}>
                        <span className="font-medium">
                          {!e.current
                            ? 'Dated support required'
                            : e.status === 'supported in stated scope'
                              ? 'Established in this scope'
                              : e.status === 'legitimate future outcome pending'
                                ? 'Future decision · alternatives recorded'
                                : e.status === 'proven non-applicable'
                                  ? 'Does not apply in this scope'
                                  : 'Needs terms'}
                          :
                        </span>{' '}
                        {e.summary} {e.limitation}
                      </li>
                    ))}
                  </ul>
                )}
                {row.blockers.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-cockpit-watch">
                    {[...new Set(row.blockers.map((b) => b.reason))].map(
                      (reason) => (
                        <li key={reason}>{reason}</li>
                      )
                    )}
                  </ul>
                )}
              </details>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
