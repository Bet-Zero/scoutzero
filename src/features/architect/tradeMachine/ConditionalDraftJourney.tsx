import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { ARCHITECT_WORLDS_COLLECTION } from '@/constants/collections';
import { loadConditionalWorld } from '../utils/draftReview/conditionalWorld';
import { activeConditionalStage } from '../utils/draftReview/conditionalProgram';
import { db, isSyntheticDraftReviewEnvironment } from '@/firebaseConfig';

/** Existing Trade Machine, protected saved-world scope only. */
export function ConditionalDraftJourney({
  worldId,
}: {
  worldId: string | null | undefined;
}) {
  const [state, setState] = useState<Awaited<
    ReturnType<typeof loadConditionalWorld>
  > | null>(null);
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setState(null);
    setPositions({});
    setError('');
    if (!worldId || !isSyntheticDraftReviewEnvironment()) return;
    let cancelled = false;
    void getDoc(doc(db, ARCHITECT_WORLDS_COLLECTION, worldId))
      .then((metadata) =>
        metadata.data()?.draftSimulationBranches === 'protection-programs'
          ? loadConditionalWorld(worldId)
          : null
      )
      .then((value) => {
        if (!cancelled) setState(value);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(
            e instanceof Error
              ? e.message
              : 'Conditional obligations are unavailable.'
          );
      });
    return () => {
      cancelled = true;
    };
  }, [worldId]);
  if (!worldId) return null;
  if (!state)
    return error ? (
      <p role="alert">Conditional obligations unavailable: {error}</p>
    ) : null;
  const draftYear =
    Number(String(state.metadata.currentSeason).slice(0, 4)) + 1;
  const due = state.programs.filter(
    (p) => activeConditionalStage(p)?.year === draftYear
  );
  async function advance(draft: boolean) {
    if (!worldId || !state || busy) return;
    setBusy(true);
    setError('');
    try {
      const manager = await import('../utils/seasonManager');
      if (draft)
        await manager.advanceConditionalDraftInWorld(worldId, {
          operationId: `draft_${crypto.randomUUID()}`,
          expectedRevision: state.revision,
          draftYear,
          positions,
        });
      else {
        const result = await manager.advanceSeasonInWorld(worldId, {
          fromSeason: state.metadata.currentSeason,
        });
        if (!result.success) throw new Error(result.error);
        const next = new URL(window.location.href);
        next.searchParams.set('season', String(draftYear + 1));
        window.location.assign(next.toString());
        return;
      }
      window.location.reload();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'The transition could not be saved.'
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="Conditional draft obligations"
      className="p-3 border border-cockpit-edge rounded-lg text-sm my-2"
    >
      <h3>Conditional first-round obligations</h3>
      <p>
        Draft positions entered here are governed test assumptions, not NBA
        results.
      </p>
      {state.programs.map((program) => {
        const active = activeConditionalStage(program);
        return (
          <div key={program.id}>
            <p>
              {program.originalTeam}:{' '}
              {active
                ? `${active.year} first — ${active.protectedThrough ? `top ${active.protectedThrough} protected` : 'unprotected'}; held by ${state.entitlements[active.entitlementId].holderTeam}`
                : 'Obligation conveyed'}
            </p>
            {active &&
              program.stages.slice(program.results.length + 1).length > 0 && (
                <p>
                  On deferral:{' '}
                  {program.stages
                    .slice(program.results.length + 1)
                    .map(
                      (stage) =>
                        `${stage.year} ${stage.protectedThrough ? `top ${stage.protectedThrough} protected` : 'unprotected'}`
                    )
                    .join(' → ')}
                </p>
              )}
            {program.results.map((result) => (
              <p key={result.year}>
                {result.year}: {result.outcome} at pick {result.position}
              </p>
            ))}
          </div>
        );
      })}
      {[...new Set(due.map((p) => p.originalTeam))].map((team) => (
        <label key={team} className="mr-3">
          {team} draft position
          <input
            aria-label={`${team} draft position`}
            type="number"
            min={1}
            max={30}
            value={positions[team] ?? ''}
            onChange={(e) =>
              setPositions((previous) => ({
                ...previous,
                [team]: Number(e.target.value),
              }))
            }
            className="w-16 ml-2 px-1 rounded border border-cockpit-edge bg-cockpit-raised text-cockpit-text-primary"
          />
        </label>
      ))}
      {due.length > 0 ? (
        <button
          className="px-3 py-1 ml-2 rounded border border-cockpit-edge disabled:opacity-50"
          disabled={busy}
          onClick={() => void advance(true)}
        >
          Resolve {draftYear} draft
        </button>
      ) : state.metadata.currentSeason === '2025-26' ? (
        <button
          className="px-3 py-1 rounded border border-cockpit-edge disabled:opacity-50"
          disabled={busy}
          onClick={() => void advance(false)}
        >
          Advance to 2026–27
        </button>
      ) : null}
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Saving conditional transition…</p>}
    </section>
  );
}
