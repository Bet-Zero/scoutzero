import { DraftPenaltyPlacementInputZ } from '@/schemas/draftPenaltyPlacement';
import type { loadConditionalWorld } from './conditionalWorld';
import { apronInputFromHistory } from './apronSimulation';
import { calculatePenaltyPlacement } from './penaltyPlacement';
import { mutationSnapshotText } from '../mutationPipeline.snapshotDigest';

type State = Pick<
  Awaited<ReturnType<typeof loadConditionalWorld>>,
  'metadata' | 'apron' | 'entitlements' | 'catalogue' | 'teams'
>;

export function preparePenaltyDraft(state: State) {
  const input = DraftPenaltyPlacementInputZ.parse(
    state.metadata.draftPenaltyInput
  );
  const { apron, metadata, catalogue, entitlements } = state;
  if (
    !apron ||
    apron.plan.kind !== 'governed-apron-lifecycle-v2' ||
    apron.history.length !== 7 ||
    Number(apron.plan.startingSeason.slice(0, 4)) + 8 !== input.draftYear ||
    metadata.currentSeason !==
      `${input.draftYear - 1}-${String(input.draftYear).slice(-2)}` ||
    input.date < String(metadata.asOfDate) ||
    input.regularSeasonCompletedOn !==
      apron.plan.seasons?.at(-1)?.regularSeasonClosing
  )
    throw new Error(
      'Final placement requires every consecutive season through the draft season and its completed regular season.'
    );
  const calendar = metadata.draftSimulationCalendar;
  if (
    !Array.isArray(calendar) ||
    calendar.length !== 1 ||
    calendar[0].year !== input.draftYear ||
    calendar[0].date !== input.date
  )
    throw new Error('The final draft date is missing or conflicting.');
  const originals = catalogue.data.records.filter(
    (r) => r.originalPick?.draftYear === input.draftYear
  );
  const rights = catalogue.data.records.filter((r) => !r.originalPick);
  if (
    new Set(input.reviewedRightIds).size !== rights.length ||
    mutationSnapshotText([...input.reviewedRightIds].sort()) !==
      mutationSnapshotText(rights.map((r) => r.entitlementId).sort()) ||
    rights.some(
      (r) =>
        r.poolIds.some((id) => id.includes(`_${input.draftYear}_`)) ||
        Number(entitlements[r.entitlementId]?.seasonYear) === input.draftYear
    )
  )
    throw new Error(
      'Every retained right must be accounted for; competing draft claims require resolution.'
    );
  if (originals.length !== 30)
    throw new Error('Complete retained original-pick identities are required.');
  for (const slot of input.selections) {
    const record = originals.find(
      (r) => r.entitlementId === slot.entitlementId
    );
    if (
      !record ||
      record.originalPick?.originalTeam !== slot.originalTeam ||
      entitlements[slot.entitlementId]?.holderTeam !== slot.holderTeam ||
      entitlements[slot.entitlementId]?.kind !== 'pick_ownership' ||
      !Array.isArray(state.teams[slot.holderTeam]?.entitlementIds) ||
      !state.teams[slot.holderTeam].entitlementIds.includes(slot.entitlementId)
    )
      throw new Error(
        'Draft ownership differs from the complete saved inventory.'
      );
    if (
      catalogue.data.unresolved.some(
        (d) =>
          d.entitlementIds.includes(slot.entitlementId) &&
          // This protected world derives apron status from consumed software
          // seasons. Keep the factual gap unchanged; it still blocks NBA claims
          // and transfers. No allocation/ownership gap receives this exception.
          !(
            d.dependencyId ===
              `season:${slot.originalTeam}:${apron.plan.startingSeason}:last-regular-game-start` &&
            d.actions.includes('apron') &&
            d.actions.every(
              (action) => action === 'apron' || action === 'transfer'
            )
          )
      )
    )
      throw new Error(
        'Unresolved source dependencies cannot establish final placement.'
      );
  }
  const restrictions = Object.keys(state.teams)
    .sort()
    .map((team) =>
      apronInputFromHistory(
        team,
        input.draftYear,
        apron.history,
        `${input.date}T12:00:00-04:00`,
        apron.plan
      )
    );
  const positions = calculatePenaltyPlacement(input, restrictions);
  return { input, restrictions, positions, planDigest: apron.planDigest };
}
