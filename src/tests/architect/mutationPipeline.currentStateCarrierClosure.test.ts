import { describe, expect, it } from 'vitest';
import {
  computeWorldMutation,
  type ArchitectMutationContract,
  type ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';

const FIXED_TIMESTAMP = Date.parse('2026-04-11T16:00:00.000Z');
const FIXED_TIMESTAMP_ISO = '2026-04-11T16:00:00.000Z';
const SEASON_ID = '2025-26';

function makeContract(
  salary: number,
  overrides: Record<string, unknown> = {}
): ArchitectMutationContract & Record<string, unknown> {
  return {
    contractType: 'Standard',
    signingTeam: 'LAL',
    signingDate: '2025-07-01',
    salariesByYear: [
      {
        season: SEASON_ID,
        salary,
        capHit: salary,
        guaranteed: true,
        guaranteedAmount: salary,
      },
    ],
    birdRights: { status: 'Full', yearsOfService: 5 },
    freeAgency: { type: 'UFA', year: 2027 },
    totalValue: salary,
    years: 1,
    contractYears: 1,
    ...overrides,
  } as ArchitectMutationContract & Record<string, unknown>;
}

function makePlayer(
  id: string,
  name: string,
  salary: number,
  teamCode: string | null,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    player_id: id,
    id,
    playerId: id,
    name,
    displayName: name,
    playerName: name,
    teamCode,
    teamName: teamCode ? `Team ${teamCode}` : null,
    salary,
    currentSalary: salary,
    contract: makeContract(salary, { signingTeam: teamCode }),
    bio: {
      displayName: name,
      playerId: id,
      position: 'SF',
      yearsExperience: 4,
      display: {
        team: teamCode,
        teamId: teamCode,
        freeAgentYear: 2026,
        freeAgentType: 'UFA',
      },
    },
    ...overrides,
  };
}

function makeTeam(
  teamCode: string,
  players: Array<Record<string, unknown>>,
  overrides: Partial<ArchitectMutationTeamRecord> = {}
): ArchitectMutationTeamRecord {
  const totalSalary = players.reduce((sum, player) => {
    const contract = player.contract as
      | { salariesByYear?: Array<{ capHit?: number | string | null }> }
      | undefined;

    return (
      sum +
      Number(
        contract?.salariesByYear?.[0]?.capHit ??
          player.currentSalary ??
          player.salary ??
          0
      )
    );
  }, 0);

  return {
    id: teamCode.toLowerCase(),
    teamCode,
    teamName: `Team ${teamCode}`,
    roster: players.map((player) => String(player.player_id || player.id)),
    players,
    capHolds: [],
    deadCap: [],
    tradeExceptions: [],
    exceptionHistory: [],
    offerSheets: [],
    incomingOfferSheets: [],
    draftPicks: [],
    entitlementIds: [],
    cashLedger: { totalOut: 0 },
    exceptions: { mle: null, bae: null, tpe: [] },
    totals: {
      totalSalary,
      capHit: totalSalary,
      totalCapAllocations: totalSalary,
      rosterCount: players.length,
      isHardCapped: false,
    },
    source: {
      provider: 'test-suite',
      type: 'test',
      generatedAt: FIXED_TIMESTAMP_ISO,
    },
    ...overrides,
  } as ArchitectMutationTeamRecord;
}

describe('mutationPipeline current-state carrier closure', () => {
  it('keeps base-team compute working while preserved round-trip fields survive the narrowed carrier lane', () => {
    const initialTradeException = {
      id: 'tpe_lal_1',
      amount: 1_500_000,
      remainingAmount: 1_500_000,
      totalAmount: 1_500_000,
      createdSeason: 2026,
      createdFrom: 'Trade',
      expiresOn: '2026-07-01',
    };
    const initialExceptionHistory = [
      {
        id: 'hist_1',
        type: 'created',
        createdAt: FIXED_TIMESTAMP_ISO,
        legacyMeta: { keep: true },
      },
    ];
    const carriedPick = {
      year: 2028,
      round: 1,
      pick: null,
      owner: 'LAL',
      metadata: { source: 'test-pick' },
    };
    const team = makeTeam('LAL', [], {
      tradeExceptions: [initialTradeException],
      exceptionHistory: initialExceptionHistory,
      draftPicks: [carriedPick],
      entitlementIds: ['ent_lal_keep'],
      cashLedger: { totalOut: 250_000 },
      exceptions: {
        room: {
          enabled: true,
          totalAmount: 4_500_000,
          remainingAmount: 4_500_000,
          usedAmount: 0,
        },
        tpe: [{ id: 'canonical_tpe_keep', amount: 750_000 }],
      },
    });

    const result = computeWorldMutation({
      mutationType: 'setExceptions',
      payload: {
        teamCode: 'LAL',
        exceptions: {
          room: {
            enabled: true,
            totalAmount: 6_000_000,
            remainingAmount: 6_000_000,
            usedAmount: 0,
          },
        },
        exceptionChanges: ['Room Exception reset'],
      },
      currentState: {
        team: {
          ...team,
          legacyBaseCarrier: { shouldDrop: true },
        } as unknown as ArchitectMutationTeamRecord,
        teamCode: 'LAL',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    expect(updatedTeam?.exceptions).toMatchObject({
      room: {
        enabled: true,
        totalAmount: 6_000_000,
        remainingAmount: 6_000_000,
        usedAmount: 0,
      },
    });
    expect(updatedTeam?.exceptions?.tpe).toEqual([
      { id: 'canonical_tpe_keep', amount: 750_000 },
    ]);
    expect(updatedTeam?.tradeExceptions).toEqual([
      expect.objectContaining({
        id: 'tpe_lal_1',
        amount: 1_500_000,
        remainingAmount: 1_500_000,
      }),
    ]);
    expect(updatedTeam?.exceptionHistory).toEqual(initialExceptionHistory);
    expect(updatedTeam?.draftPicks).toEqual([carriedPick]);
    expect(updatedTeam?.entitlementIds).toEqual(['ent_lal_keep']);
    expect(updatedTeam?.cashLedger).toMatchObject({ totalOut: 250_000 });
    expect(updatedTeam).not.toHaveProperty('legacyBaseCarrier');
  });

  it('keeps direct-player signing compute working after the narrowed player ingress is normalized', () => {
    const team = makeTeam('LAL', [], {
      tradeExceptions: [
        {
          id: 'tpe_keep_for_roundtrip',
          amount: 900_000,
          remainingAmount: 900_000,
          totalAmount: 900_000,
          createdSeason: 2026,
        },
      ],
      exceptionHistory: [
        {
          id: 'hist_signing_keep',
          type: 'preserved',
          createdAt: FIXED_TIMESTAMP_ISO,
        },
      ],
      draftPicks: [
        {
          year: 2029,
          round: 1,
          pick: null,
          owner: 'LAL',
        },
      ],
      entitlementIds: ['ent_lal_signing_keep'],
      cashLedger: { totalOut: 400_000 },
      exceptions: {
        room: {
          enabled: true,
          totalAmount: 12_000_000,
          remainingAmount: 12_000_000,
          usedAmount: 0,
        },
        tpe: [],
      },
    });
    const freeAgent = makePlayer('fa_carrier_1', 'Carrier Free Agent', 0, null, {
      displayName: undefined,
      bio: {
        displayName: 'Carrier Free Agent Bio',
        playerId: 'fa_carrier_1',
        position: 'SG',
        yearsExperience: 6,
      },
      representation: {
        agent: 'Carrier Agent',
        agency: 'Carrier Agency',
      },
      source: {
        provider: 'legacy-import',
        playerPageUrl: '/players/fa_carrier_1',
        generatedAt: FIXED_TIMESTAMP_ISO,
        legacySourceBlob: 'drop-me',
      },
      signedDate: '2025-07-02',
      lastUpdated: FIXED_TIMESTAMP_ISO,
      version: 'v1',
      isTwoWay: false,
      legacyPlayerIngressBlob: { shouldDrop: true },
    });

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_carrier_1',
        contract: makeContract(3_000_000, {
          signingTeam: null,
          signingDate: null,
          totalValue: 3_000_000,
        }) as ArchitectMutationContract,
        signedUsing: 'Room Exception',
      },
      currentState: {
        team,
        player: freeAgent,
        teamCode: 'LAL',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    expect(updatedTeam?.roster).toContain('fa_carrier_1');
    expect(
      updatedTeam?.players?.some(
        (player) => String(player.player_id || player.id) === 'fa_carrier_1'
      )
    ).toBe(true);
    expect(updatedTeam?.exceptions).toMatchObject({
      room: {
        usedAmount: 3_000_000,
        remainingAmount: 9_000_000,
      },
    });
    expect(updatedTeam?.tradeExceptions).toEqual([
      expect.objectContaining({
        id: 'tpe_keep_for_roundtrip',
        amount: 900_000,
      }),
    ]);
    expect(updatedTeam?.exceptionHistory).toEqual([
      expect.objectContaining({ id: 'hist_signing_keep' }),
    ]);
    expect(updatedTeam?.draftPicks).toEqual([
      expect.objectContaining({ year: 2029, round: 1, owner: 'LAL' }),
    ]);
    expect(updatedTeam?.entitlementIds).toEqual(['ent_lal_signing_keep']);
    expect(updatedTeam?.cashLedger).toMatchObject({ totalOut: 400_000 });

    const updatedPlayer = result.playerUpdates?.[0]?.player;
    expect(updatedPlayer?.teamCode).toBe('LAL');
    expect(updatedPlayer?.teamName).toBe('Team LAL');
    expect(updatedPlayer?.contract?.signingTeam).toBe('LAL');
    expect(updatedPlayer?.contract?.signingDate).toBe(
      new Date(FIXED_TIMESTAMP).toISOString()
    );
    expect(updatedPlayer?.representation).toEqual({
      agent: 'Carrier Agent',
      agency: 'Carrier Agency',
    });
    expect(updatedPlayer?.source).toMatchObject({
      provider: 'legacy-import',
      playerPageUrl: '/players/fa_carrier_1',
      generatedAt: FIXED_TIMESTAMP_ISO,
    });
    expect(updatedPlayer?.source).not.toHaveProperty('legacySourceBlob');
    expect(updatedPlayer?.signedDate).toBe('2025-07-02');
    expect(updatedPlayer?.lastUpdated).toBe(FIXED_TIMESTAMP_ISO);
    expect(updatedPlayer?.version).toBe('v1');
    expect(updatedPlayer?.isTwoWay).toBe(false);
    expect(updatedPlayer).not.toHaveProperty('legacyPlayerIngressBlob');
  });

  it('tolerates mixed raw ingress only at the outer boundary and emits normalized observable state', () => {
    const team = makeTeam(
      'BOS',
      [],
      {
        capHolds: [
          {
            playerId: 'fa_compat',
            playerName: 'Compat Free Agent',
            amount: '5000000',
            type: 'Bird rights cap hold',
            season: SEASON_ID,
            active: true,
            isSigned: false,
            compatBag: { shouldDrop: true },
          },
        ],
        offerSheets: [
          {
            id: 'sheet_keep',
            playerId: 'other_player',
            playerName: 'Other Player',
            offeringTeamCode: 'BOS',
            homeTeamCode: 'DAL',
            status: 'PENDING_MATCH',
            seasonKey: SEASON_ID,
            year: '2026',
            contractYears: '2',
            totalValue: '7000000',
            salariesByYear: [
              {
                season: SEASON_ID,
                salary: '3500000',
                guaranteed: true,
                compatRow: { shouldDrop: true },
              },
            ],
            compatBag: { shouldDrop: true },
          },
        ],
        draftPicks: [
          {
            year: 2030,
            round: 2,
            pick: null,
            owner: 'BOS',
          },
        ],
        entitlementIds: ['ent_bos_keep'],
        cashLedger: { totalOut: 150_000 },
      } as unknown as Partial<ArchitectMutationTeamRecord>
    );
    const player = makePlayer('fa_compat', 'Compat Free Agent', 0, null, {
      source: {
        provider: 'legacy-import',
        playerPageUrl: '/players/fa_compat',
        legacyTag: 'keep-me',
      },
      legacyPlayerIngressBlob: { shouldDrop: true },
    });

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'BOS',
        playerId: 'fa_compat',
        contract: makeContract(5_000_000, {
          years: 2,
          contractYears: 2,
          totalValue: 10_000_000,
        }) as ArchitectMutationContract,
        signedUsing: 'Cap Space',
      },
      currentState: {
        team: {
          ...team,
          legacyTeamIngressBlob: { shouldDrop: true },
        } as unknown as ArchitectMutationTeamRecord,
        player,
        teamCode: 'BOS',
      },
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    expect(result.success).toBe(true);

    const updatedTeam = result.teamUpdates?.[0]?.team;
    const updatedPlayer = result.playerUpdates?.[0]?.player;

    expect(updatedTeam?.capHolds).toHaveLength(0);
    expect(updatedTeam?.offerSheets?.[0]).not.toHaveProperty('compatBag');
    expect(updatedTeam?.offerSheets?.[0]?.salariesByYear?.[0]).not.toHaveProperty(
      'compatRow'
    );
    expect(updatedTeam?.draftPicks).toEqual([
      expect.objectContaining({ year: 2030, round: 2, owner: 'BOS' }),
    ]);
    expect(updatedTeam?.entitlementIds).toEqual(['ent_bos_keep']);
    expect(updatedTeam?.cashLedger).toMatchObject({ totalOut: 150_000 });
    expect(updatedTeam).not.toHaveProperty('legacyTeamIngressBlob');
    expect(updatedPlayer?.source).toMatchObject({
      provider: 'legacy-import',
      playerPageUrl: '/players/fa_compat',
    });
    expect(updatedPlayer?.source).not.toHaveProperty('legacyTag');
    expect(updatedPlayer).not.toHaveProperty('legacyPlayerIngressBlob');
  });
});
