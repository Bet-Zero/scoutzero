import { describe, expect, it } from 'vitest';
import { buildGovernedSignAndTradeAuthority } from '@/features/architect/utils/tradeMachine/signAndTrade/governedSignAndTrade';
import {
  computeWorldMutation,
  persistWorldMutation,
} from '@/features/architect/utils/mutationPipeline';
import { mutationSnapshotDigest } from '@/features/architect/utils/mutationPipeline.snapshotDigest';
import { withGovernedSalaryBooks } from '@/tests/fixtures/governedSalaryBookInputs';
import { makeRightsLedgerForIdentity } from '../fixtures/architect/rightsHistory';
import {
  SeasonHistoryRecordZ,
  SeasonTransitionManifestZ,
} from '@/schemas/seasonTransition';
import type { GovernedSignAndTradeEvidenceBundle } from '@/features/architect/utils/tradeMachine/signAndTrade/governedSignAndTrade';
import { getAllMockData, seedMockData } from '../__mocks__/firebase';
import { normalizeWorldEventsForTeamHistory } from '@/features/architect/history/utils/normalizeWorldEventsForTeamHistory';
import { buildGeneralMutationCommittedTeamUpdates } from '@/features/architect/utils/mutationPipeline.read';
import { computeMatchingValues } from '@/features/architect/utils/tradeMachine/utils/matchingValues';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals';
import { normalizeTradePayloadPlayer } from '@/features/architect/utils/tradeContext/tradeContext.snapshot.payloadNorm';
import { GovernedSignAndTradeAuthorityZ } from '@/schemas/governedSignAndTrade';
import { validateSignAndTrade } from '@/features/architect/utils/tradeMachine/rules/validateSignAndTrade';

const TEAM_CODES = [
  'ATL',
  'BOS',
  'BKN',
  'CHA',
  'CHI',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GSW',
  'HOU',
  'IND',
  'LAC',
  'LAL',
  'MEM',
  'MIA',
  'MIL',
  'MIN',
  'NOP',
  'NYK',
  'OKC',
  'ORL',
  'PHI',
  'PHX',
  'POR',
  'SAC',
  'SAS',
  'TOR',
  'UTA',
  'WAS',
] as const;
const WORLD_ID = 'world-governed-sat';
const PLAYER_ID = 'player-governed-sat';
const TRANSACTION_AT = '2026-07-15T12:00:00-04:00';
const TRANSITION_ID = 'seasonAdvance__2025-26__2026-27';

function salaryBookTeam(
  teamCode: string,
  players: Record<string, unknown>[],
  governedTeamSalary = teamCode === 'ATL' ? 160_000_000 : 80_000_000
) {
  return withGovernedSalaryBooks(
    {
      teamCode,
      teamName: `Team ${teamCode}`,
      teamTotalSalary: governedTeamSalary,
      teamSalary: governedTeamSalary,
      apronTeamSalary: governedTeamSalary,
      roster: players.map((player) => String(player.playerId)),
      players,
      capHolds: [],
      deadCap: [],
      exceptions: {},
      offerSheets: [],
      incomingOfferSheets: [],
      contractEventLedgers: [],
      hardCapLedger: [],
      totals: {
        teamSalary: governedTeamSalary,
        apronTeamSalary: governedTeamSalary,
        taxSalary: governedTeamSalary,
      },
    },
    {
      salaryCapYear: 2027,
      asOfDate: TRANSACTION_AT,
      teamSalary: governedTeamSalary,
      apronTeamSalary: governedTeamSalary,
      taxSalary: governedTeamSalary,
    }
  );
}

function makeHistory(teamCode: string, finalRoster: unknown[]) {
  const measurement = salaryBookTeam(teamCode, []).salaryBookInputs
    .seasonCloseApronMeasurement!;
  const preAdvanceState = { teamCode, finalRoster };
  return SeasonHistoryRecordZ.parse({
    schemaVersion: 'season-history-v1',
    historyId: `2025-26__${teamCode}`,
    transitionId: TRANSITION_ID,
    worldId: WORLD_ID,
    teamCode,
    fromSeason: '2025-26',
    toSeason: '2026-27',
    seasonCloseDate: '2026-04-12',
    transitionEffectiveAt: '2026-07-01T00:00:00-04:00',
    preAdvanceState,
    preAdvanceStateDigest: mutationSnapshotDigest(preAdvanceState),
    finalRoster,
    finalRosterDigest: mutationSnapshotDigest(finalRoster),
    seasonCloseApronMeasurement: measurement,
    beforeTotals: {},
    afterTotals: {},
    contractEvents: [],
    entitlementStateDigest: mutationSnapshotDigest([]),
    authorityDigest: mutationSnapshotDigest({ teamCode, authority: true }),
  });
}

function makeFixture() {
  const livePlayer = {
    playerId: PLAYER_ID,
    displayName: 'Governed S&T Player',
    teamCode: 'ATL',
    bio: { display: { freeAgentYear: 2027 } },
    contract: null,
  };
  const priorPlayer = {
    ...livePlayer,
    contract: {
      contractId: 'prior-contract',
      salariesByYear: [
        {
          season: '2025-26',
          salary: 10_000_000,
          capHit: 10_000_000,
          incentives: { likely: 0, unlikely: 0 },
        },
      ],
    },
  };
  const supportingPlayer = (
    teamCode: string,
    index: number,
    salary: number
  ) => ({
    playerId: `${teamCode}-live-${index}`,
    displayName: `${teamCode} Live ${index}`,
    teamCode,
    contract: {
      contractId: `${teamCode}-contract-${index}`,
      salariesByYear: [
        {
          season: '2026-27',
          salary,
          capHit: salary,
          guaranteed: true,
        },
      ],
    },
  });
  const sourceSupportingPlayers = Array.from({ length: 14 }, (_, index) =>
    supportingPlayer('ATL', index, index === 13 ? 30_000_000 : 10_000_000)
  );
  const destinationSupportingPlayers = Array.from({ length: 14 }, (_, index) =>
    supportingPlayer('BOS', index, index === 13 ? 15_000_000 : 5_000_000)
  );
  const sourceTeam = {
    ...salaryBookTeam('ATL', [livePlayer, ...sourceSupportingPlayers]),
    rightsLedger: (() => {
      const ledger = makeRightsLedgerForIdentity({
        worldId: WORLD_ID,
        teamId: 'ATL',
        playerId: PLAYER_ID,
        salaryCapYear: 2027,
      });
      return {
        ...ledger,
        events: ledger.events.map((event) =>
          event.eventKind === 'rights-established'
            ? {
                ...event,
                amountRecords: event.amountRecords.map((row) =>
                  row.kind === 'prior-signing-bonus-allocation' ||
                  row.kind === 'earned-performance-bonuses'
                    ? { ...row, amount: 0 }
                    : row
                ),
              }
            : event
        ),
      };
    })(),
  };
  const destinationTeam = salaryBookTeam('BOS', destinationSupportingPlayers);
  const histories = TEAM_CODES.map((teamCode) =>
    makeHistory(
      teamCode,
      teamCode === 'ATL'
        ? [priorPlayer]
        : [{ playerId: `${teamCode}-prior-player`, displayName: teamCode }]
    )
  );
  const manifest = SeasonTransitionManifestZ.parse({
    schemaVersion: 'season-transition-manifest-v1',
    transitionId: TRANSITION_ID,
    operationId: 'season-advance-op',
    eventId: TRANSITION_ID,
    worldId: WORLD_ID,
    fromSeason: '2025-26',
    toSeason: '2026-27',
    fromSalaryCapYear: 2026,
    toSalaryCapYear: 2027,
    seasonCloseDate: '2026-04-12',
    transitionEffectiveAt: '2026-07-01T00:00:00-04:00',
    committedAt: '2026-07-01T00:00:01-04:00',
    authority: { status: 'complete' },
    authorityDigest: mutationSnapshotDigest({ status: 'complete' }),
    entitlementBoundary: { mode: 'preserve-or-fail-closed' },
    preAdvanceMetadataDigest: mutationSnapshotDigest({ season: '2025-26' }),
    teamRecords: histories.map((history) => ({
      teamCode: history.teamCode,
      historyId: history.historyId,
      preAdvanceStateDigest: history.preAdvanceStateDigest,
      committedStateDigest: mutationSnapshotDigest({
        teamCode: history.teamCode,
      }),
      finalRosterDigest: history.finalRosterDigest,
      seasonCloseApronMeasurementDigest: mutationSnapshotDigest(
        history.seasonCloseApronMeasurement
      ),
      entitlementStateDigest: history.entitlementStateDigest,
      contractEventIds: [],
      booksStatus: 'complete',
    })),
    reconciliation: {
      expectedTeamCount: 30,
      preparedTeamCount: 30,
      completeBookCount: 30,
      historyRecordCount: 30,
      entitlementPreservationCount: 30,
    },
    canonLeafIds: ['CBA2-L02.1', 'CBA2-L08.1'],
  });
  const metadata = {
    worldId: WORLD_ID,
    currentSeason: '2026-27',
    currentYear: 2027,
    asOfDate: '2026-07-15',
  };
  const snapshots = {
    worldMetadata: { exists: true, digest: mutationSnapshotDigest(metadata) },
    sourceTeam: { exists: true, digest: mutationSnapshotDigest(sourceTeam) },
    destinationTeam: {
      exists: true,
      digest: mutationSnapshotDigest(destinationTeam),
    },
    sourcePlayer: { exists: false, digest: null },
    destinationPlayer: { exists: false, digest: null },
    seasonHistory: {
      exists: true,
      digest: mutationSnapshotDigest(histories[0]),
    },
    transitionManifest: {
      exists: true,
      digest: mutationSnapshotDigest(manifest),
    },
  } as const;
  const evidence: GovernedSignAndTradeEvidenceBundle = {
    worldId: WORLD_ID,
    sourceTeamId: 'ATL',
    destinationTeamId: 'BOS',
    playerId: PLAYER_ID,
    worldMetadata: metadata,
    sourceTeam,
    destinationTeam,
    sourcePlayerDocument: null,
    destinationPlayerDocument: null,
    immutableBasePlayer: null,
    transitionManifest: manifest,
    seasonHistories: histories,
    snapshots,
  };
  const contract = {
    contractType: 'Sign & Trade',
    contractYears: 3,
    years: 3,
    totalValue: 63_000_000,
    salariesByYear: [
      {
        season: '2026-27',
        salary: 20_000_000,
        capHit: 20_000_000,
        guaranteed: true,
        incentives: { likely: 0, unlikely: 0 },
      },
      {
        season: '2027-28',
        salary: 21_000_000,
        capHit: 21_000_000,
        guaranteed: true,
        incentives: { likely: 0, unlikely: 0 },
      },
      {
        season: '2028-29',
        salary: 22_000_000,
        capHit: 22_000_000,
        guaranteed: true,
        incentives: { likely: 0, unlikely: 0 },
      },
    ],
  };
  const proposal = {
    proposalVersion: 1 as const,
    transactionAt: TRANSACTION_AT,
    playerConsentConfirmed: true as const,
    higherMaxStatus: 'not-relied-upon' as const,
    firstSeasonUnlikelyBonuses: 0,
    exhibit6Present: false as const,
    physicalExam: { status: 'not-required' as const },
  };
  return { evidence, contract, proposal, histories, manifest };
}

function replacePriorRosterPlayer(
  fixture: ReturnType<typeof makeFixture>,
  replace: (player: Record<string, unknown>) => Record<string, unknown>
) {
  const sourceIndex = fixture.histories.findIndex(
    (history) => history.teamCode === 'ATL'
  );
  const sourceHistory = fixture.histories[sourceIndex];
  const finalRoster = sourceHistory.finalRoster.map((player) =>
    String((player as Record<string, unknown>).playerId || '') === PLAYER_ID
      ? replace(player as Record<string, unknown>)
      : player
  );
  const nextHistory = SeasonHistoryRecordZ.parse({
    ...sourceHistory,
    finalRoster,
    finalRosterDigest: mutationSnapshotDigest(finalRoster),
  });
  fixture.histories = fixture.histories.map((history, index) =>
    index === sourceIndex ? nextHistory : history
  );
  fixture.manifest = SeasonTransitionManifestZ.parse({
    ...fixture.manifest,
    teamRecords: fixture.manifest.teamRecords.map((entry) =>
      entry.teamCode === 'ATL'
        ? { ...entry, finalRosterDigest: nextHistory.finalRosterDigest }
        : entry
    ),
  });
  fixture.evidence = {
    ...fixture.evidence,
    transitionManifest: fixture.manifest,
    seasonHistories: fixture.histories,
    snapshots: {
      ...fixture.evidence.snapshots,
      seasonHistory: {
        exists: true,
        digest: mutationSnapshotDigest(nextHistory),
      },
      transitionManifest: {
        exists: true,
        digest: mutationSnapshotDigest(fixture.manifest),
      },
    },
  };
}

const build = (fixture = makeFixture()) =>
  buildGovernedSignAndTradeAuthority({
    evidence: fixture.evidence,
    contract: fixture.contract,
    proposal: fixture.proposal,
    operationId: 'sat-operation',
    authoringIdentity: 'user-test',
    recordedAt: '2026-07-15T16:00:01Z',
  });

function computePositiveSignAndTrade(
  fixture = makeFixture(),
  operationId = 'sat-operation'
) {
  const electionAuthority = build(fixture);
  const sourceBefore = createCanonicalTeamTotalsSnapshot(
    fixture.evidence.sourceTeam,
    2027,
    { asOfDate: TRANSACTION_AT }
  );
  const destinationBefore = createCanonicalTeamTotalsSnapshot(
    fixture.evidence.destinationTeam,
    2027,
    { asOfDate: TRANSACTION_AT }
  );
  const currentStateTeams = [
    { teamCode: 'ATL', team: fixture.evidence.sourceTeam },
    { teamCode: 'BOS', team: fixture.evidence.destinationTeam },
  ];
  return computeWorldMutation({
    mutationType: 'executeTrade',
    payload: {
      teams: [
        {
          teamCode: 'ATL',
          sends: [
            {
              player_id: PLAYER_ID,
              name: 'Governed S&T Player',
              signAndTrade: true,
              signAndTradeContract: fixture.contract,
              governedSignAndTradeProposal: fixture.proposal,
              governedSignAndTradeAuthority: {
                status: 'forged-preview-authority',
              } as never,
              tradeTo: 'BOS',
            },
          ],
          entitlementsOut: [],
          salaryMatchingElection: {
            version: 1,
            path: 'STANDARD_TPE',
            postAssignmentApronTeamSalary:
              Number(sourceBefore.apronTeamSalary) -
              electionAuthority.salaryTreatment.assignorSalary,
            tradedPlayerPreTradeSalaries: { [PLAYER_ID]: 10_000_000 },
          },
        },
        {
          teamCode: 'BOS',
          sends: [],
          entitlementsOut: [],
          salaryMatchingElection: {
            version: 1,
            path: 'ROOM',
            postAssignmentApronTeamSalary:
              Number(destinationBefore.apronTeamSalary) +
              electionAuthority.salaryTreatment.assigneeRoomAmount,
            tradedPlayerPreTradeSalaries: {},
          },
        },
      ],
      asOfDate: TRANSACTION_AT,
      tradeCtx: {
        source: 'tradeMachine',
        worldId: WORLD_ID,
        asOfDate: TRANSACTION_AT,
        tradeDate: TRANSACTION_AT,
        yearKey: 2027,
        offseason: true,
      },
    },
    currentState: {
      teams: currentStateTeams,
      governedSignAndTradeEvidence: fixture.evidence,
    },
    seasonId: '2026-27',
    timestamp: Date.parse(TRANSACTION_AT),
    asOfDate: TRANSACTION_AT,
    worldId: WORLD_ID,
    operationId,
    authoringIdentity: 'user-test',
    recordedAt: '2026-07-15T16:00:01Z',
  });
}

function seedSignAndTradePersistenceFixture(
  fixture: ReturnType<typeof makeFixture>
) {
  seedMockData(`architect_worlds/${WORLD_ID}`, fixture.evidence.worldMetadata);
  seedMockData(
    `architect_worlds/${WORLD_ID}/teams/ATL`,
    fixture.evidence.sourceTeam
  );
  seedMockData(
    `architect_worlds/${WORLD_ID}/teams/BOS`,
    fixture.evidence.destinationTeam
  );
  fixture.histories.forEach((history) => {
    seedMockData(
      `architect_worlds/${WORLD_ID}/seasonHistory/${history.historyId}`,
      history
    );
  });
  seedMockData(
    `architect_worlds/${WORLD_ID}/seasonTransitions/${fixture.manifest.transitionId}`,
    fixture.manifest
  );
}

const retainedMockWorld = () =>
  JSON.stringify(
    [...getAllMockData().entries()].sort(([left], [right]) =>
      left.localeCompare(right)
    )
  );

async function persistPositiveSignAndTrade(
  result: ReturnType<typeof computePositiveSignAndTrade>,
  committedTeamUpdates = result.teamUpdates || []
) {
  const authenticatedTransactionAt =
    result.metadata?.governedSignAndTradeAuthority?.transactionAt ??
    TRANSACTION_AT;
  return persistWorldMutation({
    worldId: WORLD_ID,
    seasonId: '2026-27',
    mutationType: 'executeTrade',
    computeResult: result,
    committedTeamUpdates: buildGeneralMutationCommittedTeamUpdates(
      committedTeamUpdates,
      '2026-27',
      authenticatedTransactionAt
    ),
    timestamp: Date.parse('2026-07-15T16:00:01Z'),
    payloadAsOfDate: '2026-07-15',
  });
}

describe('governed saved-world sign-and-trade authority', () => {
  it('authenticates the 30-team season-close roster and derives exact BYC treatment', () => {
    const authority = build();
    expect(authority.status).toBe('ready');
    expect(authority.seasonEvidence.historyId).toBe('2025-26__ATL');
    expect(authority.snapshots.seasonHistorySet).toHaveLength(30);
    expect(authority.salaryTreatment).toEqual(
      expect.objectContaining({
        bycTriggered: true,
        poisonPillTriggered: false,
        assignorSalary: 10_000_000,
        assigneeSalary: 20_000_000,
      })
    );
    expect(authority.contract.signedUsing).toBe('FULL_BIRD');
  });

  it('rejects noncanonical Team codes and first-row Contract summary divergence', () => {
    const authority = build();
    expect(
      GovernedSignAndTradeAuthorityZ.safeParse({
        ...authority,
        sourceTeamId: 'atl',
      }).success
    ).toBe(false);
    expect(
      GovernedSignAndTradeAuthorityZ.safeParse({
        ...authority,
        contract: {
          ...authority.contract,
          firstSeasonSalary: authority.contract.firstSeasonSalary + 1,
        },
      }).success
    ).toBe(false);
  });

  it('derives a newly required incomplete-roster charge from governed target-year rules', () => {
    const fixture = makeFixture();
    const sourcePlayers = fixture.evidence.sourceTeam.players.slice(0, 14);
    const sourceTeam = {
      ...salaryBookTeam('ATL', sourcePlayers, 130_000_000),
      rightsLedger: fixture.evidence.sourceTeam.rightsLedger,
    };
    fixture.evidence = {
      ...fixture.evidence,
      sourceTeam,
      snapshots: {
        ...fixture.evidence.snapshots,
        sourceTeam: {
          exists: true,
          digest: mutationSnapshotDigest(sourceTeam),
        },
      },
    };

    const result = computePositiveSignAndTrade(
      fixture,
      'sat-new-incomplete-roster-charge'
    );

    expect(result.success, result.error || '').toBe(true);
    const sourceAfter = result.teamUpdates?.find(
      (team) => team.teamCode === 'ATL'
    )?.team;
    expect(
      sourceAfter?.salaryBookInputs?.incompleteRosterCharge?.amount
    ).toBeGreaterThan(0);
    expect(
      sourceAfter?.salaryBookInputs?.apronAdjustments.status === 'ready'
        ? sourceAfter.salaryBookInputs.apronAdjustments.lineItems.find(
            (line) => line.canonLeafIds.includes('CBA2-C07.11')
          )?.amount
        : null
    ).toBe(
      -Number(sourceAfter?.salaryBookInputs?.incompleteRosterCharge?.amount)
    );
  });

  it('completes the positive saved-world workflow with Contract, books, Row C, receipt, and history', () => {
    const fixture = makeFixture();
    const result = computePositiveSignAndTrade(fixture);

    expect(result.success, result.error || '').toBe(true);
    expect(result._requiresGovernedSignAndTradePersistence).toBe(true);
    const source = result.teamUpdates?.find(
      (team) => team.teamCode === 'ATL'
    )?.team;
    const destination = result.teamUpdates?.find(
      (team) => team.teamCode === 'BOS'
    )?.team;
    const receipt = result.metadata?.governedSignAndTradeReceipt;
    expect(result.metadata?.governedSignAndTradeAuthority).toMatchObject({
      status: 'ready',
      worldId: WORLD_ID,
      operationId: 'sat-operation',
    });
    expect(source?.roster).not.toContain(PLAYER_ID);
    expect(destination?.roster).toContain(PLAYER_ID);
    expect(
      destination?.players?.find(
        (player) =>
          (player.player_id || player.playerId || player.id) === PLAYER_ID
      )?.contract
    ).toMatchObject({
      contractType: 'Sign & Trade',
      signingTeam: 'ATL',
      salariesByYear: [
        expect.objectContaining({ season: '2026-27', salary: 20_000_000 }),
        expect.objectContaining({ season: '2027-28', salary: 21_000_000 }),
        expect.objectContaining({ season: '2028-29', salary: 22_000_000 }),
      ],
    });
    expect(receipt).toMatchObject({
      verificationStatus: 'complete',
      worldId: WORLD_ID,
      sourceTeamId: 'ATL',
      destinationTeamId: 'BOS',
      playerId: PLAYER_ID,
      tradeReceipt: {
        bycTriggered: true,
        poisonPillTriggered: false,
        assignorSalary: 10_000_000,
        assigneeSalary: 20_000_000,
      },
    });
    expect(receipt?.salaryBooks).toHaveLength(2);
    expect(receipt?.hardCapEntryId).toBe('sat-operation:hard-cap:BOS');
    expect(destination?.contractEventLedgers).toHaveLength(1);
  });

  it('uses the exact NQVFA ceiling as the BYC equality boundary', () => {
    const exactFixture = makeFixture();
    const threshold =
      build(exactFixture).salaryTreatment.nonQualifyingVeteranFirstYearCeiling;
    exactFixture.contract.salariesByYear =
      exactFixture.contract.salariesByYear.map((row) => ({
        ...row,
        salary: threshold,
        capHit: threshold,
      }));
    exactFixture.contract.totalValue = threshold * 3;
    const atThreshold = build(exactFixture);
    expect(atThreshold.salaryTreatment).toMatchObject({
      firstSeasonSalaryPlusUnlikely: threshold,
      bycTriggered: false,
      assignorSalary: threshold,
      assigneeSalary: threshold,
    });

    const aboveFixture = makeFixture();
    aboveFixture.contract.salariesByYear =
      aboveFixture.contract.salariesByYear.map((row) => ({
        ...row,
        salary: threshold + 1,
        capHit: threshold + 1,
      }));
    aboveFixture.contract.totalValue = (threshold + 1) * 3;
    const aboveThreshold = build(aboveFixture);
    expect(aboveThreshold.salaryTreatment).toMatchObject({
      firstSeasonSalaryPlusUnlikely: threshold + 1,
      bycTriggered: true,
      assignorSalary: 10_000_000,
      assigneeSalary: threshold + 1,
    });
  });

  it('rejects authoring provenance that predates the transaction', () => {
    const fixture = makeFixture();
    expect(() =>
      buildGovernedSignAndTradeAuthority({
        evidence: fixture.evidence,
        contract: fixture.contract,
        proposal: fixture.proposal,
        operationId: 'sat-operation',
        authoringIdentity: 'user-test',
        recordedAt: '2026-07-15T15:59:59Z',
      })
    ).toThrow(/provenance cannot predate/i);
  });

  it('enforces the exact L03.15 Moratorium start and end instants', () => {
    const at = (transactionAt: string) => {
      const fixture = makeFixture();
      fixture.evidence.worldMetadata.asOfDate = transactionAt.slice(0, 10);
      fixture.proposal = { ...fixture.proposal, transactionAt };
      fixture.evidence = {
        ...fixture.evidence,
        snapshots: {
          ...fixture.evidence.snapshots,
          worldMetadata: {
            exists: true,
            digest: mutationSnapshotDigest(fixture.evidence.worldMetadata),
          },
        },
      };
      return fixture;
    };

    expect(() => build(at('2026-07-01T00:00:59-04:00'))).not.toThrow();
    expect(() => build(at('2026-07-01T00:01:00-04:00'))).toThrow(/Moratorium/i);
    expect(() => build(at('2026-07-06T12:00:00-04:00'))).toThrow(/Moratorium/i);
    expect(() => build(at('2026-07-06T12:00:01-04:00'))).not.toThrow();
  });

  it('fails closed on prior bonus and prior-Minimum reimbursement variants that lack complete V1 authority', () => {
    const bonusFixture = makeFixture();
    replacePriorRosterPlayer(bonusFixture, (player) => ({
      ...player,
      contract: {
        ...(player.contract as Record<string, unknown>),
        salariesByYear: [
          {
            season: '2025-26',
            salary: 10_000_000,
            capHit: 10_000_000,
            incentives: { likely: 0, unlikely: 1 },
          },
        ],
      },
    }));
    expect(() => build(bonusFixture)).toThrow(
      /prior-Contract bonus compensation/i
    );

    const aggregateBonusFixture = makeFixture();
    const aggregateLedger =
      aggregateBonusFixture.evidence.sourceTeam.rightsLedger!;
    aggregateBonusFixture.evidence.sourceTeam.rightsLedger = {
      ...aggregateLedger,
      events: aggregateLedger.events.map((event) =>
        event.eventKind === 'rights-established'
          ? {
              ...event,
              amountRecords: event.amountRecords.map((row) =>
                row.kind === 'earned-performance-bonuses'
                  ? { ...row, amount: 1 }
                  : row
              ),
            }
          : event
      ),
    };
    aggregateBonusFixture.evidence = {
      ...aggregateBonusFixture.evidence,
      snapshots: {
        ...aggregateBonusFixture.evidence.snapshots,
        sourceTeam: {
          exists: true,
          digest: mutationSnapshotDigest(
            aggregateBonusFixture.evidence.sourceTeam
          ),
        },
      },
    };
    expect(() => build(aggregateBonusFixture)).toThrow(/component ceilings/i);

    const minimumFixture = makeFixture();
    const ledger = minimumFixture.evidence.sourceTeam.rightsLedger!;
    const root = ledger.events[0];
    if (root.eventKind !== 'rights-established') {
      throw new Error('fixture requires a rights-establishment root');
    }
    minimumFixture.evidence.sourceTeam.rightsLedger = {
      ...ledger,
      events: [
        {
          ...root,
          priorContract: {
            ...root.priorContract,
            wasOneSeasonMinimumContract: true,
          },
        },
      ],
    };
    minimumFixture.evidence = {
      ...minimumFixture.evidence,
      snapshots: {
        ...minimumFixture.evidence.snapshots,
        sourceTeam: {
          exists: true,
          digest: mutationSnapshotDigest(minimumFixture.evidence.sourceTeam),
        },
      },
    };
    expect(() => build(minimumFixture)).toThrow(/League-reimbursement/i);
  });

  it('rejects malformed and negative Contract incentive money instead of coercing it to zero', () => {
    for (const malformed of ['not-money', -1]) {
      const fixture = makeFixture();
      fixture.contract.salariesByYear[0].incentives.unlikely =
        malformed as unknown as number;

      expect(() => build(fixture)).toThrow(
        /exact nonnegative whole-dollar amounts/i
      );
    }

    const malformedContainer = makeFixture();
    malformedContainer.contract.salariesByYear[0].incentives =
      'not-an-incentive-record' as unknown as {
        likely: number;
        unlikely: number;
      };
    expect(() => build(malformedContainer)).toThrow(
      /unsupported compensation variant/i
    );

    const malformedTradeBonus = makeFixture();
    (
      malformedTradeBonus.contract.salariesByYear[0] as Record<
        string,
        unknown
      >
    ).tradeBonus = 'not-money';
    expect(() => build(malformedTradeBonus)).toThrow(
      /Trade Bonuses are not authorable/i
    );
  });

  it('fails saved-world validation closed on missing or identity-drifted governed authority', () => {
    const fixture = makeFixture();
    const authority = build(fixture);
    const player = {
      id: PLAYER_ID,
      player_id: PLAYER_ID,
      name: 'Governed S&T Player',
      signAndTrade: true,
      originTeamId: 'ATL',
      tradeTo: 'BOS',
      receivingTeamId: 'BOS',
      signAndTradeContract: fixture.contract,
    };
    const team = {
      teamId: 'ATL',
      teamCode: 'ATL',
      teamName: 'Team ATL',
      sends: [player],
      capHolds: [
        {
          playerId: PLAYER_ID,
          playerName: 'Governed S&T Player',
          season: '2026-27',
          active: true,
          isSigned: false,
        },
      ],
    };
    const context = {
      worldId: WORLD_ID,
      currentYear: 2027,
      yearKey: 2027,
      tradeDate: TRANSACTION_AT,
      asOfDate: TRANSACTION_AT,
      offseason: true,
      source: 'tradeMachine',
    };
    const authorityCode =
      'SIGN_AND_TRADE__GOVERNED_AUTHORITY_MISSING_OR_MISMATCHED';

    expect(validateSignAndTrade(team, context).violations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: authorityCode })])
    );
    expect(
      validateSignAndTrade(
        {
          ...team,
          sends: [
            {
              ...player,
              governedSignAndTradeAuthority: {
                ...authority,
                worldId: 'wrong-world',
              },
            },
          ],
        },
        context
      ).violations
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: authorityCode })])
    );
    expect(
      validateSignAndTrade(
        {
          ...team,
          sends: [{ ...player, governedSignAndTradeAuthority: authority }],
        },
        context
      ).violations
    ).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ code: authorityCode })])
    );
  });

  it('counts first-season unlikely bonuses in the assignee Room amount', () => {
    const fixture = makeFixture();
    fixture.proposal = {
      ...fixture.proposal,
      firstSeasonUnlikelyBonuses: 1_000_000,
    };
    fixture.contract.salariesByYear[0].incentives.unlikely = 1_000_000;
    const authority = build(fixture);
    const player = {
      id: PLAYER_ID,
      salary: 1,
      signAndTrade: true,
      governedSignAndTradeAuthority: authority,
    };

    const matching = computeMatchingValues({
      teams: [{ teamId: 'ATL', sends: [player] }],
      yearKey: '2026-27',
      worldId: WORLD_ID,
      asOfDate: TRANSACTION_AT,
      requireGovernedSalaryBasis: true,
    });

    expect(matching.salaryBasisIssues).toEqual([]);
    expect(authority.salaryTreatment).toMatchObject({
      assigneeSalary: 20_000_000,
      assigneeRoomAmount: 21_000_000,
    });
    expect(player.matchOutgoing).toBe(10_000_000);
    expect(player.matchIncoming).toBe(20_000_000);
    expect(player.isBYC).toBe(true);
    expect(player.isPoisonPill).toBe(false);

    const computed = computePositiveSignAndTrade(
      fixture,
      'sat-unlikely-bonus-books'
    );
    expect(computed.success, computed.error || '').toBe(true);
    const destination = computed.teamUpdates?.find(
      (team) => team.teamCode === 'BOS'
    )?.team;
    const receiptBook =
      computed.metadata?.governedSignAndTradeReceipt?.salaryBooks?.find(
        (book) => book.teamId === 'BOS'
      );
    expect(destination?.salaryBookInputs?.apronAdjustments).toMatchObject({
      status: 'ready',
      lineItems: expect.arrayContaining([
        expect.objectContaining({
          id: 'apron-team-salary:excluded-performance-bonus:sat-unlikely-bonus-books',
          amount: 1_000_000,
          canonLeafIds: ['CBA2-C07.2'],
        }),
      ]),
    });
    expect(receiptBook?.apronTeamSalary).toBe(101_000_000);
  });

  it('enforces Row C against the reconciled Apron book at equality and one cent above', () => {
    const atApron = (postTransactionApronTeamSalary: number) => {
      const fixture = makeFixture();
      fixture.proposal = {
        ...fixture.proposal,
        firstSeasonUnlikelyBonuses: 1_000_000,
      };
      fixture.contract.salariesByYear[0].incentives.unlikely = 1_000_000;
      const preTransactionApronTeamSalary =
        postTransactionApronTeamSalary - 21_000_000;
      const apronInputs =
        fixture.evidence.destinationTeam.salaryBookInputs!.apronAdjustments;
      if (apronInputs.status !== 'ready') {
        throw new Error('fixture requires ready Apron Team Salary inputs');
      }
      const baseApronTeamSalary = 80_000_000;
      fixture.evidence.destinationTeam.salaryBookInputs = {
        ...fixture.evidence.destinationTeam.salaryBookInputs!,
        apronAdjustments: {
          ...apronInputs,
          lineItems: apronInputs.lineItems.map((lineItem) =>
            lineItem.canonLeafIds.includes('CBA2-C07.4')
              ? {
                  ...lineItem,
                  amount: preTransactionApronTeamSalary - baseApronTeamSalary,
                }
              : lineItem
          ),
        },
      };
      fixture.evidence.destinationTeam.apronTeamSalary =
        preTransactionApronTeamSalary;
      fixture.evidence.destinationTeam.teamSalary = baseApronTeamSalary;
      fixture.evidence.destinationTeam.teamTotalSalary =
        preTransactionApronTeamSalary;
      fixture.evidence.destinationTeam.projectedSalary =
        preTransactionApronTeamSalary;
      fixture.evidence.destinationTeam.totals = {
        ...fixture.evidence.destinationTeam.totals,
        teamSalary: baseApronTeamSalary,
        apronTeamSalary: preTransactionApronTeamSalary,
        taxSalary: baseApronTeamSalary,
      };
      fixture.evidence = {
        ...fixture.evidence,
        snapshots: {
          ...fixture.evidence.snapshots,
          destinationTeam: {
            exists: true,
            digest: mutationSnapshotDigest(fixture.evidence.destinationTeam),
          },
        },
      };
      return fixture;
    };

    const atEquality = computePositiveSignAndTrade(
      atApron(209_015_000),
      'sat-apron-equality'
    );
    expect(atEquality.success, atEquality.error || '').toBe(true);
    expect(
      atEquality.metadata?.governedSignAndTradeReceipt?.salaryBooks.find(
        (book) => book.teamId === 'BOS'
      )?.apronTeamSalary
    ).toBe(209_015_000);

    const oneCentAbove = computePositiveSignAndTrade(
      atApron(209_015_001),
      'sat-apron-one-cent-above'
    );
    expect(oneCentAbove.success).toBe(false);
    expect(oneCentAbove.error).toMatch(/First Apron|Apron Team Salary/i);
    expect(oneCentAbove.teamUpdates).toBeUndefined();
  });

  it('retains authenticated authority through Trade validation payload normalization', () => {
    const fixture = makeFixture();
    const authority = build(fixture);

    const normalized = normalizeTradePayloadPlayer({
      player: {
        id: PLAYER_ID,
        signAndTrade: true,
        tradeTo: 'celtics',
        receivingTeamId: 'BOS',
        signAndTradeContract: fixture.contract,
        governedSignAndTradeProposal: fixture.proposal,
        governedSignAndTradeAuthority: authority,
      },
      payloadTeamCodes: ['ATL', 'BOS'],
      senderIndex: 0,
    });

    expect(normalized.governedSignAndTradeAuthority).toEqual(authority);
    expect(normalized).toMatchObject({
      tradeTo: 'celtics',
      receivingTeamId: 'BOS',
    });
  });

  it('enforces A07.8 assignee Room at equality and one cent above', () => {
    const atEquality = makeFixture();
    atEquality.proposal = {
      ...atEquality.proposal,
      firstSeasonUnlikelyBonuses: 1_000_000,
    };
    atEquality.contract.salariesByYear[0].incentives.unlikely = 1_000_000;
    atEquality.evidence.destinationTeam.salaryBookInputs!.incompleteRosterCharge =
      {
        ...atEquality.evidence.destinationTeam.salaryBookInputs!
          .incompleteRosterCharge,
        amount: 63_961_000,
      };
    atEquality.evidence.destinationTeam.teamTotalSalary = 143_961_000;
    atEquality.evidence.destinationTeam.teamSalary = 143_961_000;
    atEquality.evidence.destinationTeam.apronTeamSalary = 143_961_000;
    atEquality.evidence.destinationTeam.totals = {
      ...atEquality.evidence.destinationTeam.totals,
      teamSalary: 143_961_000,
      apronTeamSalary: 143_961_000,
      taxSalary: 143_961_000,
    };
    atEquality.evidence = {
      ...atEquality.evidence,
      snapshots: {
        ...atEquality.evidence.snapshots,
        destinationTeam: {
          exists: true,
          digest: mutationSnapshotDigest(atEquality.evidence.destinationTeam),
        },
      },
    };
    const equality = computePositiveSignAndTrade(
      atEquality,
      'sat-room-equality'
    );
    expect(equality.success, equality.error || '').toBe(true);

    const above = makeFixture();
    above.proposal = {
      ...above.proposal,
      firstSeasonUnlikelyBonuses: 1_000_000,
    };
    above.contract.salariesByYear[0].incentives.unlikely = 1_000_000;
    above.evidence.destinationTeam.salaryBookInputs!.incompleteRosterCharge = {
      ...above.evidence.destinationTeam.salaryBookInputs!
        .incompleteRosterCharge,
      amount: 63_961_001,
    };
    above.evidence.destinationTeam.teamTotalSalary = 143_961_001;
    above.evidence.destinationTeam.teamSalary = 143_961_001;
    above.evidence.destinationTeam.apronTeamSalary = 143_961_001;
    above.evidence.destinationTeam.totals = {
      ...above.evidence.destinationTeam.totals,
      teamSalary: 143_961_001,
      apronTeamSalary: 143_961_001,
      taxSalary: 143_961_001,
    };
    above.evidence = {
      ...above.evidence,
      snapshots: {
        ...above.evidence.snapshots,
        destinationTeam: {
          exists: true,
          digest: mutationSnapshotDigest(above.evidence.destinationTeam),
        },
      },
    };
    const oneCentAbove = computePositiveSignAndTrade(
      above,
      'sat-room-one-cent-above'
    );
    expect(oneCentAbove.success).toBe(false);
    expect(oneCentAbove.error).toMatch(/Room|Salary Cap|salary matching/i);
    expect(oneCentAbove.teamUpdates).toBeUndefined();
  });

  it('fails closed when the independent pre-transaction Team Salary is unavailable', () => {
    const fixture = makeFixture();
    delete fixture.evidence.destinationTeam.teamSalary;
    fixture.evidence.destinationTeam.totals = {
      ...fixture.evidence.destinationTeam.totals,
      teamSalary: null,
    };
    fixture.evidence = {
      ...fixture.evidence,
      snapshots: {
        ...fixture.evidence.snapshots,
        destinationTeam: {
          exists: true,
          digest: mutationSnapshotDigest(fixture.evidence.destinationTeam),
        },
      },
    };

    const result = computePositiveSignAndTrade(
      fixture,
      'sat-missing-team-salary'
    );

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Team Salary|salary path|exact input/i);
    expect(result.teamUpdates).toBeUndefined();
  });

  it('accepts three non-option Seasons plus an unprotected fourth Option Year', () => {
    const fixture = makeFixture();
    fixture.contract = {
      ...fixture.contract,
      contractYears: 4,
      years: 4,
      totalValue: 86_000_000,
      salariesByYear: [
        ...fixture.contract.salariesByYear,
        {
          season: '2029-30',
          salary: 23_000_000,
          capHit: 23_000_000,
          guaranteed: false,
          option: 'PO',
          incentives: { likely: 0, unlikely: 0 },
        },
      ],
    };

    const authority = build(fixture);

    expect(authority.contract).toMatchObject({
      contractYears: 4,
      nonOptionYears: 3,
      firstSeasonFullyProtected: true,
    });
    expect(authority.contract.rows[3]).toMatchObject({
      guaranteed: false,
      option: 'PO',
    });
  });

  it('enforces the unauthenticated Higher Max boundary at 25% of the Cap', () => {
    const makeHigherMaximumFixture = () => {
      const fixture = makeFixture();
      const ledger = fixture.evidence.sourceTeam.rightsLedger!;
      const root = ledger.events[0];
      if (root.eventKind !== 'rights-established') {
        throw new Error('fixture requires a rights-establishment root');
      }
      fixture.evidence.sourceTeam.rightsLedger = {
        ...ledger,
        events: [
          {
            ...root,
            amountRecords: root.amountRecords.map((row) =>
              row.kind === 'applicable-maximum-salary'
                ? { ...row, amount: 60_000_000 }
                : row
            ),
          },
        ],
      };
      fixture.evidence = {
        ...fixture.evidence,
        snapshots: {
          ...fixture.evidence.snapshots,
          sourceTeam: {
            exists: true,
            digest: mutationSnapshotDigest(fixture.evidence.sourceTeam),
          },
        },
      };
      return fixture;
    };
    const exact = makeHigherMaximumFixture();
    const ceiling = 41_240_250;
    exact.contract.salariesByYear = exact.contract.salariesByYear.map(
      (row) => ({
        ...row,
        salary: ceiling,
        capHit: ceiling,
      })
    );
    exact.contract.totalValue = ceiling * 3;
    expect(build(exact).salaryTreatment.firstSeasonSalaryPlusUnlikely).toBe(
      ceiling
    );

    const above = makeHigherMaximumFixture();
    above.contract.salariesByYear = above.contract.salariesByYear.map(
      (row) => ({
        ...row,
        salary: ceiling + 1,
        capHit: ceiling + 1,
      })
    );
    above.contract.totalValue = (ceiling + 1) * 3;
    expect(() => build(above)).toThrow(/Higher Max.*unavailable/i);
  });

  it('persists and reloads the two Teams, immutable event, receipt, history, and cross-room books atomically', async () => {
    const fixture = makeFixture();
    const result = computePositiveSignAndTrade(fixture);
    expect(result.success, result.error || '').toBe(true);
    seedSignAndTradePersistenceFixture(fixture);

    const persisted = await persistPositiveSignAndTrade(result);

    expect(persisted.success).toBe(true);
    const data = getAllMockData();
    const source = data.get(`architect_worlds/${WORLD_ID}/teams/ATL`) as Record<
      string,
      unknown
    >;
    const destination = data.get(
      `architect_worlds/${WORLD_ID}/teams/BOS`
    ) as Record<string, unknown>;
    const destinationPlayer = data.get(
      `architect_worlds/${WORLD_ID}/teams/BOS/players/${PLAYER_ID}`
    ) as Record<string, unknown>;
    const receipt = result.metadata?.governedSignAndTradeReceipt;
    expect(persisted.writesSummary?.eventsWritten).toBe(1);
    expect(persisted.event).toMatchObject({
      mutationType: 'executeTrade',
      worldId: WORLD_ID,
      metadata: {
        governedSignAndTradeReceipt: {
          receiptId: receipt?.receiptId,
          verificationStatus: 'complete',
        },
      },
    });
    expect(source.roster).not.toContain(PLAYER_ID);
    expect(destination.roster).toContain(PLAYER_ID);
    expect(destinationPlayer).toMatchObject({
      teamCode: 'BOS',
      contract: {
        contractType: 'Sign & Trade',
        signingTeam: 'ATL',
        signingDate: TRANSACTION_AT,
        salariesByYear: [
          expect.objectContaining({ season: '2026-27', salary: 20_000_000 }),
          expect.objectContaining({ season: '2027-28', salary: 21_000_000 }),
          expect.objectContaining({ season: '2028-29', salary: 22_000_000 }),
        ],
      },
    });
    expect(destination).toMatchObject({
      hardCapLedger: [
        expect.objectContaining({
          entryId: 'sat-operation:hard-cap:BOS',
          restrictionRow: 'C',
          apronLevel: 'FIRST_APRON',
        }),
      ],
      contractEventLedgers: [
        expect.objectContaining({
          ledgerId: receipt?.contractLedgerId,
          ledgerVersion: 1,
        }),
      ],
    });
    expect(source).not.toHaveProperty('teamTotalSalary');
    expect(source).not.toHaveProperty('teamSalary');
    expect(source).not.toHaveProperty('apronTeamSalary');
    expect(source).not.toHaveProperty('taxSalary');
    expect(destination).not.toHaveProperty('teamTotalSalary');
    expect(destination).not.toHaveProperty('teamSalary');
    expect(destination).not.toHaveProperty('apronTeamSalary');
    expect(destination).not.toHaveProperty('taxSalary');
    receipt?.salaryBooks.forEach((book) => {
      const reloaded = data.get(
        `architect_worlds/${WORLD_ID}/teams/${book.teamId}`
      ) as { totals?: Record<string, unknown> };
      expect(reloaded.totals).toMatchObject({
        teamSalary: book.teamSalary,
        apronTeamSalary: book.apronTeamSalary,
        taxSalary: book.taxSalary,
      });
    });
    const history = normalizeWorldEventsForTeamHistory(
      [persisted.event as unknown as Record<string, unknown>],
      'BOS'
    );
    expect(history).toHaveLength(1);
    expect(history[0].detailSections).toContainEqual(
      expect.objectContaining({
        title: 'Trade Receipt',
        lines: expect.arrayContaining([
          `Receipt: ${receipt?.receiptId}`,
          'BYC: Applied',
          'Persistence verification: Complete',
        ]),
      })
    );
  });

  it('rejects a partial two-Team commit before every write', async () => {
    const fixture = makeFixture();
    const result = computePositiveSignAndTrade(fixture, 'sat-partial-team');
    expect(result.success).toBe(true);
    seedSignAndTradePersistenceFixture(fixture);
    const before = retainedMockWorld();

    const persisted = await persistPositiveSignAndTrade(
      result,
      (result.teamUpdates || []).filter((team) => team.teamCode === 'ATL')
    );

    expect(persisted.success).toBe(false);
    if (!persisted.success) expect(persisted.error).toMatch(/exactly.*Teams/i);
    expect(retainedMockWorld()).toBe(before);
  });

  it.each([
    {
      label: 'destination Team snapshot',
      mutate: (fixture: ReturnType<typeof makeFixture>) =>
        seedMockData(`architect_worlds/${WORLD_ID}/teams/BOS`, {
          ...fixture.evidence.destinationTeam,
          concurrentMutation: true,
        }),
    },
    {
      label: 'source player override creation',
      mutate: () =>
        seedMockData(
          `architect_worlds/${WORLD_ID}/teams/ATL/players/${PLAYER_ID}`,
          { playerId: PLAYER_ID, concurrentMutation: true }
        ),
    },
    {
      label: 'destination player override creation',
      mutate: () =>
        seedMockData(
          `architect_worlds/${WORLD_ID}/teams/BOS/players/${PLAYER_ID}`,
          { playerId: PLAYER_ID, concurrentMutation: true }
        ),
    },
    {
      label: 'season history evidence',
      mutate: (fixture: ReturnType<typeof makeFixture>) =>
        seedMockData(
          `architect_worlds/${WORLD_ID}/seasonHistory/${fixture.histories[1].historyId}`,
          { ...fixture.histories[1], concurrentMutation: true }
        ),
    },
  ])('rejects stale $label with no partial write', async ({ mutate }) => {
    const fixture = makeFixture();
    const result = computePositiveSignAndTrade(fixture, 'sat-stale');
    expect(result.success).toBe(true);
    seedSignAndTradePersistenceFixture(fixture);
    mutate(fixture);
    const before = retainedMockWorld();

    const persisted = await persistPositiveSignAndTrade(result);

    expect(persisted.success).toBe(false);
    if (!persisted.success)
      expect(persisted.error).toMatch(/changed|snapshot/i);
    expect(retainedMockWorld()).toBe(before);
  });

  it('rejects stripped governed metadata before every write', async () => {
    const fixture = makeFixture();
    const result = computePositiveSignAndTrade(fixture, 'sat-stripped');
    expect(result.success).toBe(true);
    seedSignAndTradePersistenceFixture(fixture);
    const before = retainedMockWorld();
    const stripped = {
      ...result,
      playerUpdates: [],
      metadata: { ...(result.metadata || {}) },
    };
    delete stripped.metadata.governedSignAndTradeAuthority;
    delete stripped.metadata.governedSignAndTradeReceipt;

    const persisted = await persistPositiveSignAndTrade(stripped);

    expect(persisted.success).toBe(false);
    if (!persisted.success) {
      expect(persisted.error).toMatch(/matching authority.*complete receipt/i);
    }
    expect(retainedMockWorld()).toBe(before);
  });

  it('does not classify a historical S&T Contract as a new governed transaction', async () => {
    const fixture = makeFixture();
    const result = computePositiveSignAndTrade(
      fixture,
      'sat-historical-contract-boundary'
    );
    expect(result.success).toBe(true);
    seedSignAndTradePersistenceFixture(fixture);
    (result.teamUpdates || []).forEach(({ teamCode, team }) => {
      seedMockData(`architect_worlds/${WORLD_ID}/teams/${teamCode}`, team);
    });
    const ordinaryTradeResult: ReturnType<typeof computePositiveSignAndTrade> =
      {
        ...result,
        playerUpdates: [],
        metadata: {
          type: 'trade' as const,
          teamsInvolved: ['ATL', 'BOS'],
          playersTraded: [PLAYER_ID],
          timestamp: Date.parse(TRANSACTION_AT),
        },
      };
    delete ordinaryTradeResult._requiresGovernedSignAndTradePersistence;

    const persisted = await persistPositiveSignAndTrade(ordinaryTradeResult);

    expect(persisted.success).toBe(true);
  });

  it('rejects a duplicate transaction ledger with no partial write', async () => {
    const fixture = makeFixture();
    const first = computePositiveSignAndTrade(fixture, 'sat-replay');
    expect(first.success).toBe(true);
    const destination = first.teamUpdates?.find(
      (team) => team.teamCode === 'BOS'
    )?.team;
    const replayLedger = destination?.contractEventLedgers?.[0];
    if (!replayLedger) throw new Error('positive fixture must author a ledger');
    fixture.evidence.destinationTeam.contractEventLedgers = [replayLedger];
    fixture.evidence = {
      ...fixture.evidence,
      snapshots: {
        ...fixture.evidence.snapshots,
        destinationTeam: {
          exists: true,
          digest: mutationSnapshotDigest(fixture.evidence.destinationTeam),
        },
      },
    };
    const replay = computePositiveSignAndTrade(fixture, 'sat-replay');
    expect(replay.success).toBe(true);
    seedSignAndTradePersistenceFixture(fixture);
    const before = retainedMockWorld();

    const persisted = await persistPositiveSignAndTrade(replay);

    expect(persisted.success).toBe(false);
    if (!persisted.success)
      expect(persisted.error).toMatch(/duplicate|replayed/i);
    expect(retainedMockWorld()).toBe(before);
  });

  it.each([
    [
      'wrong world',
      (f: ReturnType<typeof makeFixture>) => {
        f.evidence = { ...f.evidence, worldId: 'wrong-world' };
      },
    ],
    [
      'wrong source team',
      (f: ReturnType<typeof makeFixture>) => {
        f.evidence = { ...f.evidence, sourceTeamId: 'BOS' };
      },
    ],
    [
      'wrong destination team',
      (f: ReturnType<typeof makeFixture>) => {
        f.evidence = { ...f.evidence, destinationTeamId: 'NYK' };
      },
    ],
    [
      'wrong player',
      (f: ReturnType<typeof makeFixture>) => {
        f.evidence = { ...f.evidence, playerId: 'wrong-player' };
      },
    ],
    [
      'wrong season',
      (f: ReturnType<typeof makeFixture>) => {
        f.evidence.worldMetadata.currentSeason = '2025-26';
        f.evidence.worldMetadata.currentYear = 2026;
        f.evidence = {
          ...f.evidence,
          snapshots: {
            ...f.evidence.snapshots,
            worldMetadata: {
              exists: true,
              digest: mutationSnapshotDigest(f.evidence.worldMetadata),
            },
          },
        };
      },
    ],
    [
      'wrong date',
      (f: ReturnType<typeof makeFixture>) => {
        f.proposal = {
          ...f.proposal,
          transactionAt: '2026-07-16T12:00:00-04:00',
        };
      },
    ],
    [
      'transaction before Season Advance',
      (f: ReturnType<typeof makeFixture>) => {
        f.evidence.worldMetadata.asOfDate = '2026-07-01';
        f.proposal = {
          ...f.proposal,
          transactionAt: '2026-07-01T00:00:00-04:00',
        };
        f.evidence = {
          ...f.evidence,
          snapshots: {
            ...f.evidence.snapshots,
            worldMetadata: {
              exists: true,
              digest: mutationSnapshotDigest(f.evidence.worldMetadata),
            },
          },
        };
      },
    ],
    [
      'moratorium',
      (f: ReturnType<typeof makeFixture>) => {
        f.evidence.worldMetadata.asOfDate = '2026-07-03';
        f.proposal = {
          ...f.proposal,
          transactionAt: '2026-07-03T12:00:00-04:00',
        };
      },
    ],
    [
      'partial history set',
      (f: ReturnType<typeof makeFixture>) => {
        f.evidence = { ...f.evidence, seasonHistories: f.histories.slice(1) };
      },
    ],
    [
      'missing prior roster evidence',
      (f: ReturnType<typeof makeFixture>) => {
        f.histories[0] = { ...f.histories[0], finalRoster: [] };
        f.evidence = { ...f.evidence, seasonHistories: f.histories };
      },
    ],
    [
      'conflicting non-source history',
      (f: ReturnType<typeof makeFixture>) => {
        const changedRoster = [
          ...f.histories[1].finalRoster,
          { playerId: 'unmanifested-player' },
        ];
        f.histories[1] = {
          ...f.histories[1],
          finalRoster: changedRoster,
          finalRosterDigest: mutationSnapshotDigest(changedRoster),
        };
        f.evidence = { ...f.evidence, seasonHistories: f.histories };
      },
    ],
    [
      'wrong prior team',
      (f: ReturnType<typeof makeFixture>) => {
        const source = f.histories[0];
        const target = f.histories[1];
        f.histories[0] = { ...source, finalRoster: [] };
        f.histories[1] = { ...target, finalRoster: source.finalRoster };
        f.evidence = { ...f.evidence, seasonHistories: f.histories };
      },
    ],
    [
      'duplicate prior roster identity',
      (f: ReturnType<typeof makeFixture>) => {
        f.histories[1] = {
          ...f.histories[1],
          finalRoster: [
            ...f.histories[1].finalRoster,
            f.histories[0].finalRoster[0],
          ],
        };
        f.evidence = { ...f.evidence, seasonHistories: f.histories };
      },
    ],
    [
      'missing local snapshot',
      (f: ReturnType<typeof makeFixture>) => {
        f.evidence = {
          ...f.evidence,
          snapshots: {
            ...f.evidence.snapshots,
            destinationTeam: { exists: false, digest: null },
          },
        };
      },
    ],
    [
      'stale rights source',
      (f: ReturnType<typeof makeFixture>) => {
        const ledger = f.evidence.sourceTeam.rightsLedger!;
        const root = ledger.events[0];
        f.evidence.sourceTeam.rightsLedger = {
          ...ledger,
          events:
            root.eventKind === 'rights-established'
              ? [
                  {
                    ...root,
                    amountRecords: root.amountRecords.map((row, index) =>
                      index === 0
                        ? {
                            ...row,
                            source: {
                              ...row.source,
                              recordStatus: 'superseded' as const,
                            },
                          }
                        : row
                    ),
                  },
                ]
              : [root],
        };
        f.evidence = {
          ...f.evidence,
          snapshots: {
            ...f.evidence.snapshots,
            sourceTeam: {
              exists: true,
              digest: mutationSnapshotDigest(f.evidence.sourceTeam),
            },
          },
        };
      },
    ],
    [
      'pending Offer Sheet',
      (f: ReturnType<typeof makeFixture>) => {
        f.evidence.sourceTeam.incomingOfferSheets = [{ playerId: PLAYER_ID }];
        f.evidence = {
          ...f.evidence,
          snapshots: {
            ...f.evidence.snapshots,
            sourceTeam: {
              exists: true,
              digest: mutationSnapshotDigest(f.evidence.sourceTeam),
            },
          },
        };
      },
    ],
    [
      'conflicting source player override',
      (f: ReturnType<typeof makeFixture>) => {
        f.evidence = {
          ...f.evidence,
          sourcePlayerDocument: {
            playerId: PLAYER_ID,
            teamCode: 'ATL',
            contract: { conflicting: true },
          },
          snapshots: {
            ...f.evidence.snapshots,
            sourcePlayer: {
              exists: true,
              digest: mutationSnapshotDigest({
                playerId: PLAYER_ID,
                teamCode: 'ATL',
                contract: { conflicting: true },
              }),
            },
          },
        };
      },
    ],
    [
      'pre-existing destination player override',
      (f: ReturnType<typeof makeFixture>) => {
        const destinationPlayer = {
          playerId: PLAYER_ID,
          teamCode: 'BOS',
          contract: null,
        };
        f.evidence = {
          ...f.evidence,
          destinationPlayerDocument: destinationPlayer,
          snapshots: {
            ...f.evidence.snapshots,
            destinationPlayer: {
              exists: true,
              digest: mutationSnapshotDigest(destinationPlayer),
            },
          },
        };
      },
    ],
    [
      'future extension',
      (f: ReturnType<typeof makeFixture>) => {
        f.evidence.sourceTeam.players[0].futureContract = {
          salariesByYear: [
            { season: '2027-28', salary: 25_000_000, capHit: 25_000_000 },
          ],
        };
        f.evidence = {
          ...f.evidence,
          snapshots: {
            ...f.evidence.snapshots,
            sourceTeam: {
              exists: true,
              digest: mutationSnapshotDigest(f.evidence.sourceTeam),
            },
          },
        };
      },
    ],
    [
      'active current-Season Contract',
      (f: ReturnType<typeof makeFixture>) => {
        f.evidence.sourceTeam.players[0].contract = {
          salariesByYear: [
            {
              season: '2026-27',
              salary: 1,
              capHit: 1,
              guaranteed: true,
            },
          ],
        };
        f.evidence = {
          ...f.evidence,
          snapshots: {
            ...f.evidence.snapshots,
            sourceTeam: {
              exists: true,
              digest: mutationSnapshotDigest(f.evidence.sourceTeam),
            },
          },
        };
      },
    ],
    [
      'forged destination receipt',
      (f: ReturnType<typeof makeFixture>) => {
        f.evidence = {
          ...f.evidence,
          snapshots: {
            ...f.evidence.snapshots,
            destinationTeam: {
              exists: true,
              digest: mutationSnapshotDigest({ forged: true }),
            },
          },
        };
      },
    ],
    [
      'incomplete contract',
      (f: ReturnType<typeof makeFixture>) => {
        f.contract = {
          ...f.contract,
          contractYears: 2,
          years: 2,
          salariesByYear: f.contract.salariesByYear.slice(0, 2),
        };
      },
    ],
    [
      'conflicting protection',
      (f: ReturnType<typeof makeFixture>) => {
        f.contract.salariesByYear[0].guaranteed = false;
      },
    ],
    [
      'unsupported raise',
      (f: ReturnType<typeof makeFixture>) => {
        f.contract.salariesByYear[1].salary = 30_000_000;
        f.contract.salariesByYear[1].capHit = 30_000_000;
      },
    ],
    [
      'barred signing exception',
      (f: ReturnType<typeof makeFixture>) => {
        f.contract = {
          ...f.contract,
          signedUsing: 'Non-Taxpayer MLE',
        } as typeof f.contract;
      },
    ],
    [
      'wrong contract type',
      (f: ReturnType<typeof makeFixture>) => {
        f.contract = {
          ...f.contract,
          contractType: 'Standard',
        };
      },
    ],
    [
      'conflicting contract summary',
      (f: ReturnType<typeof makeFixture>) => {
        f.contract.totalValue += 1;
      },
    ],
    [
      'wrong-year contract',
      (f: ReturnType<typeof makeFixture>) => {
        f.contract.salariesByYear[0].season = '2025-26';
      },
    ],
    [
      'missing player consent',
      (f: ReturnType<typeof makeFixture>) => {
        f.proposal = {
          ...f.proposal,
          playerConsentConfirmed: false,
        } as typeof f.proposal;
      },
    ],
    [
      'unsupported Higher Max claim',
      (f: ReturnType<typeof makeFixture>) => {
        f.proposal = {
          ...f.proposal,
          higherMaxStatus: 'criteria-met',
        } as typeof f.proposal;
      },
    ],
  ])('fails closed before mutation on %s', (_label, mutate) => {
    const fixture = makeFixture();
    mutate(fixture);
    expect(() => build(fixture)).toThrow();
  });

  it('fails closed on a physical examination recorded after the transaction', () => {
    const fixture = makeFixture();
    fixture.proposal = {
      ...fixture.proposal,
      physicalExam: {
        status: 'passed',
        examRecordId: 'exam-1',
        examRecordVersion: 1,
        examinedAt: '2026-07-16T12:00:00-04:00',
        physicianId: 'physician-1',
        designatedByTeam: 'BOS',
        nbaProcedureVersion: '2026-v1',
        result: 'PASS',
      },
    } as typeof fixture.proposal;
    expect(() => build(fixture)).toThrow(/cannot occur after/i);
  });

  it('fails closed when the physical examination was not designated by the assignee', () => {
    const fixture = makeFixture();
    fixture.proposal = {
      ...fixture.proposal,
      physicalExam: {
        status: 'passed',
        examRecordId: 'exam-wrong-team',
        examRecordVersion: 1,
        examinedAt: '2026-07-14T12:00:00-04:00',
        physicianId: 'physician-1',
        designatedByTeam: 'ATL',
        nbaProcedureVersion: '2026-v1',
        result: 'PASS',
      },
    } as typeof fixture.proposal;
    expect(() => build(fixture)).toThrow(/assignee Team must designate/i);
  });

  it('fails closed on a plausible examination assertion without an authenticated saved-world record', () => {
    const fixture = makeFixture();
    fixture.proposal = {
      ...fixture.proposal,
      physicalExam: {
        status: 'passed',
        examRecordId: 'exam-unpersisted',
        examRecordVersion: 1,
        examinedAt: '2026-07-14T12:00:00-04:00',
        physicianId: 'physician-1',
        designatedByTeam: 'BOS',
        nbaProcedureVersion: '2026-v1',
        result: 'PASS',
      },
    } as typeof fixture.proposal;
    expect(() => build(fixture)).toThrow(
      /authenticated assignee-designated examination record/i
    );
  });

  it('fails closed when authored unlikely bonuses conflict with the proposal', () => {
    const fixture = makeFixture();
    fixture.proposal = {
      ...fixture.proposal,
      firstSeasonUnlikelyBonuses: 1_000_000,
    };
    expect(() => build(fixture)).toThrow(
      /authenticated first-season unlikely bonus/i
    );
  });
});
