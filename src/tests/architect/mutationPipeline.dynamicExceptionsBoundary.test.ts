import { describe, expect, it } from 'vitest';
import {
  computeWorldMutation,
  type ArchitectMutationContract,
  type ArchitectMutationTeamRecord,
} from '@/features/architect/utils/mutationPipeline';

type ComputeArgs = Parameters<typeof computeWorldMutation>[0];
type CurrentStateFor<TMutationType extends ComputeArgs['mutationType']> =
  Extract<ComputeArgs, { mutationType: TMutationType }>['currentState'];
type SignFreeAgentCurrentState = CurrentStateFor<'signFreeAgent'>;
type SetExceptionsCurrentState = CurrentStateFor<'setExceptions'>;
type ComputeResult = ReturnType<typeof computeWorldMutation>;

const FIXED_TIMESTAMP = Date.parse('2026-04-11T18:00:00.000Z');
const SEASON_ID = '2025-26';

function makeContract(
  salary: number,
  overrides: Record<string, unknown> = {}
): ArchitectMutationContract & Record<string, unknown> {
  return {
    contractType: 'Standard',
    totalValue: salary,
    years: 1,
    contractYears: 1,
    salariesByYear: [
      {
        season: SEASON_ID,
        salary,
        capHit: salary,
        guaranteed: true,
        guaranteedAmount: salary,
      },
    ],
    ...overrides,
  } as ArchitectMutationContract & Record<string, unknown>;
}

function makePlayer(
  id: string,
  name: string
): Record<string, unknown> {
  return {
    player_id: id,
    id,
    playerId: id,
    name,
    displayName: name,
    playerName: name,
    teamCode: null,
    teamName: null,
    contract: null,
    bio: {
      displayName: name,
      playerId: id,
      position: 'G',
      yearsExperience: 3,
    },
  };
}

function makeTeam(
  overrides: Record<string, unknown> = {}
): ArchitectMutationTeamRecord & Record<string, unknown> {
  return {
    id: 'lal',
    teamCode: 'LAL',
    teamName: 'Los Angeles Lakers',
    roster: [],
    players: [],
    capHolds: [],
    deadCap: [],
    tradeExceptions: [],
    exceptionHistory: [],
    offerSheets: [],
    incomingOfferSheets: [],
    draftPicks: [],
    entitlementIds: [],
    cashLedger: { totalOut: 0 },
    exceptions: {},
    totals: {
      totalSalary: 0,
      capHit: 0,
      totalCapAllocations: 0,
      rosterCount: 0,
      isHardCapped: false,
    },
    ...overrides,
  } as ArchitectMutationTeamRecord & Record<string, unknown>;
}

function expectUpdatedTeam(
  result: ComputeResult
): ArchitectMutationTeamRecord & Record<string, unknown> {
  expect(result.success).toBe(true);

  const team = (
    result as {
      teamUpdates?: Array<{ team?: ArchitectMutationTeamRecord | null }>;
    }
  ).teamUpdates?.[0]?.team;

  expect(team).toBeDefined();
  return team as ArchitectMutationTeamRecord & Record<string, unknown>;
}

function toCurrentState(
  team: Record<string, unknown>,
  player?: Record<string, unknown>
): SignFreeAgentCurrentState {
  return {
    team: team as SignFreeAgentCurrentState['team'],
    player: player as SignFreeAgentCurrentState['player'],
    teamCode: 'LAL',
  };
}

function toTeamOnlyCurrentState(
  team: Record<string, unknown>
): SetExceptionsCurrentState {
  return {
    team: team as SetExceptionsCurrentState['team'],
    teamCode: 'LAL',
  };
}

describe('mutationPipeline dynamic exceptions boundary', () => {
  it('canonicalizes legacy room aliases for signing while preserving non-editable buckets', () => {
    const tpeBucket = [
      {
        id: 'tpe_sign_keep',
        totalAmount: 2_000_000,
        remainingAmount: 2_000_000,
      },
    ];
    const dpeBucket = {
      totalAmount: 1_000_000,
      createdOn: '2026-01-10',
      expiresOn: '2026-03-10',
    };
    const dynamicBucket = { source: 'external-ledger', keep: true };
    const team = makeTeam({
      exceptions: {
        roomMLE: {
          enabled: true,
          totalAmount: 8_000_000,
          usedAmount: 0,
          remainingAmount: 8_000_000,
        },
        dpe: dpeBucket,
        tpe: tpeBucket,
        mechanismSpecificLedger: dynamicBucket,
      },
    });

    const result = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_dynamic_sign',
        contract: makeContract(3_000_000),
        signedUsing: 'Room Exception',
      },
      currentState: toCurrentState(
        team,
        makePlayer('fa_dynamic_sign', 'Dynamic Signing')
      ),
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    const updatedTeam = expectUpdatedTeam(result);
    const exceptions = updatedTeam.exceptions as Record<string, unknown>;

    expect(exceptions).toMatchObject({
      room: {
        enabled: true,
        usedAmount: 3_000_000,
        remainingAmount: 5_000_000,
      },
      dpe: dpeBucket,
      tpe: tpeBucket,
      mechanismSpecificLedger: dynamicBucket,
    });
    expect(exceptions).not.toHaveProperty('roomMLE');
  });

  it('manual setExceptions replaces editable aliases but preserves non-editable dynamic buckets', () => {
    const tpeBucket = [
      {
        id: 'tpe_manual_keep',
        totalAmount: 4_000_000,
        remainingAmount: 4_000_000,
      },
    ];
    const dpeBucket = {
      enabled: true,
      totalAmount: 1_500_000,
      usedAmount: 250_000,
      remainingAmount: 1_250_000,
      seasonKey: SEASON_ID,
    };
    const dynamicBucket = { owner: 'integration', keep: true };
    const team = makeTeam({
      exceptions: {
        mle: {
          enabled: true,
          totalAmount: 12_000_000,
          usedAmount: 0,
          remainingAmount: 12_000_000,
        },
        fullMLE: {
          enabled: true,
          totalAmount: 12_000_000,
          usedAmount: 0,
          remainingAmount: 12_000_000,
        },
        nonTaxpayerMle: {
          enabled: true,
          totalAmount: 12_000_000,
          usedAmount: 0,
          remainingAmount: 12_000_000,
        },
        bae: {
          enabled: true,
          totalAmount: 4_500_000,
          usedAmount: 0,
          remainingAmount: 4_500_000,
        },
        dpe: dpeBucket,
        tpe: tpeBucket,
        customPreservedExceptionBucket: dynamicBucket,
      },
    });

    const result = computeWorldMutation({
      mutationType: 'setExceptions',
      payload: {
        teamCode: 'LAL',
        exceptions: {
          taxpayerMle: {
            enabled: true,
            totalAmount: 6_000_000,
            usedAmount: 1_000_000,
            remainingAmount: 5_000_000,
          },
        } as ComputeArgs['payload']['exceptions'],
        exceptionChanges: ['Taxpayer MLE updated'],
      },
      currentState: toTeamOnlyCurrentState(team),
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    const updatedTeam = expectUpdatedTeam(result);
    const exceptions = updatedTeam.exceptions as Record<string, unknown>;

    expect(exceptions).toMatchObject({
      tpmle: {
        enabled: true,
        totalAmount: 6_000_000,
        usedAmount: 1_000_000,
        remainingAmount: 5_000_000,
      },
      dpe: dpeBucket,
      tpe: tpeBucket,
      customPreservedExceptionBucket: dynamicBucket,
    });
    expect(exceptions).not.toHaveProperty('mle');
    expect(exceptions).not.toHaveProperty('fullMLE');
    expect(exceptions).not.toHaveProperty('nonTaxpayerMle');
    expect(exceptions).not.toHaveProperty('taxpayerMle');
    expect(exceptions).not.toHaveProperty('bae');
  });

  it('round-trips a manual exception update through a later signing mutation', () => {
    const tpeBucket = [
      {
        id: 'tpe_roundtrip_keep',
        totalAmount: 2_500_000,
        remainingAmount: 2_500_000,
      },
    ];
    const dynamicBucket = { producer: 'world-import', keep: true };
    const team = makeTeam({
      exceptions: {
        room: {
          enabled: true,
          totalAmount: 5_000_000,
          usedAmount: 0,
          remainingAmount: 5_000_000,
        },
        dpe: {
          totalAmount: 750_000,
          createdOn: '2026-02-01',
        },
        tpe: tpeBucket,
        importedExceptionRemainder: dynamicBucket,
      },
    });

    const manualResult = computeWorldMutation({
      mutationType: 'setExceptions',
      payload: {
        teamCode: 'LAL',
        exceptions: {
          room: {
            enabled: true,
            totalAmount: 7_000_000,
            usedAmount: 0,
            remainingAmount: 7_000_000,
          },
        },
        exceptionChanges: ['Room Exception reset'],
      },
      currentState: toTeamOnlyCurrentState(team),
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP,
    });

    const manuallyUpdatedTeam = expectUpdatedTeam(manualResult);
    const reloadedTeam = JSON.parse(JSON.stringify(manuallyUpdatedTeam));

    const signingResult = computeWorldMutation({
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: 'LAL',
        playerId: 'fa_dynamic_roundtrip',
        contract: makeContract(2_000_000),
        signedUsing: 'Room Exception',
      },
      currentState: toCurrentState(
        reloadedTeam,
        makePlayer('fa_dynamic_roundtrip', 'Dynamic Roundtrip')
      ),
      seasonId: SEASON_ID,
      timestamp: FIXED_TIMESTAMP + 60_000,
    });

    const signedTeam = expectUpdatedTeam(signingResult);
    const exceptions = signedTeam.exceptions as Record<string, unknown>;

    expect(exceptions).toMatchObject({
      room: {
        totalAmount: 7_000_000,
        usedAmount: 2_000_000,
        remainingAmount: 5_000_000,
      },
      dpe: {
        totalAmount: 750_000,
        createdOn: '2026-02-01',
      },
      tpe: tpeBucket,
      importedExceptionRemainder: dynamicBucket,
    });
  });
});
