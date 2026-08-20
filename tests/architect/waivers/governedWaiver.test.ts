import { describe, expect, it } from 'vitest';

import type { ContractEventLedgerPayload } from '@/schemas/contractEventLedger';
import type {
  ContractSalaryTerm,
  GovernedContractState,
} from '@/schemas/governedContractState';
import {
  GovernedWaiverLifecycleZ,
  type GovernedWaiverLifecycle,
  type GovernedWaiverProposal,
} from '@/schemas/governedWaiver';
/*
 * Keep schema imports above as values: lifecycle-chain validation is part of
 * this workflow's persisted-data boundary, not only a TypeScript shape.
 */
import type { GovernedWaiverPath } from '@/schemas/governedWaiver';
import type { ArchitectMutationTeamRecord } from '@/features/architect/utils/mutationPipeline';
import {
  computeWorldMutation,
  persistWorldMutation,
} from '@/features/architect/utils/mutationPipeline';
import {
  createContractEventLedger,
  toContractEventLedgerPayload,
} from '@/features/architect/utils/contractHistory';
import { deterministicStateDigest } from '@/features/architect/utils/contractSource';
import { resolveGovernedOptionLedgerAuthority } from '@/features/architect/utils/optionDecisions';
import {
  applyGovernedWaiverResult,
  decideGovernedWaiver,
} from '@/features/architect/utils/waivers';
import {
  makeEvent,
  makeResultingState,
} from '../contractHistory/contractHistoryFixtures';
import { mutationSnapshotDigest } from '@/features/architect/utils/mutationPipeline.snapshotDigest';
import {
  createMockWorld,
  getMockTeamSnapshot,
  seedBaseData,
  seedTeamSnapshot,
  seedWorldMetadata,
  type MockTeam,
  type MockWorldMetadata,
} from '../../helpers/architectTestHelpers';
import { getAllMockData, seedMockData } from '../../__mocks__/firebase';

const WORLD_ID = 'world-bze-284';
const TEAM_ID = 'MIA';
const PLAYER_ID = 'player-bze-284';
const CONTRACT_ID = 'contract-bze-284';

const unknownDate = () => ({
  precision: 'unknown' as const,
  value: null,
  rawValue: null,
});

function salaryRow(
  season: string,
  salary: number,
  overrides: Partial<ContractSalaryTerm> = {}
): ContractSalaryTerm {
  return {
    season,
    salary,
    capHit: salary,
    guaranteed: true,
    guaranteedAmount: salary,
    option: null,
    optionHolder: null,
    optionUsed: null,
    optionDecisionDate: unknownDate(),
    optionDecisionDeadline: unknownDate(),
    optionDecisionTerms: null,
    tradeBonus: null,
    incentives: { likely: 0, unlikely: 0, criteriaEvidence: 'known' },
    guaranteeSchedule: [],
    voidedByExtension: false,
    voidedOn: unknownDate(),
    ...overrides,
  };
}

function baselineFor(
  options: {
    rows?: ContractSalaryTerm[];
    totalValue?: number | null;
    completeness?: GovernedContractState['completeness'];
  } = {}
): ContractEventLedgerPayload {
  const rows = options.rows ?? [
    salaryRow('2026-27', 10_000_000),
    salaryRow('2027-28', 12_000_000),
    salaryRow('2028-29', 14_000_000),
  ];
  const base = makeResultingState({
    contractId: CONTRACT_ID,
    contractVersion: 1,
    playerId: PLAYER_ID,
    teamId: TEAM_ID,
    establishmentKind: 'source-establishment',
  });
  const withoutDigest = Object.fromEntries(
    Object.entries(base).filter(([key]) => key !== 'stateDigest')
  ) as Omit<GovernedContractState, 'stateDigest'>;
  const totalValue =
    options.totalValue === undefined
      ? rows.reduce((sum, row) => sum + (row.salary ?? 0), 0)
      : options.totalValue;
  const stateWithoutDigest: Omit<GovernedContractState, 'stateDigest'> = {
    ...withoutDigest,
    terms: {
      ...base.terms,
      signingTeam: TEAM_ID,
      startSeason: rows[0]?.season ?? null,
      endSeason: rows.at(-1)?.season ?? null,
      contractLength: rows.length,
      salaries: rows,
      totalValue,
      averageAnnualValue:
        totalValue === null || rows.length === 0
          ? null
          : totalValue / rows.length,
      guaranteedValue: rows.reduce(
        (sum, row) => sum + (row.guaranteedAmount ?? 0),
        0
      ),
      guaranteedYears: rows.filter((row) => row.guaranteed !== false).length,
    },
    completeness: options.completeness ?? {
      status: 'complete',
      reasons: [],
    },
  };
  const state: GovernedContractState = {
    ...stateWithoutDigest,
    stateDigest: deterministicStateDigest(stateWithoutDigest),
  };
  const root = makeEvent({
    eventId: 'source-bze-284',
    eventKind: 'source-establishment',
    worldId: WORLD_ID,
    contractId: CONTRACT_ID,
    playerId: PLAYER_ID,
    teamId: TEAM_ID,
    executedAt: '2026-07-01T00:00:00-04:00',
    effectiveAt: '2026-07-01T00:00:00-04:00',
    recordedAt: '2026-07-01T00:01:00-04:00',
    predecessorContractVersion: null,
    predecessorEventId: null,
    resultingContractVersion: 1,
    resultingState: state,
  });
  return toContractEventLedgerPayload(
    createContractEventLedger({
      ledgerId: 'contract-ledger-bze-284',
      ledgerVersion: 1,
      events: [root],
    })
  );
}

function proposal(
  path: GovernedWaiverPath,
  overrides: Partial<GovernedWaiverProposal> = {}
): GovernedWaiverProposal {
  const buyout = path === 'buyout';
  return {
    proposalVersion: 1,
    contractId: CONTRACT_ID,
    path,
    leagueReceivedAt: '2026-07-15T12:00:00-04:00',
    writtenStretchElection: path === 'waive-and-stretch',
    buyoutReduction: buyout ? 9_000_000 : 0,
    writtenBuyoutAgreement: buyout,
    playerSignatureRecorded: buyout,
    teamSignatureRecorded: buyout,
    ...overrides,
  };
}

function request(
  path: GovernedWaiverPath,
  options: {
    baseline?: ContractEventLedgerPayload;
    proposal?: GovernedWaiverProposal;
    worldAsOfDate?: string;
    salaryCapAtElection?: number;
    existingLifecycles?: GovernedWaiverLifecycle[];
    existingDeadCap?: Array<{
      amountByYear: Array<{ season: string; amount: number }>;
    }>;
  } = {}
) {
  const inputProposal = options.proposal ?? proposal(path);
  return {
    authority: resolveGovernedOptionLedgerAuthority({
      baselineLedger: options.baseline ?? baselineFor(),
      baselineSalaryCapYear: 2027,
    }),
    existingLifecycles: options.existingLifecycles ?? [],
    existingDeadCap: options.existingDeadCap ?? [],
    worldId: WORLD_ID,
    teamId: TEAM_ID,
    playerId: PLAYER_ID,
    playerName: 'Governed Waiver Player',
    contractId: CONTRACT_ID,
    worldAsOfDate:
      options.worldAsOfDate ?? inputProposal.leagueReceivedAt.slice(0, 10),
    salaryCapAtElection: options.salaryCapAtElection ?? 180_000_000,
    proposal: inputProposal,
    operationId: `operation-${path}`,
    authoringIdentity: 'user-bze-284',
    recordedAt: inputProposal.leagueReceivedAt,
  };
}

function expectSuccess(
  result: ReturnType<typeof decideGovernedWaiver>
): asserts result is Extract<typeof result, { success: true }> {
  expect(result.success, JSON.stringify(result)).toBe(true);
}

describe('governed ordinary unclaimed waiver lifecycle', () => {
  it('uses an exact 48-hour clock through the DST transition and removes the player immediately', () => {
    const input = request('standard', {
      proposal: proposal('standard', {
        leagueReceivedAt: '2027-03-12T12:00:00-05:00',
      }),
    });
    const before = JSON.stringify(input);
    const result = decideGovernedWaiver(input);
    expectSuccess(result);
    expect(JSON.stringify(input)).toBe(before);
    expect(result.lifecycle.expiresAt).toBe('2027-03-14T13:00:00-04:00');
    expect(result.lifecycle.requestIrrevocable).toBe(true);
    expect(result.lifecycle.events.map((event) => event.eventKind)).toEqual([
      'waiver-request',
      'waiver-expiry',
      'contract-termination',
      'set-off-authority',
    ]);

    const team: ArchitectMutationTeamRecord = {
      roster: [
        { playerId: PLAYER_ID },
        { player_id: 'other-player' },
      ] as unknown as Array<string | number>,
      players: [{ player_id: PLAYER_ID }, { player_id: 'other-player' }],
      deadCap: [],
    };
    const applied = applyGovernedWaiverResult({
      team,
      playerId: PLAYER_ID,
      result,
    });
    expect(applied.roster).toEqual([{ player_id: 'other-player' }]);
    expect(applied.players).toEqual([{ player_id: 'other-player' }]);
    expect(applied.deadCap).toHaveLength(1);
    expect(team.roster).toEqual([
      { playerId: PLAYER_ID },
      { player_id: 'other-player' },
    ]);
  });

  it('keeps standard dead salary in the original Contract Seasons and set-off pending', () => {
    const result = decideGovernedWaiver(request('standard'));
    expectSuccess(result);
    expect(
      result.lifecycle.allocations.map((row) => [row.season, row.teamSalary])
    ).toEqual([
      ['2026-27', 10_000_000],
      ['2027-28', 12_000_000],
      ['2028-29', 14_000_000],
    ]);
    expect(result.lifecycle.setOffStatus).toBe('needs-authenticated-earnings');
    expect(
      result.lifecycle.allocations.every((row) => row.setOffReduction === null)
    ).toBe(true);
  });

  it('normalizes bare-year Contract and existing dead-salary seasons before attribution', () => {
    const baseline = baselineFor({
      rows: [
        salaryRow('2027', 10_000_000),
        salaryRow('2028', 12_000_000),
        salaryRow('2029', 14_000_000),
      ],
    });
    const standard = decideGovernedWaiver(request('standard', { baseline }));
    expectSuccess(standard);
    expect(standard.lifecycle.originalContractSeasons).toEqual([
      '2026-27',
      '2027-28',
      '2028-29',
    ]);
    expect(standard.lifecycle.allocations.map((row) => row.season)).toEqual([
      '2026-27',
      '2027-28',
      '2028-29',
    ]);

    const ceiling = decideGovernedWaiver(
      request('waive-and-stretch', {
        baseline,
        salaryCapAtElection: 100_000_000,
        existingDeadCap: [
          { amountByYear: [{ season: '2027', amount: 14_000_000 }] },
        ],
      })
    );
    expect(ceiling.success).toBe(false);
    if (!ceiling.success) expect(ceiling.reasons.join(' ')).toMatch(/15%/);
  });

  it('rejects rolled calendar dates and malformed persisted event chains', () => {
    const invalidDate = decideGovernedWaiver(
      request('standard', {
        proposal: proposal('standard', {
          leagueReceivedAt: '2026-04-31T12:00:00-04:00',
        }),
      })
    );
    expect(invalidDate.success).toBe(false);

    const valid = decideGovernedWaiver(request('standard'));
    expectSuccess(valid);
    expect(
      GovernedWaiverLifecycleZ.safeParse({
        ...valid.lifecycle,
        events: valid.lifecycle.events.map((event) => ({
          ...event,
          recordedAt: '2026-07-15T16:01:00.000Z',
        })),
      }).success
    ).toBe(true);
    expect(
      GovernedWaiverLifecycleZ.safeParse({
        ...valid.lifecycle,
        expiresAt: '2026-07-17T11:59:59-04:00',
      }).success
    ).toBe(false);
    expect(
      GovernedWaiverLifecycleZ.safeParse({
        ...valid.lifecycle,
        events: valid.lifecycle.events.map((event, index) =>
          index === 1
            ? { ...event, eventVersion: 99, predecessorEventId: null }
            : event
        ),
      }).success
    ).toBe(false);
  });

  it('applies the January 10 current-Season protection at ordinary expiry', () => {
    const baseline = baselineFor({
      rows: [
        salaryRow('2026-27', 10_000_000, {
          guaranteed: false,
          guaranteedAmount: 0,
        }),
        salaryRow('2027-28', 12_000_000),
      ],
    });
    const result = decideGovernedWaiver(
      request('standard', {
        baseline,
        proposal: proposal('standard', {
          leagueReceivedAt: '2027-01-08T12:00:00-05:00',
        }),
      })
    );
    expectSuccess(result);
    expect(result.lifecycle.expiresAt).toBe('2027-01-10T12:00:00-05:00');
    expect(result.lifecycle.protectedBaseCompensation).toBe(22_000_000);
  });

  it('allocates a signed buyout reduction pro rata and records the later reacquisition bar', () => {
    const result = decideGovernedWaiver(request('buyout'));
    expectSuccess(result);
    expect(result.lifecycle.buyoutReduction).toBe(9_000_000);
    expect(
      result.lifecycle.allocationsBeforeStretch.map(
        (row) => row.buyoutReduction
      )
    ).toEqual([2_500_000, 3_000_000, 3_500_000]);
    expect(
      result.lifecycle.paymentAllocations.map((row) => row.playerPayment)
    ).toEqual([7_500_000, 9_000_000, 10_500_000]);
    expect(result.lifecycle.reacquisitionRestrictedUntil).toBe(
      '2029-07-01T00:00:00-04:00'
    );
    expect(result.lifecycle.events.map((event) => event.eventKind)).toContain(
      'buyout-agreement'
    );
  });

  it('fails closed when a buyout lacks the written agreement or either signature', () => {
    for (const missing of [
      { writtenBuyoutAgreement: false },
      { playerSignatureRecorded: false },
      { teamSignatureRecorded: false },
    ]) {
      const result = decideGovernedWaiver(
        request('buyout', {
          proposal: proposal('buyout', missing),
        })
      );
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.reasons.join(' ')).toMatch(/both signatures/i);
    }
  });

  it('stretches all remaining Team Salary in July/August but keeps payments on the original schedule', () => {
    const result = decideGovernedWaiver(request('waive-and-stretch'));
    expectSuccess(result);
    expect(result.lifecycle.stretchBranch).toBe('july-august');
    expect(result.lifecycle.stretchYears).toBe(7);
    expect(result.lifecycle.allocations).toHaveLength(7);
    expect(
      result.lifecycle.allocations.reduce((sum, row) => sum + row.teamSalary, 0)
    ).toBe(36_000_000);
    expect(
      result.lifecycle.paymentAllocations.map((row) => row.season)
    ).toEqual(['2026-27', '2027-28', '2028-29']);
  });

  it('leaves the current Team Salary unchanged in September-June and stretches only future Seasons', () => {
    const result = decideGovernedWaiver(
      request('waive-and-stretch', {
        proposal: proposal('waive-and-stretch', {
          leagueReceivedAt: '2026-10-10T12:00:00-04:00',
        }),
      })
    );
    expectSuccess(result);
    expect(result.lifecycle.stretchBranch).toBe('september-june');
    expect(result.lifecycle.stretchYears).toBe(5);
    expect(result.lifecycle.allocations[0]).toMatchObject({
      season: '2026-27',
      teamSalary: 10_000_000,
      isTeamSalaryStretched: false,
    });
    expect(result.lifecycle.allocations.slice(1)).toHaveLength(5);
    expect(
      result.lifecycle.allocations
        .slice(1)
        .reduce((sum, row) => sum + row.teamSalary, 0)
    ).toBe(26_000_000);
  });

  it('blocks a late stretch election and any Season that breaches the 15% former-player ceiling', () => {
    const late = decideGovernedWaiver(
      request('waive-and-stretch', {
        proposal: proposal('waive-and-stretch', {
          leagueReceivedAt: '2028-09-01T00:00:00-04:00',
        }),
      })
    );
    expect(late.success).toBe(false);
    if (!late.success)
      expect(late.reasons.join(' ')).toMatch(/before September 1/i);

    const ceiling = decideGovernedWaiver(
      request('waive-and-stretch', {
        salaryCapAtElection: 100_000_000,
        existingDeadCap: [
          { amountByYear: [{ season: '2026-27', amount: 14_000_000 }] },
        ],
      })
    );
    expect(ceiling.success).toBe(false);
    if (!ceiling.success) expect(ceiling.reasons.join(' ')).toMatch(/15%/);
  });

  it('fails closed on unresolved options, incentives, bonus reconciliation, and duplicate lifecycle', () => {
    const cases = [
      {
        label: 'unresolved player option',
        baseline: baselineFor({
          rows: [
            salaryRow('2026-27', 10_000_000, {
              option: 'PO',
              optionHolder: 'player',
              optionUsed: null,
            }),
            salaryRow('2027-28', 12_000_000),
          ],
        }),
      },
      {
        label: 'unresolved incentive criteria',
        baseline: baselineFor({
          rows: [
            salaryRow('2026-27', 10_000_000, {
              incentives: {
                likely: 250_000,
                unlikely: 0,
                criteriaEvidence: 'known',
              },
            }),
            salaryRow('2027-28', 12_000_000),
          ],
          totalValue: 22_250_000,
        }),
      },
      {
        label: 'unreconciled bonus allocation',
        baseline: baselineFor({ totalValue: 36_500_000 }),
      },
    ];
    for (const { baseline, label } of cases) {
      const result = decideGovernedWaiver(request('standard', { baseline }));
      expect(result.success, label).toBe(false);
      if (!result.success) {
        expect(result.reasons.join(' '), label).toMatch(
          /unresolved|incentive|reconcile/i
        );
      }
    }

    const first = decideGovernedWaiver(request('standard'));
    expectSuccess(first);
    const repeated = decideGovernedWaiver(
      request('standard', { existingLifecycles: [first.lifecycle] })
    );
    expect(repeated.success).toBe(false);
    if (!repeated.success) expect(repeated.status).toBe('recorded');
  });
});

function persistencePlayerFixture() {
  const state = baselineFor().events[0].resultingState;
  return {
    playerId: PLAYER_ID,
    player_id: PLAYER_ID,
    id: PLAYER_ID,
    displayName: 'Governed Waiver Player',
    name: 'Governed Waiver Player',
    teamCode: TEAM_ID,
    contract: {
      salariesByYear: state.terms.salaries.map((row) => ({
        season: row.season || '',
        salary: row.salary,
        capHit: row.capHit,
        guaranteed: row.guaranteed,
        option: row.option,
        optionUsed: row.optionUsed,
      })),
    },
  };
}

function persistenceTeamFixture(): ArchitectMutationTeamRecord {
  const player = persistencePlayerFixture();
  return {
    teamCode: TEAM_ID,
    teamName: 'Miami Heat',
    roster: [PLAYER_ID],
    players: [player],
    capHolds: [],
    deadCap: [],
    contractEventLedgers: [],
    totals: { totalSalary: 36_000_000 },
    source: { type: 'world-snapshot', provider: 'fixture' },
  };
}

function computeWaiverMutation(
  options: {
    omitAuthority?: boolean;
    omitSnapshotReceipts?: boolean;
  } = {}
) {
  const baseline = baselineFor();
  const team = persistenceTeamFixture();
  const player = persistencePlayerFixture();
  return computeWorldMutation({
    mutationType: 'waivePlayer',
    payload: {
      teamCode: TEAM_ID,
      playerId: PLAYER_ID,
      contractId: CONTRACT_ID,
      waiverProposal: proposal('standard'),
      stretch: false,
      buyout: false,
      buyoutAmount: 0,
    },
    currentState: {
      teamCode: TEAM_ID,
      player,
      team,
      ...(options.omitAuthority
        ? {}
        : {
            waiverAuthority: resolveGovernedOptionLedgerAuthority({
              baselineLedger: baseline,
              baselineSalaryCapYear: 2027,
            }),
          }),
      ...(options.omitSnapshotReceipts
        ? {}
        : {
            waiverTeamSnapshot: {
              exists: true,
              digest: mutationSnapshotDigest(team),
              sourceWorldId: WORLD_ID,
              sourceDigest: mutationSnapshotDigest(team),
              sourceLineage: [],
            },
            waiverPlayerSnapshot: {
              exists: true,
              digest: mutationSnapshotDigest(player),
              sourceWorldId: WORLD_ID,
              sourceDigest: mutationSnapshotDigest(player),
              sourceLineage: [],
            },
          }),
    },
    seasonId: '2026-27',
    timestamp: Date.parse('2026-07-15T12:01:00-04:00'),
    asOfDate: '2026-07-15',
    worldId: WORLD_ID,
    operationId: 'compute-governed-waiver',
    authoringIdentity: 'user-bze-284',
    recordedAt: '2026-07-15T12:01:00-04:00',
  });
}

function seedPersistenceWorld(): void {
  seedBaseData();
  const worldMetadata = {
    ...createMockWorld({
      worldId: WORLD_ID,
      userId: 'user-bze-284',
      currentSeason: '2026-27',
      asOfDate: '2026-07-15',
    }),
    contractBaselineVersion: 2,
    contractBaselineEffectiveAt: '2026-07-01T00:00:00-04:00',
    contractBaselineSalaryCapYear: 2027,
  } as MockWorldMetadata;
  seedWorldMetadata(WORLD_ID, worldMetadata);
  seedTeamSnapshot(
    WORLD_ID,
    TEAM_ID,
    persistenceTeamFixture() as unknown as MockTeam,
    { padRoster: false }
  );
  seedMockData(
    `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`,
    persistencePlayerFixture()
  );
}

describe('governed waiver mutation and atomic persistence', () => {
  it('projects one lifecycle, immediate roster removal, and the player override deletion', () => {
    const result = computeWaiverMutation();
    expect(result.success, String(result.error || '')).toBe(true);
    const teamUpdate = result.teamUpdates?.[0];
    expect(teamUpdate).toBeDefined();
    const updatedTeam = teamUpdate?.team;
    expect(updatedTeam).toBeDefined();
    expect(updatedTeam?.roster).not.toContain(PLAYER_ID);
    expect(updatedTeam?.deadCap?.[0]?.governedLifecycle).toMatchObject({
      contractId: CONTRACT_ID,
      path: 'standard',
      leagueReceivedAt: '2026-07-15T12:00:00-04:00',
      expiresAt: '2026-07-17T12:00:00-04:00',
    });
    expect(result.playerUpdates || []).toEqual([]);
    expect(result.playerDeletes).toEqual([
      { playerId: PLAYER_ID, teamCode: TEAM_ID },
    ]);
    expect(result.metadata).toMatchObject({
      waiverStatus: 'pending-unclaimed-expiry',
      contractId: CONTRACT_ID,
      expectedContractOverlayLedgerVersion: null,
    });
  });

  it('returns no writes when authority or exact snapshot receipts are absent', () => {
    for (const result of [
      computeWaiverMutation({ omitAuthority: true }),
      computeWaiverMutation({ omitSnapshotReceipts: true }),
    ]) {
      expect(result.success).toBe(false);
      expect(result.teamUpdates || []).toEqual([]);
      expect(result.playerUpdates || []).toEqual([]);
      expect(result.playerDeletes || []).toEqual([]);
    }
  });

  it('commits team lifecycle and player deletion atomically', async () => {
    seedPersistenceWorld();
    const computed = computeWaiverMutation();
    expect(computed.success, String(computed.error || '')).toBe(true);
    const persisted = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'waivePlayer',
      computeResult: computed,
      committedTeamUpdates: computed.teamUpdates || [],
      timestamp: Date.parse('2026-07-15T12:01:00-04:00'),
    });
    expect(persisted.success, String(persisted.error || '')).toBe(true);
    expect(getMockTeamSnapshot(WORLD_ID, TEAM_ID)).toMatchObject({
      roster: [],
      deadCap: [
        {
          governedLifecycle: {
            contractId: CONTRACT_ID,
            path: 'standard',
          },
        },
      ],
    });
    expect(
      getAllMockData().get(
        `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`
      )
    ).toBeUndefined();
  });

  it('rejects a stale Team snapshot without writing the lifecycle or deleting the player', async () => {
    seedPersistenceWorld();
    const computed = computeWaiverMutation();
    expect(computed.success, String(computed.error || '')).toBe(true);
    seedTeamSnapshot(
      WORLD_ID,
      TEAM_ID,
      {
        ...persistenceTeamFixture(),
        totals: { totalSalary: 35_999_999 },
      } as unknown as MockTeam,
      { padRoster: false }
    );

    const persisted = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'waivePlayer',
      computeResult: computed,
      committedTeamUpdates: computed.teamUpdates || [],
      timestamp: Date.parse('2026-07-15T12:01:00-04:00'),
    });

    expect(persisted.success).toBe(false);
    expect(String(persisted.error)).toMatch(/team.*changed/i);
    expect(getMockTeamSnapshot(WORLD_ID, TEAM_ID)).toMatchObject({
      roster: [PLAYER_ID],
      deadCap: [],
    });
    expect(
      getAllMockData().get(
        `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`
      )
    ).toBeDefined();
  });

  it('rejects a stale player snapshot without writing the lifecycle or deleting the player', async () => {
    seedPersistenceWorld();
    const computed = computeWaiverMutation();
    expect(computed.success, String(computed.error || '')).toBe(true);
    seedMockData(
      `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`,
      {
        ...persistencePlayerFixture(),
        displayName: 'Changed after waiver preview',
      }
    );

    const persisted = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'waivePlayer',
      computeResult: computed,
      committedTeamUpdates: computed.teamUpdates || [],
      timestamp: Date.parse('2026-07-15T12:01:00-04:00'),
    });

    expect(persisted.success).toBe(false);
    expect(String(persisted.error)).toMatch(/player.*changed/i);
    expect(getMockTeamSnapshot(WORLD_ID, TEAM_ID)).toMatchObject({
      roster: [PLAYER_ID],
      deadCap: [],
    });
    expect(
      getAllMockData().get(
        `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`
      )
    ).toMatchObject({ displayName: 'Changed after waiver preview' });
  });
});
