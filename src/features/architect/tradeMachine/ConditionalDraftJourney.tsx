import { isNativeSelectionTradeAdmitted } from '../utils/draftReview/nativeTrading';
import { useEffect, useState } from 'react';
import { OverlappingDraftChoices } from './OverlappingDraftChoices';
import { preparePenaltyDraft } from '../utils/draftReview/penaltyDraft';
import { readPenaltyPlacementReceipt } from '../utils/draftReview/penaltyPlacement';
import { mutationSnapshotDigest } from '../utils/mutationPipeline.snapshotDigest';
import { doc, getDoc } from 'firebase/firestore';
import { ARCHITECT_WORLDS_COLLECTION } from '@/constants/collections';
import { loadConditionalWorld } from '../utils/draftReview/conditionalWorld';
import { activeConditionalStage } from '../utils/draftReview/conditionalProgram';
import {
  apronInputFromHistory,
  apronRestrictionText,
} from '../utils/draftReview/apronSimulation';
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
  const [elections, setElections] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setState(null);
    setPositions({});
    setElections({});
    setError('');
    if (!worldId || !isSyntheticDraftReviewEnvironment()) return;
    let cancelled = false;
    void getDoc(doc(db, ARCHITECT_WORLDS_COLLECTION, worldId))
      .then((metadata) =>
        ['protection-programs', 'swap-program', 'apron-lifecycle'].includes(
          metadata.data()?.draftSimulationBranches
        )
          ? loadConditionalWorld(worldId, { readOnly: true })
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
  const swapDue =
    !state.historicalTerms &&
    state.swap &&
    !state.swap.result &&
    state.swap.year === draftYear;
  const dueTeams = swapDue
    ? state.swap!.slots.map((s) => s.originalTeam)
    : [...new Set(due.map((p) => p.originalTeam))];
  const finalPlacement = readPenaltyPlacementReceipt(
    state.metadata.draftPenaltyReceipt
  );
  let placementPreview: ReturnType<typeof preparePenaltyDraft> | null = null;
  let placementProblem = '';
  if (state.apron && state.metadata.draftPenaltyInput && !finalPlacement) {
    try {
      placementPreview = preparePenaltyDraft(state);
    } catch (e) {
      placementProblem =
        e instanceof Error ? e.message : 'Draft inputs are incomplete.';
    }
  }
  async function advance(draft: boolean) {
    if (!worldId || !state || busy || state.historicalTerms) return;
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
          elections,
          expectedDraftStateDigest: mutationSnapshotDigest(state.snapshots),
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
      aria-label={
        state.apron
          ? 'Second-apron freeze'
          : state.swap
            ? 'Swap pool'
            : 'Conditional draft obligations'
      }
      className="p-3 border border-cockpit-edge rounded-lg text-sm my-2"
    >
      <h3>
        {state.apron
          ? 'Second-apron first-round restriction'
          : state.swap
            ? 'First-round swap pool'
            : 'Conditional first-round obligations'}
      </h3>
      {state.historicalTerms && (
        <p role="status">
          Historical governing terms: saved allocations and receipts remain
          readable. New operations require the replacement program in a separate
          world; this world has not been migrated.
        </p>
      )}
      {state.apron && (
        <div data-testid="apron-lifecycle-summary">
          {(state.metadata.draftSimulationTeams as string[]).map((team) => {
            const input = apronInputFromHistory(
              team,
              Number(state.apron!.plan.startingSeason.slice(0, 4)) + 8,
              state.apron!.history,
              `${String(state.metadata.asOfDate)}T12:00:00-04:00`,
              state.apron!.plan
            );
            const held = Object.values(state.entitlements).find(
              (e) => e.underlyingPickId === input.originalPick.id
            );
            return (
              <p key={team}>
                {team} {input.originalPick.draftYear} first · held by{' '}
                {String(held?.holderTeam ?? 'unknown')}:{' '}
                {finalPlacement
                  ? `Final pick ${finalPlacement.positions.find((p) => p.originalTeam === team)!.position}${finalPlacement.positions.find((p) => p.originalTeam === team)!.penalized ? ' · draft-pick penalty' : ''}`
                  : apronRestrictionText(input)}
              </p>
            );
          })}
          <p>
            {state.apron.history.length} consecutive season observations saved.
            {state.apron.next
              ? ` Next: ${state.apron.next.seasonStartYear}–${String(state.apron.next.seasonStartYear + 1).slice(-2)}.`
              : ' Configured season journey complete.'}{' '}
            {finalPlacement
              ? 'Final draft positions saved.'
              : 'Final draft placement requires the draft season and complete draft-wide inputs.'}
          </p>
          {(finalPlacement || placementPreview) && (
            <details open data-testid="penalty-draft-order">
              <summary>
                {finalPlacement ? 'Saved' : 'Proposed'} {draftYear} first-round
                positions
              </summary>
              <p>
                Software results for this world. Picks keep their current
                owners.
              </p>
              <div className="max-h-60 overflow-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      <th>Pick</th>
                      <th>Original team</th>
                      <th>Held by</th>
                      <th>Before</th>
                      <th>Penalty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(finalPlacement ?? placementPreview)!.positions.map(
                      (p) => (
                        <tr
                          key={p.entitlementId}
                          data-testid={`final-pick-${p.originalTeam}`}
                        >
                          <td>{p.position}</td>
                          <td>{p.originalTeam}</td>
                          <td>{p.holderTeam}</td>
                          <td>{p.beforePosition}</td>
                          <td>{p.penalized ? 'Yes' : 'No'}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          {placementProblem && (
            <p role="status">Final positions unavailable: {placementProblem}</p>
          )}
          {placementPreview && !finalPlacement && (
            <button
              className="px-3 py-1 rounded border border-cockpit-edge disabled:opacity-50"
              disabled={busy}
              onClick={() => void advance(true)}
            >
              Save final {draftYear} draft positions
            </button>
          )}
          <p>
            Governed software scenario, not authenticated NBA facts. Trading
            still requires ownership, a dated trading window, Stepien and
            financial checks.
          </p>
        </div>
      )}
      {!state.apron && (
        <p>
          Draft positions entered here are governed test assumptions, not NBA
          results.
        </p>
      )}
      {state.swap && (
        <>
          <p>
            {state.swap.result
              ? 'Swap rights resolved — underlying selections allocated below.'
              : state.swap.kind === 'native-ranked-pool-v1'
                ? 'Resolve the complete ranked claim before allocating the remaining selection.'
                : 'The option is separate from its return selection. Claims resolve in the listed order.'}
          </p>
          {state.swap.kind === 'native-ranked-pool-v1' && (
            <div>
              <p>
                Unprotected {state.swap.year} originals only. First and second
                most favorable to {state.swap.nativePool.beneficiaryTeam}; third
                to {state.swap.nativePool.residualTeam}. The ranked claim takes
                priority over the residual selection.
              </p>
              <p>
                Final draft positions belong to the original selections and do
                not change when ownership changes. Archival representations
                remain non-executable.
              </p>
              {swapDue && (
                <label>
                  Pool election
                  <select
                    aria-label="Pool election"
                    value={elections.exercisePool ? 'exercise' : ''}
                    onChange={(e) =>
                      setElections(
                        e.target.value === 'exercise'
                          ? { exercisePool: true }
                          : {}
                      )
                    }
                    className="ml-2 bg-cockpit-raised border border-cockpit-edge rounded"
                  >
                    <option value="">Choose…</option>
                    <option value="exercise">Exercise native claim</option>
                  </select>
                </label>
              )}
              <p>
                A waiver that changes this allocation needs additional governing
                terms.
              </p>
            </div>
          )}
          {state.swap.kind === 'ordered-swap-pool-v1' &&
            state.swap.steps.map((step, index) => {
              const slot = state.swap!.slots.find(
                (s) => s.entitlementId === step.controllerId
              )!;
              const holder = String(
                state.entitlements[step.rightId].holderTeam
              );
              return (
                <div key={step.rightId}>
                  <p>
                    {index + 1}. {holder}:{' '}
                    {step.comparator === 'best_of' ? 'More' : 'Less'} favorable
                    selection from{' '}
                    {step.poolIds
                      .map(
                        (id) =>
                          state.swap!.slots.find((s) => s.entitlementId === id)!
                            .originalTeam
                      )
                      .join(' / ')}
                    ; return {slot.originalTeam} {state.swap!.year} first
                  </p>
                  {swapDue && (
                    <label>
                      {holder} {slot.originalTeam} swap choice
                      <select
                        aria-label={`${holder} ${slot.originalTeam} swap choice`}
                        value={
                          elections[step.rightId] === undefined
                            ? ''
                            : elections[step.rightId]
                              ? 'exercise'
                              : 'waive'
                        }
                        onChange={(e) =>
                          setElections((previous) => {
                            const next = { ...previous };
                            if (!e.target.value) delete next[step.rightId];
                            else
                              next[step.rightId] =
                                e.target.value === 'exercise';
                            return next;
                          })
                        }
                        className="ml-2 bg-cockpit-raised border border-cockpit-edge rounded"
                      >
                        <option value="">Choose…</option>
                        <option value="exercise">Exercise</option>
                        <option value="waive">Waive</option>
                      </select>
                    </label>
                  )}
                </div>
              );
            })}
          {state.swap.kind === 'native-overlapping-pool-v1' && (
            <OverlappingDraftChoices
              program={state.swap}
              positions={state.swap.result?.positions ?? positions}
              elections={elections}
              due={Boolean(swapDue)}
              onElection={(id, selected) =>
                setElections((previous) => {
                  const next = { ...previous };
                  if (selected) next[id] = true;
                  else delete next[id];
                  return next;
                })
              }
            />
          )}
          {state.swap.kind !== 'ordered-swap-pool-v1' && state.swap.result && (
            <p>
              {state.historicalTerms
                ? 'This historical world is read-only for draft operations.'
                : !isNativeSelectionTradeAdmitted(state.swap)
                  ? 'Subsequent trading is not yet available for this native family.'
                  : state.metadata.draftNativeLifecycle &&
                      state.metadata.asOfDate >=
                        state.metadata.draftNativeLifecycle.tradingWindow.firstFutureDraftStartsAt.slice(
                          0,
                          10
                        )
                    ? 'The draft has begun. These selections are no longer available for pre-draft trades.'
                    : state.metadata.draftNativeLifecycle
                      ? `Resolved selections may be exchanged before ${state.metadata.draftNativeLifecycle.tradingWindow.firstFutureDraftStartsAt.slice(0, 10)}, subject to trade validation. The original claim result stays in History.`
                      : 'This draft resolution has no pre-draft trading window. These selections cannot be traded retrospectively.'}
            </p>
          )}
          {state.swap.slots.map((slot) => (
            <p key={slot.entitlementId}>
              {slot.originalTeam} {state.swap!.year} first: held by{' '}
              {String(state.entitlements[slot.entitlementId].holderTeam)}
              {state.swap!.result
                ? ` at pick ${state.swap!.result.positions[slot.originalTeam]}`
                : ''}
            </p>
          ))}
        </>
      )}
      {state.programs.map((program) => {
        const active = activeConditionalStage(program);
        return (
          <div key={program.id}>
            <p>
              {program.originalTeam}:{' '}
              {active
                ? `${active.year} first — ${active.protectedThrough ? `top ${active.protectedThrough} protected` : 'unprotected'}; conditional right held by ${state.entitlements[active.entitlementId].holderTeam}`
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
      {dueTeams.map((team) => (
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
      {due.length > 0 || swapDue ? (
        <button
          className="px-3 py-1 ml-2 rounded border border-cockpit-edge disabled:opacity-50"
          disabled={busy || state.historicalTerms}
          onClick={() => void advance(true)}
        >
          Resolve {draftYear} draft
        </button>
      ) : state.apron?.next ||
        (!state.apron && state.metadata.currentSeason === '2025-26') ? (
        <button
          className="px-3 py-1 rounded border border-cockpit-edge disabled:opacity-50"
          disabled={busy}
          onClick={() => void advance(false)}
        >
          Advance to {draftYear}–{String(draftYear + 1).slice(-2)}
        </button>
      ) : null}
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Saving conditional transition…</p>}
    </section>
  );
}
