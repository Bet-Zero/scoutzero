import { apronInputFromHistory, apronRestrictionText } from './apronSimulation';
/** Display-only projection of validated saved-world picks and separate rights. */
import type { loadConditionalWorld } from './conditionalWorld';
import type {
  ArchitectWorkspaceDraftAssetsSummary,
  ArchitectWorkspaceDraftYearGroup,
} from '../../GMDashboard/hooks/useArchitectWorkspaceContext';
export function swapAssets(
  state: Awaited<ReturnType<typeof loadConditionalWorld>>,
  team: string,
  year: number
): ArchitectWorkspaceDraftAssetsSummary {
  const groups = new Map<number, ArchitectWorkspaceDraftYearGroup>();
  let firstRoundCount = 0,
    rightCount = 0;
  for (const [id, e] of Object.entries(state.entitlements)) {
    if (e.holderTeam !== team || Number(e.seasonYear) < year) continue;
    const group = groups.get(Number(e.seasonYear)) ?? {
      year: Number(e.seasonYear),
      firstRound: [],
      secondRound: [],
      rights: [],
    };
    const original = state.catalogue.data.records.find(
      (r) => r.entitlementId === id
    )?.originalPick;
    if (e.kind === 'pick_ownership' && original) {
      group.firstRound.push({
        key: id,
        year: original.draftYear,
        round: 1,
        isOwn: original.originalTeam === team,
        sourceLabel:
          original.originalTeam === team
            ? 'Own'
            : `via ${original.originalTeam}`,
        protectionLabel:
          state.apron && original.draftYear === 2033
            ? apronRestrictionText(
                apronInputFromHistory(
                  original.originalTeam,
                  2033,
                  state.apron.history,
                  `${String(state.metadata.asOfDate)}T12:00:00-04:00`,
                  state.apron.plan
                )
              )
            : null,
        isSwap: false,
      });
      firstRoundCount++;
    } else {
      const step = state.swap?.steps.find((s) => s.rightId === id);
      const origin = step
        ? state.swap!.slots.find((s) => s.entitlementId === step.controllerId)!
            .originalTeam
        : null;
      group.rights!.push({
        key: id,
        label: `${origin ?? String(e.holderTeam)} ${e.kind === 'swap_right' ? 'swap right' : 'conditional right'}${step && state.swap?.result ? ' — resolved' : ''}`,
      });
      rightCount++;
    }
    groups.set(group.year, group);
  }
  return {
    status: 'available',
    years: [...groups.values()].sort((a, b) => a.year - b.year),
    firstRoundCount,
    secondRoundCount: 0,
    rightCount,
    outgoing: [],
  };
}
