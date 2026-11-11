/**
 * Compile the retained June 5 draft candidate into a SIMULATION world baseline.
 *
 * Owner decision 2026-11-10: worlds are simulations. Rules stay exact; a fact no
 * available source establishes is replaced by a named, visible assumption. This
 * compiler admits only rights whose transfer the existing unconditional engine
 * can judge. Every other identity stays retained and visibly not tradeable.
 * Private inputs are read by the caller; nothing here embeds NBA data.
 */
import type { GovernedDraftWorldBaseline } from '@/schemas/governedDraftWorld';
import { EntitlementAssetZ } from '@/schemas/architect';
import { QUALIFIED_JUNE5_DRAFT_HORIZON } from './draftReview/horizon';
import { validateGovernedDraftBaseline } from './governedDraftWorld.baseline';

type CandidateRecord = {
  entitlementId: string;
  group: string;
  reportedHolder: string | null;
  nativeAssets: string[];
  originalPick: {
    id: string;
    originalTeam: string;
    draftYear: number;
    round: number;
  } | null;
  retainedAssessment?: {
    actions?: { resolveConditionalOutcome?: { status?: string } };
  };
};
export type SimulationDraftCandidate = {
  asOf: string;
  records: CandidateRecord[];
  unresolved: GovernedDraftWorldBaseline['unresolved'];
  teamInputs: { team: string }[];
};

export const SIMULATION_DRAFT_ASSUMPTIONS = [
  {
    id: 'june5-reported-holder',
    statement:
      'A pick whose June 5, 2026 holder was accepted in review is treated as held outright by that team. Conditions recorded anywhere in the retained catalogue keep the pick out of this set.',
  },
  {
    id: 'complete-league-inventory',
    statement:
      'The retained June 5 draft rights are treated as the complete league inventory for the Stepien check. Picks that are conditional, unresolved or owed under a swap or pool never count as a retained first for either side.',
  },
  {
    id: 'unconditional-transfer-only',
    statement:
      'In this baseline only outright original firsts can be traded. Conditional rights, swaps, pools and rights with unresolved evidence stay visible and are not tradeable yet.',
  },
  {
    id: 'apron-history-scoped',
    statement:
      'Whether each team finished the 2024-25 and 2025-26 regular seasons above the Second Apron comes from retained above/at-or-below determinations, not exact payroll figures, read on the final regular-season day. Where 2025-26 was not determined, a team hard-capped at either Apron that season is read as at or below the Second Apron. A first frozen by this history is not tradeable; later seasons are still to be played.',
  },
] as const;

/** Final regular-season day per season (2025-26: SRC2-005 §15.12.3). */
export const SIMULATION_REGULAR_SEASON_FINAL_DAY: Record<number, string> = {
  2024: '2025-04-13',
  2025: '2026-04-12',
};

export type SimulationApronHistoryRow = {
  team: string;
  seasonStartYear: number;
  aboveSecondApron: boolean;
  /** Retained determination id, or the derivation it rests on. */
  sourceResultId: string;
};

const TEAM = /^[A-Z]{3}$/;

function simulationSource(scope: string, sha256: string, locator: string) {
  return {
    id: 'june5-simulation-baseline',
    artifactSha256: sha256,
    locator,
    scope,
    qualification: 'qualified' as const,
    publishedAt: null,
    capturedAt: null,
    review: {
      status: 'accepted' as const,
      limitations: [],
      reference:
        'SIMULATION premise (owner decision 2026-11-10); not certified NBA history',
    },
  };
}

/** Pure. Throws instead of guessing when inputs do not cover every identity. */
export function compileSimulationDraftBaseline(args: {
  candidate: SimulationDraftCandidate;
  candidateSha256: string;
  entitlements: readonly Record<string, unknown>[];
  seasonId: string;
  releaseId: string;
  /** Above/at-or-below determinations for completed Apron-rule seasons. */
  apronHistory?: readonly SimulationApronHistoryRow[];
}): GovernedDraftWorldBaseline {
  const { candidate, candidateSha256, seasonId, releaseId } = args;
  if (!/^[0-9a-f]{64}$/.test(candidateSha256))
    throw new Error('Candidate digest must be a bare SHA-256 hex value.');
  if (candidate.asOf !== QUALIFIED_JUNE5_DRAFT_HORIZON.asOf)
    throw new Error('Candidate date differs from the June 5 draft horizon.');
  const identities = candidate.records.map((r) => r.entitlementId);
  if (new Set(identities).size !== identities.length)
    throw new Error('Candidate identities are duplicated.');

  const base = new Map<string, Record<string, unknown>>();
  for (const raw of args.entitlements) {
    const parsed = EntitlementAssetZ.safeParse(raw);
    if (!parsed.success || base.has(parsed.data.id))
      throw new Error('Base entitlement export is invalid or duplicated.');
    base.set(parsed.data.id, raw);
  }
  if (base.size !== identities.length || identities.some((id) => !base.has(id)))
    throw new Error(
      'Base entitlement export must cover exactly the retained identities.'
    );

  const teams = [...new Set(candidate.teamInputs.map((t) => t.team))].sort();
  if (teams.length !== 30 || teams.some((t) => !TEAM.test(t)))
    throw new Error('Expected thirty team inputs.');

  const unresolvedIds = new Set(
    candidate.unresolved.flatMap((u) => u.entitlementIds)
  );
  // A pick that sits in any swap, pool or native grant is not an outright
  // transfer, even when its holder is known.
  const programPicks = new Set<string>();
  for (const r of candidate.records)
    r.nativeAssets.forEach((p) => programPicks.add(p));
  for (const doc of base.values()) {
    for (const key of ['poolUnderlyingPickIds'] as const)
      (Array.isArray(doc[key]) ? (doc[key] as unknown[]) : []).forEach((p) =>
        programPicks.add(String(p))
      );
    if (typeof doc.swapControllerPickId === 'string')
      programPicks.add(doc.swapControllerPickId);
  }

  const retainedEntitlements: Record<string, Record<string, unknown>> = {};
  const records: GovernedDraftWorldBaseline['records'] = [];
  for (const r of candidate.records) {
    const doc = base.get(r.entitlementId)!;
    const admitted =
      r.group === 'original-supported' &&
      r.originalPick !== null &&
      typeof r.reportedHolder === 'string' &&
      TEAM.test(r.reportedHolder) &&
      teams.includes(r.reportedHolder) &&
      r.originalPick.round === 1 &&
      r.originalPick.draftYear >=
        QUALIFIED_JUNE5_DRAFT_HORIZON.firstFutureDraftYear &&
      r.originalPick.draftYear <=
        QUALIFIED_JUNE5_DRAFT_HORIZON.lastTradableDraftYear &&
      !unresolvedIds.has(r.entitlementId) &&
      !programPicks.has(r.originalPick.id) &&
      r.retainedAssessment?.actions?.resolveConditionalOutcome?.status ===
        'non-applicable-or-underlying-program-only' &&
      doc.kind === 'pick_ownership' &&
      doc.underlyingPickId === r.originalPick.id &&
      (doc.underlyingStatus == null || doc.underlyingStatus === 'clean') &&
      !Array.isArray(doc.protectionLadder);
    // The accepted June 5 holder replaces the legacy label only where accepted.
    const entitlement =
      r.group.startsWith('original-') && typeof r.reportedHolder === 'string'
        ? { ...doc, holderTeam: r.reportedHolder }
        : { ...doc };
    if (!teams.includes(String(entitlement.holderTeam)))
      throw new Error(`No holder team for ${r.entitlementId}.`);
    retainedEntitlements[r.entitlementId] = entitlement;
    if (!admitted) continue;
    const pick = {
      ...r.originalPick!,
      round: 1 as const,
      kind: 'authenticated-original-pick' as const,
    };
    records.push({
      entitlement: EntitlementAssetZ.strict().parse(entitlement),
      ownership: {
        id: `simulation-ownership:${pick.id}`,
        scope: 'original-pick-ownership',
        status: 'supported in stated scope',
        effectiveAt: candidate.asOf,
        validUntil: null,
        sources: [
          simulationSource(
            'original-pick-ownership',
            candidateSha256,
            `june5-candidate:records/${r.entitlementId}`
          ),
        ],
        unresolvedDependencyIds: [],
        pick,
        claimCoverage: 'complete',
        claims: [
          {
            id: `simulation-holder:${r.entitlementId}`,
            team: r.reportedHolder!,
            status: 'owned-unconditionally',
          },
        ],
      },
    } as GovernedDraftWorldBaseline['records'][number]);
  }

  const h = QUALIFIED_JUNE5_DRAFT_HORIZON;
  const stepien: GovernedDraftWorldBaseline['stepien'] = {};
  const initialTeams: GovernedDraftWorldBaseline['initialTeams'] = {};
  for (const team of teams) {
    // Every year in which the team's own original first is not held outright by
    // the team is a known obligation year; it extends the required closure.
    const owed = candidate.records
      .filter(
        (r) =>
          r.originalPick?.originalTeam === team &&
          r.originalPick.draftYear >= h.firstFutureDraftYear &&
          retainedEntitlements[r.entitlementId].holderTeam !== team
      )
      .map((r) => r.originalPick!.draftYear);
    stepien[team] = {
      id: `simulation:${team}:stepien-post-trade-branches`,
      scope: 'stepien-post-trade-branches',
      status: 'supported in stated scope',
      effectiveAt: candidate.asOf,
      validUntil: null,
      sources: [
        simulationSource(
          'stepien-post-trade-branches',
          candidateSha256,
          `june5-candidate:teams/${team}`
        ),
      ],
      unresolvedDependencyIds: [],
      firstFutureDraftYear: h.firstFutureDraftYear,
      throughDraftYear: Math.max(h.lastTradableDraftYear, ...owed),
      laterDrafts: 'outside-qualified-scope',
      branchesComplete: true,
      finiteScope: {
        authorityId: h.id,
        calendarSha256: h.calendarSha256,
        explanationSha256: h.explanationSha256,
        completeRelevantObligationCoverage: true,
        knownObligationDraftYears: [...new Set(owed)].sort((a, b) => a - b),
        unresolvedDependencyIds: [],
      },
    } as GovernedDraftWorldBaseline['stepien'][string];
    initialTeams[team] = {
      entitlementIds: identities.filter(
        (id) => retainedEntitlements[id].holderTeam === team
      ),
    };
  }

  // 2026-2031 originals precede the 2024-25 Apron freeze rule (A12.4). Later
  // originals read the scoped history (A4); a missing season fails closed.
  const history = new Map<string, SimulationApronHistoryRow>();
  for (const row of args.apronHistory ?? []) {
    const key = `${row.team}:${row.seasonStartYear}`;
    if (
      history.has(key) ||
      !teams.includes(row.team) ||
      !SIMULATION_REGULAR_SEASON_FINAL_DAY[row.seasonStartYear] ||
      typeof row.aboveSecondApron !== 'boolean' ||
      !row.sourceResultId
    )
      throw new Error(`Apron history row ${key} is invalid or duplicated.`);
    history.set(key, row);
  }
  const observations = (team: string, trigger: number) =>
    Array.from({ length: 5 }, (_, i) => trigger + i).flatMap((year) => {
      const row = history.get(`${team}:${year}`);
      if (!row) return [];
      const at = `${SIMULATION_REGULAR_SEASON_FINAL_DAY[year]}T00:00:00.000Z`;
      return [
        {
          team,
          seasonStartYear: year,
          state: 'supported' as const,
          sourceResultId: row.sourceResultId,
          pendingUntil: null,
          sources: [
            simulationSource(
              'second-apron-season-end',
              candidateSha256,
              `june5-candidate:apronHistory/${team}/${year}`
            ),
          ],
          value: {
            basis: 'simulation-scoped-determination' as const,
            aboveSecondApron: row.aboveSecondApron,
            measuredAt: at,
            lastRegularSeasonGameStart: at,
          },
        },
      ];
    });
  const apron = records.map((r) => ({
    team: r.ownership.pick.originalTeam,
    triggerSeasonStartYear: r.ownership.pick.draftYear - 8,
    originalPick: {
      id: r.ownership.pick.id,
      originalTeam: r.ownership.pick.originalTeam,
      draftYear: r.ownership.pick.draftYear,
      round: 1 as const,
    },
    asOf: candidate.asOf,
    observations: observations(
      r.ownership.pick.originalTeam,
      r.ownership.pick.draftYear - 8
    ),
    regularSeasonEnds: [],
  }));

  return validateGovernedDraftBaseline({
    version: 1,
    releaseId,
    classification: 'simulation',
    assumptions: SIMULATION_DRAFT_ASSUMPTIONS.map((a) => ({ ...a })),
    asOf: candidate.asOf,
    seasonId,
    identities,
    retainedEntitlements,
    unresolved: candidate.unresolved,
    records,
    stepien,
    apron,
    initialTeams,
  });
}
