/** Read-only projection of admitted originals and checked saved-world custody. */
import type { loadGovernedDraftWorld } from './governedDraftWorld.load';
import type {
  ArchitectWorkspaceDraftAssetsSummary,
  ArchitectWorkspaceDraftPickView,
  ArchitectWorkspaceDraftYearGroup,
} from '../GMDashboard/hooks/useArchitectWorkspaceContext';

export function governedDraftWorldAssets(
  state: Pick<
    NonNullable<Awaited<ReturnType<typeof loadGovernedDraftWorld>>>,
    'baseline' | 'holders'
  >,
  team: string,
  fromYear: number
): ArchitectWorkspaceDraftAssetsSummary {
  const years = new Map<number, ArchitectWorkspaceDraftYearGroup>();
  const outgoing: ArchitectWorkspaceDraftPickView[] = [];
  let firstRoundCount = 0;
  for (const { entitlement, ownership } of state.baseline.records) {
    const id = String(entitlement.id),
      holder = state.holders[id],
      origin = ownership.pick.originalTeam;
    const year = ownership.pick.draftYear;
    if (year < fromYear || (holder !== team && origin !== team)) continue;
    const view: ArchitectWorkspaceDraftPickView = {
      key: id,
      year,
      round: 1,
      isOwn: holder === team && origin === team,
      isSwap: false,
      protectionLabel: null,
      sourceLabel:
        holder !== team
          ? `to ${holder}`
          : origin === team
            ? 'Own'
            : `via ${origin}`,
    };
    if (holder !== team) {
      outgoing.push(view);
      continue;
    }
    const group = years.get(year) ?? { year, firstRound: [], secondRound: [] };
    group.firstRound.push(view);
    years.set(year, group);
    firstRoundCount++;
  }
  // Keep every retained holding visible. Unadmitted definitions are rights
  // with an explicit qualification label, never executable pick/Stepien facts.
  const admitted = new Set(state.baseline.records.map((r) => r.entitlement.id));
  const unconfirmed = new Set(
    state.baseline.unresolved.flatMap((u) => u.entitlementIds)
  );
  const simulation = state.baseline.classification === 'simulation';
  let rightCount = 0;
  for (const [id, entitlement] of Object.entries(
    state.baseline.retainedEntitlements
  )) {
    if (admitted.has(id) || state.holders[id] !== team) continue;
    const knownYear = Number.isInteger(entitlement.seasonYear)
      ? Number(entitlement.seasonYear)
      : null;
    if (knownYear != null && knownYear < fromYear) continue;
    const year = knownYear ?? fromYear;
    const group = years.get(year) ?? { year, firstRound: [], secondRound: [] };
    const description =
      typeof entitlement.description === 'string'
        ? entitlement.description
        : id;
    (group.rights ??= []).push({
      key: id,
      label: simulation
        ? `${description} — ${unconfirmed.has(id) ? "not tradeable: its terms can't be confirmed" : 'not tradeable yet'}`
        : `${description} — not qualified for trading${knownYear == null ? '; year unqualified' : ''}`,
    });
    years.set(year, group);
    rightCount++;
  }
  return {
    status: 'available',
    years: [...years.values()].sort((a, b) => a.year - b.year),
    firstRoundCount,
    secondRoundCount: 0,
    rightCount,
    outgoing,
  };
}
