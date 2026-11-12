/**
 * Move a SIMULATION world's draft inventory across one season step (V1 item
 * C1): June 5, 2026 to July 1, 2026.
 *
 * - The 2026 Draft is resolved. A tradeable 2026 first is used by whoever
 *   holds it in this world (the owner's trades count). Every other 2026 slot
 *   goes to the team that held it when the real draft began, a named
 *   SIMULATION assumption, because the world date is now after that draft.
 *   The 2026 rights leave the inventory; the selections are returned so the
 *   step can keep them in its history.
 * - The trading window moves to 2027-2033 and the newly opened year's outright
 *   firsts are admitted under the same rule as on June 5.
 * - Every later right keeps its terms and its current holder.
 *
 * Pure. Throws instead of guessing.
 */
import type { GovernedDraftWorldBaseline } from '@/schemas/governedDraftWorld';
import {
  SimulationSeasonStepZ,
  type SimulationSeasonStep,
} from '@/schemas/simulationSeasonStep';
import type { DraftSimulationWindow } from '@/schemas/draftSimulationWindow';
import { QUALIFIED_JUNE5_DRAFT_HORIZON } from './draftReview/horizon';
import { validateGovernedDraftBaseline } from './governedDraftWorld.baseline';

export const SIMULATION_SEASON_STEP_ASSUMPTIONS = [
  {
    id: 'draft-2026-public-outcome',
    statement:
      'The 2026 Draft is resolved from its real first-round order. A tradeable 2026 first is used by the team holding it in this world; every other 2026 first goes to the team that held it when the real draft began. Draft-night trades are not part of this world.',
  },
  {
    id: 'next-draft-date',
    statement:
      'The next NBA Draft is assumed to start on the date this step names. It only bounds the trading window and changes no pick.',
  },
] as const;

export type SimulationDraftSelection = {
  slot: number;
  originalTeam: string;
  selectingTeam: string;
  basis: 'world-custody' | 'public-outcome';
  entitlementId: string | null;
};

const seasonOf = (e: Record<string, unknown>) => Number(e.seasonYear);

export function simulationSeasonWindow(
  step: SimulationSeasonStep
): DraftSimulationWindow {
  return {
    kind: 'governed-test-seven-draft-window',
    asOf: step.asOf,
    previousDraftCompletedAt: step.draft.completedAt,
    firstFutureDraftStartsAt: step.nextDraftStartsAt,
    firstYear: step.draft.year + 1,
    lastYear: step.opened.year,
  };
}

export function advanceSimulationDraftBaseline(args: {
  baseline: GovernedDraftWorldBaseline;
  /** Current holder of every retained identity in this world. */
  holders: Readonly<Record<string, string>>;
  step: unknown;
}): {
  baseline: GovernedDraftWorldBaseline;
  selections: SimulationDraftSelection[];
  resolvedIdentities: string[];
} {
  const before = validateGovernedDraftBaseline(args.baseline);
  const step = SimulationSeasonStepZ.parse(args.step);
  const { holders } = args;
  const year = step.draft.year;
  if (
    before.classification !== 'simulation' ||
    before.seasonId !== step.fromSeason ||
    Date.parse(before.asOf) >= Date.parse(step.draft.completedAt) ||
    Date.parse(step.draft.completedAt) >= Date.parse(step.asOf) ||
    Date.parse(step.nextDraftStartsAt) <= Date.parse(step.asOf)
  )
    throw new Error('This season step does not follow the world date.');
  if (
    before.identities.some((id) => typeof holders[id] !== 'string') ||
    Object.keys(holders).some((id) => !before.identities.includes(id))
  )
    throw new Error('Every retained right needs exactly one current holder.');
  const teams = Object.keys(before.initialTeams).sort();
  if (Object.values(holders).some((team) => !teams.includes(team)))
    throw new Error('A holder is not one of the thirty teams.');

  // 1. Resolve the draft year.
  const recordsByPick = new Map(
    before.records.map((r) => [r.ownership.pick.id, r])
  );
  const selections: SimulationDraftSelection[] = step.draft.order.map(
    (slot) => {
      if (!teams.includes(slot.originalTeam))
        throw new Error(`Unknown team ${slot.originalTeam} in the order.`);
      const record = recordsByPick.get(`${slot.originalTeam}_${year}_1st`);
      if (!record)
        return {
          slot: slot.slot,
          originalTeam: slot.originalTeam,
          selectingTeam: slot.holderBeforeDraft,
          basis: 'public-outcome' as const,
          entitlementId: null,
        };
      // The tradeable pick's June 5 holder must match the public record;
      // otherwise the order input is wrong.
      if (record.entitlement.holderTeam !== slot.holderBeforeDraft)
        throw new Error(
          `The order disagrees with the June 5 holder of ${record.ownership.pick.id}.`
        );
      const id = String(record.entitlement.id);
      return {
        slot: slot.slot,
        originalTeam: slot.originalTeam,
        selectingTeam: holders[id],
        basis: 'world-custody' as const,
        entitlementId: id,
      };
    }
  );
  const resolved = before.identities.filter(
    (id) => seasonOf(before.retainedEntitlements[id]) <= year
  );
  const kept = before.identities.filter((id) => !resolved.includes(id));

  // 2. Carry every later right with its current holder.
  const opened = step.opened;
  if (
    opened.records.some(
      (r) =>
        !kept.includes(String(r.entitlement.id)) ||
        before.records.some((b) => b.entitlement.id === r.entitlement.id) ||
        holders[String(r.entitlement.id)] !== r.entitlement.holderTeam ||
        before.unresolved.some((u) =>
          u.entitlementIds.includes(String(r.entitlement.id))
        )
    ) ||
    opened.apron.length !== opened.records.length ||
    opened.apron.some(
      (a) =>
        !opened.records.some((r) => r.ownership.pick.id === a.originalPick.id)
    )
  )
    throw new Error(
      'Opened rights must be retained, unresolved-free, newly admitted and still with their June 5 holder.'
    );
  const retainedEntitlements: Record<
    string,
    Record<string, unknown>
  > = Object.fromEntries(
    kept.map((id) => [
      id,
      { ...before.retainedEntitlements[id], holderTeam: holders[id] },
    ])
  );
  const carry = (r: GovernedDraftWorldBaseline['records'][number]) => {
    const id = String(r.entitlement.id);
    return {
      ...r,
      entitlement: { ...r.entitlement, holderTeam: holders[id] },
      ownership: {
        ...r.ownership,
        effectiveAt: step.asOf,
        claims: r.ownership.claims.map((c) => ({ ...c, team: holders[id] })),
      },
    } as GovernedDraftWorldBaseline['records'][number];
  };
  const records = [
    ...before.records.filter((r) => kept.includes(String(r.entitlement.id))),
    ...opened.records,
  ].map(carry);
  const apron = [
    ...before.apron.filter((a) => a.originalPick.draftYear > year),
    ...opened.apron,
  ].map((a) => ({ ...a, asOf: step.asOf }));

  // 3. Stepien: the window and each team's known obligations move with it.
  const window = simulationSeasonWindow(step);
  const owedYears = (team: string) =>
    kept
      .map((id) => retainedEntitlements[id])
      .filter(
        (e) =>
          e.kind === 'pick_ownership' &&
          typeof e.underlyingPickId === 'string' &&
          e.underlyingPickId.startsWith(`${team}_`) &&
          e.holderTeam !== team
      )
      .map(seasonOf);
  const stepien = Object.fromEntries(
    teams.map((team) => {
      const prior = before.stepien[team];
      const known = [
        ...new Set([
          ...(prior.finiteScope?.knownObligationDraftYears ?? []).filter(
            (y) => y > year
          ),
          ...owedYears(team),
        ]),
      ].sort((a, b) => a - b);
      return [
        team,
        {
          ...prior,
          effectiveAt: step.asOf,
          firstFutureDraftYear: window.firstYear,
          throughDraftYear: Math.max(window.lastYear, ...known),
          finiteScope: {
            ...prior.finiteScope!,
            authorityId: 'governed-software-season',
            simulationWindow: window,
            explanationSha256: QUALIFIED_JUNE5_DRAFT_HORIZON.explanationSha256,
            calendarSha256: QUALIFIED_JUNE5_DRAFT_HORIZON.calendarSha256,
            knownObligationDraftYears: known,
          },
        },
      ];
    })
  ) as GovernedDraftWorldBaseline['stepien'];
  const initialTeams = Object.fromEntries(
    teams.map((team) => [
      team,
      {
        ...before.initialTeams[team],
        entitlementIds: kept.filter((id) => holders[id] === team),
      },
    ])
  ) as GovernedDraftWorldBaseline['initialTeams'];

  const baseline = validateGovernedDraftBaseline({
    ...before,
    releaseId: `${before.releaseId}+${step.toSeason}`,
    assumptions: [
      ...before.assumptions!,
      ...SIMULATION_SEASON_STEP_ASSUMPTIONS.map((a) => ({ ...a })),
    ],
    asOf: step.asOf,
    seasonId: step.toSeason,
    identities: kept,
    retainedEntitlements,
    unresolved: before.unresolved
      .map((u) => ({
        ...u,
        entitlementIds: u.entitlementIds.filter((id) => kept.includes(id)),
      }))
      .filter((u) => u.entitlementIds.length),
    records,
    stepien,
    apron,
    initialTeams,
  });
  return { baseline, selections, resolvedIdentities: resolved };
}
