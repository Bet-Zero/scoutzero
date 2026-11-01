import { apronInputFromHistory, apronRestrictionText } from './apronSimulation';
import { readPenaltyPlacementReceipt } from './penaltyPlacement';
import { activeConditionalStage } from './conditionalProgram';
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
  const placement = readPenaltyPlacementReceipt(
    state.metadata.draftPenaltyReceipt
  );
  let firstRoundCount = 0,
    rightCount = 0;
  for (const [id, e] of Object.entries(state.entitlements)) {
    const program = state.programs?.find((p) =>
      p.stages.some((s) => s.entitlementId === id)
    );
    const active = program ? activeConditionalStage(program) : null;
    const beneficiary = active
      ? String(state.entitlements[active.entitlementId].holderTeam)
      : null;
    const outstanding = !!active && beneficiary !== program!.originalTeam;
    const isActive = active?.entitlementId === id;
    const retainedSelection =
      outstanding &&
      isActive &&
      active.protectedThrough > 0 &&
      program!.originalTeam === team;
    if (
      (e.holderTeam !== team && !retainedSelection) ||
      Number(e.seasonYear) < year
    )
      continue;
    const group = groups.get(Number(e.seasonYear)) ?? {
      year: Number(e.seasonYear),
      firstRound: [],
      secondRound: [],
      rights: [],
    };
    const original = state.catalogue.data.records.find(
      (r) => r.entitlementId === id
    )?.originalPick;
    if (outstanding && isActive && beneficiary === team) {
      const later = program!.stages.slice(program!.results.length + 1);
      group.rights!.push({
        key: id,
        label: `${program!.originalTeam} ${active.year} conditional first — ${active.protectedThrough ? `picks ${active.protectedThrough + 1}–30` : 'unprotected'}${later.length ? `; otherwise ${later.map((s) => `${s.year} ${s.protectedThrough ? `top ${s.protectedThrough} protected` : 'unprotected'} first`).join(' → ')}` : ''}`,
      });
      rightCount++;
      groups.set(group.year, group);
      continue;
    }
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
        protectionLabel: retainedSelection
          ? `Top ${active!.protectedThrough} retained; otherwise to ${beneficiary}`
          : outstanding && original.draftYear > active!.year
            ? `Reserved fallback — owed to ${beneficiary} if ${active!.year} is protected`
            : program?.results.some((r) => r.year === original.draftYear)
              ? `Final pick ${program.results.find((r) => r.year === original.draftYear)!.position} · ${program.results.find((r) => r.year === original.draftYear)!.outcome === 'deferred' ? 'protected; retained' : 'conveyed'}`
              : placement?.positions.some((p) => p.entitlementId === id)
                ? `Final pick ${placement.positions.find((p) => p.entitlementId === id)!.position}${placement.positions.find((p) => p.entitlementId === id)!.penalized ? ' · draft-pick penalty' : ''}`
                : state.swap?.result &&
                    state.swap.slots.some((s) => s.entitlementId === id)
                  ? `Final pick ${state.swap.result.positions[original.originalTeam]}`
                  : state.apron && original.draftYear === 2033
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
      const legacy =
        state.swap?.kind === 'ordered-swap-pool-v1' ? state.swap : null;
      const step = legacy?.steps.find((s) => s.rightId === id);
      const origin = step
        ? legacy!.slots.find((s) => s.entitlementId === step.controllerId)!
            .originalTeam
        : null;
      const archival =
        state.catalogue.data.records.find((r) => r.entitlementId === id)
          ?.role === 'generated-alias';
      const native =
        state.swap?.kind === 'native-overlapping-pool-v1'
          ? state.swap.claims.find((c) => c.representationIds.includes(id))
          : null;
      const duplicate = native && native.representationIds[0] !== id;
      group.rights!.push({
        key: id,
        label: `${archival ? 'Archival record — not an executable right · ' : duplicate ? 'Archival record — not an additional executable right · ' : ''}${origin ?? String(e.holderTeam)} ${e.kind === 'swap_right' ? 'swap right' : 'conditional right'}${(step || native) && state.swap?.result ? ' — resolved' : ''}`,
      });
      if (!archival && !duplicate) rightCount++;
    }
    groups.set(group.year, group);
  }
  // A qualified native option need not have a separate legacy asset record.
  // Project it as a right here; never mint an entitlement or a tradeable pick.
  if (
    state.swap?.kind === 'native-overlapping-pool-v1' &&
    state.swap.year >= year
  ) {
    for (const claim of state.swap.claims.filter(
      (c) => c.holderTeam === team && !c.representationIds.length
    )) {
      const group = groups.get(state.swap.year) ?? {
        year: state.swap.year,
        firstRound: [],
        secondRound: [],
        rights: [],
      };
      group.rights!.push({
        key: claim.clauseId,
        label: `${team} residual swap option against ${claim.targetTeam}${state.swap.result ? ' — resolved' : ''}`,
      });
      groups.set(group.year, group);
      rightCount++;
    }
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
