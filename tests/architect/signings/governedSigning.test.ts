import { describe, expect, it } from 'vitest';

import { validateSigning } from '@/features/architect/utils/capLegalityValidation';
import { getCapRulesForYear } from '@/features/architect/utils/capRulesProfile';
import {
  applyWorldMutation,
  computeWorldMutation,
  persistWorldMutation,
  type ArchitectMutationContract,
  type ArchitectMutationPlayerRecord,
  type ArchitectMutationTeamRecord,
  type MutationDocumentSnapshotReceipt,
} from '@/features/architect/utils/mutationPipeline';
import { mutationSnapshotDigest } from '@/features/architect/utils/mutationPipeline.snapshotDigest';
import {
  applyGovernedSigningSetOff,
  resolveGovernedSigningAuthority,
} from '@/features/architect/utils/signings';
import { GovernedWaiverLifecycleZ } from '@/schemas/governedWaiver';
import type { TeamSalaryBookInputs } from '@/schemas/salaryBooks';
import { getAllMockData, seedMockData } from '../../__mocks__/firebase';
import {
  getMockTeamSnapshot,
  seedTeamSnapshot,
  seedWorldMetadata,
  type MockTeam,
} from '../../helpers/architectTestHelpers';

const WORLD_ID = 'world-bze-286';
const TEAM_ID = 'MIA';
const PLAYER_ID = 'player-bze-286';
const OPERATION_ID = 'operation-bze-286';
const WORLD_DATE = '2026-07-08';
const RECORDED_AT = '2026-08-21T12:00:00-04:00';

function contract(
  overrides: Partial<ArchitectMutationContract> = {}
): ArchitectMutationContract {
  return {
    contractType: 'Standard',
    years: 2,
    contractYears: 2,
    totalValue: 21_000_000,
    signedUsing: 'Full MLE',
    salariesByYear: [
      {
        season: '2026-27',
        salary: 10_000_000,
        capHit: 10_000_000,
        guaranteed: true,
      },
      {
        season: '2027-28',
        salary: 11_000_000,
        capHit: 11_000_000,
        guaranteed: true,
      },
    ],
    ...overrides,
  };
}

function player(
  overrides: Partial<ArchitectMutationPlayerRecord> = {}
): ArchitectMutationPlayerRecord {
  return {
    id: PLAYER_ID,
    player_id: PLAYER_ID,
    playerId: PLAYER_ID,
    name: 'Governed Signing Player',
    displayName: 'Governed Signing Player',
    teamCode: null,
    bio: { yearsExperience: 6 },
    contract: null,
    ...overrides,
  };
}

function team(
  overrides: Partial<ArchitectMutationTeamRecord> = {}
): ArchitectMutationTeamRecord {
  return {
    teamCode: TEAM_ID,
    teamName: 'Miami Heat',
    roster: [],
    players: [],
    capHolds: [],
    deadCap: [],
    contractEventLedgers: [],
    exceptions: {
      mle: {
        enabled: true,
        available: true,
        amount: 14_104_000,
        maxAmount: 14_104_000,
        totalAmount: 14_104_000,
        usedAmount: 0,
        remainingAmount: 14_104_000,
      },
      room: {
        enabled: true,
        available: true,
        amount: 8_781_000,
        maxAmount: 8_781_000,
        totalAmount: 8_781_000,
        usedAmount: 0,
        remainingAmount: 8_781_000,
      },
      bae: {
        enabled: true,
        available: true,
        amount: 5_477_000,
        maxAmount: 5_477_000,
        totalAmount: 5_477_000,
        usedAmount: 0,
        remainingAmount: 5_477_000,
      },
    },
    totals: {
      teamSalary: 100_000_000,
      apronTeamSalary: 101_000_000,
      taxSalary: 102_000_000,
      totalSalary: 100_000_000,
      capHit: 100_000_000,
      totalCapAllocations: 100_000_000,
      rosterCount: 0,
    },
    source: { type: 'world-snapshot', provider: 'test' },
    ...overrides,
  };
}

function governedSalaryBookInputs(): TeamSalaryBookInputs {
  const line = (
    ledger: 'apron-team-salary' | 'tax-salary',
    leafId: string,
    amount: number
  ) => ({
    id: `${ledger}:${leafId}`,
    ledger,
    label: leafId,
    amount,
    effectiveFrom: '2026-07-01T00:00:00Z',
    canonLeafIds: [leafId],
    source: {
      authority: 'external-determination' as const,
      reference: `fixture:${leafId}`,
    },
  });
  return {
    version: 1 as const,
    salaryCapYear: 2027,
    apronAdjustments: {
      status: 'ready' as const,
      lineItems: [
        line('apron-team-salary', 'CBA2-C07.2', 1_000_000),
        line('apron-team-salary', 'CBA2-C07.3', 0),
        line('apron-team-salary', 'CBA2-C07.4', 0),
        line('apron-team-salary', 'CBA2-C07.5', 0),
        line('apron-team-salary', 'CBA2-C07.6', 0),
        line('apron-team-salary', 'CBA2-C07.7', 0),
        line('apron-team-salary', 'CBA2-C07.8', 0),
        line('apron-team-salary', 'CBA2-C07.9', 0),
        line('apron-team-salary', 'CBA2-C07.10', 0),
        line('apron-team-salary', 'CBA2-C07.11', 0),
      ],
    },
    taxSalary: {
      status: 'ready' as const,
      lineItems: [
        line('tax-salary', 'CBA2-C08.1', 100_000_000),
        line('tax-salary', 'CBA2-C08.2', 0),
        line('tax-salary', 'CBA2-C08.3', 0),
        line('tax-salary', 'CBA2-C08.4', 0),
        line('tax-salary', 'CBA2-C08.5', 0),
        line('tax-salary', 'CBA2-C08.6', 0),
        line('tax-salary', 'CBA2-C08.7', 0),
        line('tax-salary', 'CBA2-C08.8', 0),
      ],
    },
  };
}

function governedRosterPlayers(): ArchitectMutationPlayerRecord[] {
  return Array.from({ length: 14 }, (_, index) => ({
    id: `filler-${index + 1}`,
    playerId: `filler-${index + 1}`,
    player_id: `filler-${index + 1}`,
    name: `Filler ${index + 1}`,
    displayName: `Filler ${index + 1}`,
    teamCode: TEAM_ID,
    contract: {
      contractType: 'Standard',
      years: 1,
      contractYears: 1,
      totalValue: 1_000_000,
      salariesByYear: [
        {
          season: '2026-27',
          salary: 1_000_000,
          capHit: 1_000_000,
          guaranteed: true,
        },
      ],
    },
  }));
}

function governedTeam(
  overrides: Partial<ArchitectMutationTeamRecord> = {}
): ArchitectMutationTeamRecord {
  const players = governedRosterPlayers();
  return team({
    roster: players.map((entry) => String(entry.playerId)),
    players,
    salaryBookInputs: governedSalaryBookInputs(),
    ...overrides,
  });
}

function localReceipt(data: unknown): MutationDocumentSnapshotReceipt {
  const digest = mutationSnapshotDigest(data);
  return Object.freeze({
    exists: true,
    digest,
    sourceWorldId: WORLD_ID,
    sourceDigest: digest,
    sourceLineage: Object.freeze([]),
  });
}

function computeSigning({
  targetTeam = team(),
  targetPlayer = player(),
  signingContract = contract(),
  asOfDate = WORLD_DATE,
  signedUsing = 'Full MLE',
}: {
  targetTeam?: ArchitectMutationTeamRecord;
  targetPlayer?: ArchitectMutationPlayerRecord;
  signingContract?: ArchitectMutationContract;
  asOfDate?: string | null;
  signedUsing?: string | null;
} = {}) {
  return computeWorldMutation({
    mutationType: 'signFreeAgent',
    payload: {
      teamCode: TEAM_ID,
      playerId: PLAYER_ID,
      contract: signingContract,
      signedUsing,
    },
    currentState: {
      team: targetTeam,
      player: targetPlayer,
      teamCode: TEAM_ID,
      signingTeamSnapshot: localReceipt(targetTeam),
      signingPlayerSnapshot: localReceipt(targetPlayer),
    },
    seasonId: '2026-27',
    timestamp: Date.parse(RECORDED_AT),
    asOfDate,
    worldId: WORLD_ID,
    operationId: OPERATION_ID,
    authoringIdentity: 'user-bze-286',
    recordedAt: RECORDED_AT,
  });
}

function waiverLifecycle() {
  const row = (season: string) => ({
    season,
    protectedBaseCompensation: 15_000_000,
    buyoutReduction: 0,
    playerPayment: 15_000_000,
    teamSalary: 15_000_000,
    setOffReduction: null,
    isTeamSalaryStretched: false,
  });
  const event = (
    eventId: string,
    eventVersion: number,
    eventKind:
      | 'waiver-request'
      | 'waiver-expiry'
      | 'contract-termination'
      | 'set-off-authority',
    effectiveAt: string,
    predecessorEventId: string | null
  ) => ({
    eventId,
    eventVersion,
    eventKind,
    effectiveAt,
    recordedAt: effectiveAt,
    predecessorEventId,
    authoringIdentity: 'user-bze-284',
    canonLeafIds: ['CBA2-R05.2'],
  });
  const received = '2026-06-01T12:00:00-04:00';
  const expires = '2026-06-03T12:00:00-04:00';
  return GovernedWaiverLifecycleZ.parse({
    lifecycleVersion: 1,
    lifecycleId: 'waiver-lifecycle-bze-286',
    worldId: WORLD_ID,
    teamId: 'BOS',
    playerId: PLAYER_ID,
    playerName: 'Governed Signing Player',
    contractId: 'prior-contract-bze-286',
    path: 'standard',
    leagueReceivedAt: received,
    expiresAt: expires,
    terminationAt: expires,
    requestIrrevocable: true,
    outcome: 'ordinary-unclaimed',
    events: [
      event('waiver-request', 1, 'waiver-request', received, null),
      event('waiver-expiry', 2, 'waiver-expiry', expires, 'waiver-request'),
      event(
        'contract-termination',
        3,
        'contract-termination',
        expires,
        'waiver-expiry'
      ),
      event(
        'set-off-authority',
        4,
        'set-off-authority',
        expires,
        'contract-termination'
      ),
    ],
    originalContractSeasons: ['2026-27', '2027-28'],
    protectedBaseCompensation: 30_000_000,
    buyoutReduction: 0,
    buyoutAgreementAt: null,
    playerSignatureRecorded: false,
    teamSignatureRecorded: false,
    stretchElectionAt: null,
    stretchBranch: null,
    stretchYears: null,
    salaryCapAtElection: null,
    formerPlayerCeilingAtElection: null,
    allocationsBeforeStretch: [row('2026-27'), row('2027-28')],
    allocations: [row('2026-27'), row('2027-28')],
    paymentAllocations: [row('2026-27'), row('2027-28')],
    setOffStatus: 'needs-authenticated-earnings',
    setOffFormula: '50% of new Base Compensation above the applicable minimum',
    setOffApplication: null,
    originalContractEndsAt: '2028-06-30T23:59:59-04:00',
    reacquisitionRestrictedUntil: null,
    contractAuthority: {
      ledgerId: 'prior-ledger-bze-286',
      ledgerVersion: 1,
      stateDigest: 'fnv1a64:0123456789abcdef',
    },
    canonLeafIds: ['CBA2-R05.2', 'CBA2-R05.7'],
  });
}

describe('governed ordinary signing authority', () => {
  it('uses exact official season inputs and charges only first-year salary to an exception', () => {
    const resolved = resolveGovernedSigningAuthority({
      team: team(),
      contract: contract(),
      mechanism: 'FULL_MLE',
      worldDate: WORLD_DATE,
      salaryCapYear: 2027,
    });
    expect(resolved.status).toBe('complete');
    if (resolved.status !== 'complete') return;
    expect(resolved.authority.exceptionCharge).toBe(10_000_000);
    expect(resolved.authority.worldDate).toBe(WORLD_DATE);
    expect(resolved.authority.seasonInputManifest).toMatchObject({
      manifestVersion: 2,
      salaryCapYear: 2027,
      requiredAuthority: 'official',
    });
    expect(resolved.authority.canonLeafIds).toContain('CBA2-C13.35');
    expect(resolved.authority.canonLeafIds).not.toContain('CBA2-C23.6');
  });

  it('rejects a missing or conflicting compensation route', () => {
    const missing = resolveGovernedSigningAuthority({
      team: team(),
      contract: contract(),
      mechanism: 'UNKNOWN',
      worldDate: WORLD_DATE,
      salaryCapYear: 2027,
    });
    expect(missing.status).toBe('needs-input');
    if (missing.status === 'needs-input') {
      expect(missing.reasons.join(' ')).toMatch(/supported, explicit/i);
    }

    const conflicting = computeSigning({
      signingContract: contract({ exceptionType: 'Minimum' }),
      signedUsing: 'Full MLE',
    });
    expect(conflicting.success).toBe(false);
    expect(conflicting.error).toMatch(/route conflicts/i);
    expect(conflicting.teamUpdates || []).toEqual([]);
  });

  it.each([
    ['missing date', null, contract(), 2027, /exact saved-world date/i],
    ['wrong year', '2025-07-08', contract(), 2027, /do not agree/i],
    [
      'wrong salary row year',
      WORLD_DATE,
      contract({
        salariesByYear: [
          { season: '2025-26', salary: 10_000_000, capHit: 10_000_000 },
          { season: '2027-28', salary: 11_000_000, capHit: 11_000_000 },
        ],
      }),
      2027,
      /wrong Contract Season/i,
    ],
    [
      'malformed money',
      WORLD_DATE,
      contract({
        salariesByYear: [
          { season: '2026-27', salary: 10_000_000.5, capHit: 10_000_000 },
          { season: '2027-28', salary: 11_000_000, capHit: 11_000_000 },
        ],
      }),
      2027,
      /whole-dollar/i,
    ],
    [
      'conflicting length',
      WORLD_DATE,
      contract({ contractYears: 3 }),
      2027,
      /length.*rows/i,
    ],
    [
      'conflicting total',
      WORLD_DATE,
      contract({ totalValue: 22_000_000 }),
      2027,
      /total value conflicts/i,
    ],
    ['moratorium', '2026-07-01', contract(), 2027, /inside the Moratorium/i],
    [
      'post-January 10 proration',
      '2027-01-11',
      contract(),
      2027,
      /January 10 unused amount/i,
    ],
    [
      'unsupported governed year',
      '2027-07-08',
      contract({
        salariesByYear: [
          { season: '2027-28', salary: 10_000_000, capHit: 10_000_000 },
          { season: '2028-29', salary: 11_000_000, capHit: 11_000_000 },
        ],
      }),
      2028,
      /not a supported season/i,
    ],
  ] as const)(
    'fails closed for %s',
    (_label, worldDate, signingContract, salaryCapYear, expected) => {
      const resolved = resolveGovernedSigningAuthority({
        team: team(),
        contract: signingContract,
        mechanism: 'FULL_MLE',
        worldDate,
        salaryCapYear,
      });
      expect(resolved.status).toBe('needs-input');
      if (resolved.status !== 'needs-input') return;
      expect(resolved.reasons.join(' ')).toMatch(expected);
    }
  );

  it('fails before writes when the canonical exception would be overused', () => {
    const result = computeSigning({
      targetTeam: team({
        exceptions: {
          mle: {
            enabled: true,
            available: true,
            amount: 14_104_000,
            maxAmount: 14_104_000,
            totalAmount: 14_104_000,
            usedAmount: 5_000_000,
            remainingAmount: 9_104_000,
          },
        },
      }),
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/exceeds remaining MLE/i);
    expect(result.teamUpdates || []).toEqual([]);
    expect(result.playerUpdates || []).toEqual([]);
  });

  it('permits the Canon three-Season Room MLE term and enforces Room/BAE same-year exclusivity', () => {
    const roomContract = contract({
      years: 3,
      contractYears: 3,
      totalValue: 18_915_000,
      signedUsing: 'Room MLE',
      salariesByYear: [
        { season: '2026-27', salary: 6_000_000, capHit: 6_000_000 },
        { season: '2027-28', salary: 6_300_000, capHit: 6_300_000 },
        { season: '2028-29', salary: 6_615_000, capHit: 6_615_000 },
      ],
    });
    const eligible = validateSigning({
      team: governedTeam(),
      player: player(),
      contract: roomContract,
      signedUsing: 'Room MLE',
      year: 2027,
      asOfDate: '2026-07-08T00:00:00Z',
    });
    expect(
      eligible.violations.filter((issue) =>
        ['contract_years_invalid', 'exception_blocked'].includes(issue.rule)
      )
    ).toEqual([]);

    const teamWithPriorBaeUse = governedTeam();
    const priorBaeUse = validateSigning({
      team: {
        ...teamWithPriorBaeUse,
        exceptions: {
          ...teamWithPriorBaeUse.exceptions,
          bae: {
            ...teamWithPriorBaeUse.exceptions?.bae,
            usedAmount: 1,
            remainingAmount: 5_000_000,
          },
        },
      },
      player: player(),
      contract: roomContract,
      signedUsing: 'Room MLE',
      year: 2027,
      asOfDate: '2026-07-08T00:00:00Z',
    });
    expect(priorBaeUse.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: 'exception_blocked' }),
      ])
    );
  });

  it('warns instead of inventing an exact minimum charge when veteran service time is unverified', () => {
    const result = validateSigning({
      team: governedTeam(),
      player: player({ bio: { age: 30 } }),
      contract: contract({
        years: 1,
        contractYears: 1,
        totalValue: 5_000_000,
        signedUsing: 'Minimum',
        salariesByYear: [
          {
            season: '2026-27',
            salary: 5_000_000,
            capHit: 5_000_000,
            guaranteed: true,
          },
        ],
      }),
      signedUsing: 'Minimum',
      year: 2027,
      asOfDate: '2026-07-08T00:00:00Z',
    });

    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: 'minimum_reimbursement_yos_unverified',
        }),
      ])
    );
    expect(
      result.violations.filter(
        (issue) => issue.rule === 'first_year_max_invalid'
      )
    ).toEqual([]);
  });
});

describe('governed signing result and immutable history', () => {
  it('returns an explicit needs-input result and writes nothing when the saved-world date is missing', async () => {
    const targetTeam = team();
    const targetPlayer = player();
    seedWorldMetadata(WORLD_ID, {
      worldId: WORLD_ID,
      userId: 'user-bze-286',
      worldName: 'BZE-286 missing-date world',
      season: '2026-27',
      asOfDate: null,
      parentWorldId: null,
    });
    seedTeamSnapshot(WORLD_ID, TEAM_ID, targetTeam as MockTeam, {
      padRoster: false,
    });
    seedMockData(
      `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`,
      targetPlayer
    );
    seedMockData(`architect_basePlayers/${PLAYER_ID}`, targetPlayer);
    const before = new Map(getAllMockData());
    const result = await applyWorldMutation({
      userId: 'user-bze-286',
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: TEAM_ID,
        playerId: PLAYER_ID,
        contract: contract(),
        signedUsing: 'Full MLE',
      },
      timestamp: Date.parse(RECORDED_AT),
      operationId: OPERATION_ID,
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/exact saved-world date/i);
    expect(getAllMockData()).toEqual(before);
  });

  it('does not borrow a salary book when governed inputs are incomplete', async () => {
    const targetTeam = team();
    const targetPlayer = player();
    seedWorldMetadata(WORLD_ID, {
      worldId: WORLD_ID,
      userId: 'user-bze-286',
      worldName: 'BZE-286 incomplete-books world',
      season: '2026-27',
      asOfDate: WORLD_DATE,
      parentWorldId: null,
    });
    seedTeamSnapshot(WORLD_ID, TEAM_ID, targetTeam as MockTeam, {
      padRoster: false,
    });
    seedMockData(`architect_basePlayers/${PLAYER_ID}`, targetPlayer);
    seedMockData(
      `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`,
      targetPlayer
    );
    const before = new Map(getAllMockData());
    const result = await applyWorldMutation({
      userId: 'user-bze-286',
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'signFreeAgent',
      payload: {
        teamCode: TEAM_ID,
        playerId: PLAYER_ID,
        contract: contract(),
        signedUsing: 'Full MLE',
      },
      timestamp: Date.parse(RECORDED_AT),
      operationId: `${OPERATION_ID}:missing-books`,
    });
    expect(result.success).toBe(false);
    expect(
      `${result.error || ''} ${JSON.stringify(result.violations || [])}`
    ).toMatch(/salary book|governed input|needs input/i);
    expect(getAllMockData()).toEqual(before);
  });

  it('creates a root contract event, consumes first-year exception usage, and absolves the cap hold', () => {
    const targetTeam = team({
      capHolds: [
        {
          playerId: PLAYER_ID,
          playerName: 'Governed Signing Player',
          amount: 12_000_000,
          type: 'FA Cap Hold',
          season: '2026-27',
          active: true,
        },
      ],
    });
    const result = computeSigning({ targetTeam });
    expect(result.success, String(result.error || '')).toBe(true);
    const updated = result.teamUpdates?.[0]?.team;
    expect(updated?.exceptions?.mle).toMatchObject({
      usedAmount: 10_000_000,
      remainingAmount: 4_104_000,
      lastUsedAt: '2026-07-08T00:00:00Z',
    });
    expect(updated?.capHolds).toEqual([]);
    expect(updated?.contractEventLedgers).toHaveLength(1);
    const ledger = updated?.contractEventLedgers?.[0];
    expect(ledger?.events).toHaveLength(1);
    expect(ledger?.events[0]).toMatchObject({
      eventKind: 'signing',
      executedAt: '2026-07-08T00:00:00Z',
      effectiveAt: '2026-07-08T00:00:00Z',
      recordedAt: RECORDED_AT,
      resultingState: {
        establishmentKind: 'signing',
        source: {
          sourceKind: 'saved-world-signing',
          worldAsOfDate: {
            precision: 'date',
            value: WORLD_DATE,
            rawValue: WORLD_DATE,
          },
        },
      },
    });
    expect(ledger?.events[0]?.resultingState.terms.sourceLimitations).toContain(
      'Salary-only Architect authoring does not establish a signing bonus under CBA2-C23.6.'
    );
  });

  it('reconciles the authenticated aggregate incomplete-roster charge after adding a standard player', () => {
    const players = governedRosterPlayers().slice(0, 3);
    const salaryBookInputs = governedSalaryBookInputs();
    salaryBookInputs.incompleteRosterCharge = {
      id: 'team-salary:incomplete-roster',
      ledger: 'team-salary',
      label: 'Eleven authenticated incomplete-roster charges',
      amount: 11 * 1_357_763,
      effectiveFrom: '2026-07-01T00:00:00Z',
      canonLeafIds: ['CBA2-A01.1'],
      source: {
        authority: 'external-determination',
        reference: 'fixture:2026-27-rookie-minimum',
      },
    };
    if (salaryBookInputs.apronAdjustments.status === 'ready') {
      salaryBookInputs.apronAdjustments.lineItems =
        salaryBookInputs.apronAdjustments.lineItems.map((lineItem) =>
          lineItem.canonLeafIds.includes('CBA2-C07.11')
            ? { ...lineItem, amount: -(11 * 1_357_763) }
            : lineItem
        );
    }
    const result = computeSigning({
      targetTeam: governedTeam({
        players,
        roster: players.map((entry) => String(entry.playerId)),
        salaryBookInputs,
      }),
      signingContract: contract({ exceptionType: 'None' }),
      signedUsing: null,
    });
    expect(result.success, String(result.error || '')).toBe(true);
    expect(
      result.teamUpdates?.[0]?.team.salaryBookInputs?.incompleteRosterCharge
        ?.amount
    ).toBe(10 * 1_357_763);
  });

  it('uses the two-YOS Team/Apron/Tax charge for an eligible veteran minimum while preserving actual compensation', () => {
    const rules = getCapRulesForYear(2027);
    expect(rules).toBeTruthy();
    if (!rules) return;
    const actualSalary = rules.salaries.getMinimumForYOS(8);
    const teamCharge = rules.salaries.getMinimumForYOS(2);
    const minimumContract = contract({
      years: 1,
      contractYears: 1,
      totalValue: actualSalary,
      signedUsing: 'Minimum',
      salariesByYear: [
        {
          season: '2026-27',
          salary: actualSalary,
          capHit: teamCharge,
          guaranteed: true,
        },
      ],
    });
    const veteran = player({ bio: { yearsExperience: 8 } });
    const validation = validateSigning({
      team: team(),
      player: veteran,
      contract: minimumContract,
      signedUsing: 'Minimum',
      year: 2027,
      asOfDate: '2026-07-08T12:00:00-04:00',
    });
    expect(
      validation.violations.filter((issue) =>
        ['min_salary_violation', 'first_year_max_invalid'].includes(issue.rule)
      )
    ).toEqual([]);
    const result = computeSigning({
      targetTeam: governedTeam(),
      targetPlayer: veteran,
      signingContract: minimumContract,
      signedUsing: 'Minimum',
    });
    expect(result.success, String(result.error || '')).toBe(true);
    expect(
      result.playerUpdates?.[0]?.player.contract?.salariesByYear?.[0]
    ).toMatchObject({
      salary: actualSalary,
      capHit: teamCharge,
    });
    expect(
      result.teamUpdates?.[0]?.team.totals,
      JSON.stringify(result.teamUpdates?.[0]?.team.totals?.salaryBooks)
    ).toMatchObject({
      teamSalary: expect.any(Number),
      apronTeamSalary: expect.any(Number),
      taxSalary: expect.any(Number),
    });
    expect(result.teamUpdates?.[0]?.team.totals?.taxSalary).toBe(
      100_000_000 + teamCharge
    );
    expect(
      result.teamUpdates?.[0]?.team.salaryBookInputs?.taxSalary.status ===
        'ready' &&
        result.teamUpdates[0].team.salaryBookInputs.taxSalary.lineItems.some(
          (lineItem) =>
            lineItem.canonLeafIds.includes('CBA2-C08.2') &&
            lineItem.amount === teamCharge
        )
    ).toBe(true);
  });

  it('adds the Canon C07.3 Apron uplift for a qualifying zero-YOS Minimum Contract', () => {
    const rules = getCapRulesForYear(2027);
    const zeroYosMinimum = rules.salaries.getMinimumForYOS(0);
    const twoYosMinimum = rules.salaries.getMinimumForYOS(2);
    const result = computeSigning({
      targetTeam: governedTeam(),
      targetPlayer: player({ bio: { yearsExperience: 0 } }),
      signingContract: contract({
        years: 1,
        contractYears: 1,
        totalValue: zeroYosMinimum,
        signedUsing: 'Minimum',
        salariesByYear: [
          {
            season: '2026-27',
            salary: zeroYosMinimum,
            capHit: zeroYosMinimum,
            guaranteed: true,
          },
        ],
      }),
      signedUsing: 'Minimum',
    });
    expect(result.success, String(result.error || '')).toBe(true);
    const apronInput =
      result.teamUpdates?.[0]?.team.salaryBookInputs?.apronAdjustments;
    expect(
      apronInput?.status === 'ready' &&
        apronInput.lineItems.some(
          (lineItem) =>
            lineItem.canonLeafIds.includes('CBA2-C07.3') &&
            lineItem.amount === twoYosMinimum - zeroYosMinimum
        )
    ).toBe(true);
  });

  it('fails closed when a Minimum signing lacks exact years of service', () => {
    const rules = getCapRulesForYear(2027);
    const rookieMinimum = rules.salaries.getMinimumForYOS(0);
    const result = computeSigning({
      targetTeam: governedTeam(),
      targetPlayer: player({ bio: {} }),
      signingContract: contract({
        years: 1,
        contractYears: 1,
        totalValue: rookieMinimum,
        signedUsing: 'Vet Minimum',
        exceptionType: 'Vet Minimum',
        salariesByYear: [
          {
            season: '2026-27',
            salary: rookieMinimum,
            capHit: rookieMinimum,
            guaranteed: true,
          },
        ],
      }),
      signedUsing: 'Vet Minimum',
    });
    expect(result).toMatchObject({
      success: false,
      error: expect.stringMatching(/exact nonnegative years of service/i),
    });
  });

  it('records malformed optional Contract dates as unknown rather than instants', () => {
    const result = computeSigning({
      signingContract: contract({
        salariesByYear: [
          {
            season: '2026-27',
            salary: 10_000_000,
            capHit: 10_000_000,
            guaranteed: true,
            optionDecisionDate: 'not-an-instant',
          },
          {
            season: '2027-28',
            salary: 11_000_000,
            capHit: 11_000_000,
            guaranteed: true,
          },
        ],
      }),
    });
    expect(result.success, String(result.error || '')).toBe(true);
    expect(
      result.teamUpdates?.[0]?.team.contractEventLedgers?.[0]?.events[0]
        ?.resultingState.terms.salaries[0]?.optionDecisionDate
    ).toEqual({ precision: 'unknown', value: null, rawValue: null });
  });

  it('persists the team, player, world event, and contract ledger atomically with reload parity', async () => {
    const targetTeam = team();
    const targetPlayer = player();
    seedWorldMetadata(WORLD_ID, {
      worldId: WORLD_ID,
      userId: 'user-bze-286',
      worldName: 'BZE-286 signing world',
      season: '2026-27',
      asOfDate: WORLD_DATE,
      parentWorldId: null,
    });
    seedTeamSnapshot(WORLD_ID, TEAM_ID, targetTeam as MockTeam, {
      padRoster: false,
    });
    seedMockData(
      `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`,
      targetPlayer
    );
    const computed = computeSigning({ targetTeam, targetPlayer });
    expect(computed.success, String(computed.error || '')).toBe(true);
    const persisted = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'signFreeAgent',
      computeResult: computed,
      committedTeamUpdates: computed.teamUpdates || [],
      timestamp: Date.parse(RECORDED_AT),
    });
    expect(persisted.success, String(persisted.error || '')).toBe(true);
    const reloaded = getMockTeamSnapshot(WORLD_ID, TEAM_ID);
    expect(reloaded?.roster).toContain(PLAYER_ID);
    expect(reloaded?.contractEventLedgers).toEqual(
      computed.teamUpdates?.[0]?.team.contractEventLedgers
    );
    expect(
      getAllMockData().get(
        `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`
      )
    ).toMatchObject({ teamCode: TEAM_ID });
    expect(persisted.writesSummary.eventsWritten).toBe(1);
    expect(persisted.event).toMatchObject({
      mutationType: 'signFreeAgent',
      metadata: {
        governedSigningWorldDate: WORLD_DATE,
        governedSigningEffectiveAt: '2026-07-08T00:00:00Z',
      },
    });
  });

  it('rejects a concurrent Team change with no player, event, or signing overwrite', async () => {
    const targetTeam = team();
    const targetPlayer = player();
    seedWorldMetadata(WORLD_ID, {
      worldId: WORLD_ID,
      userId: 'user-bze-286',
      worldName: 'BZE-286 stale signing world',
      season: '2026-27',
      asOfDate: WORLD_DATE,
      parentWorldId: null,
    });
    seedTeamSnapshot(WORLD_ID, TEAM_ID, targetTeam as MockTeam, {
      padRoster: false,
    });
    seedMockData(
      `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`,
      targetPlayer
    );
    const computed = computeSigning({ targetTeam, targetPlayer });
    expect(computed.success, String(computed.error || '')).toBe(true);
    seedTeamSnapshot(
      WORLD_ID,
      TEAM_ID,
      { ...targetTeam, teamName: 'Changed concurrently' } as MockTeam,
      { padRoster: false }
    );
    const eventPathsBefore = [...getAllMockData().keys()].filter((path) =>
      path.startsWith(`architect_worlds/${WORLD_ID}/events/`)
    );
    const persisted = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'signFreeAgent',
      computeResult: computed,
      committedTeamUpdates: computed.teamUpdates || [],
      timestamp: Date.parse(RECORDED_AT),
    });
    expect(persisted.success).toBe(false);
    expect(String(persisted.error)).toMatch(/Team snapshot.*changed/i);
    expect(getMockTeamSnapshot(WORLD_ID, TEAM_ID)).toMatchObject({
      teamName: 'Changed concurrently',
      roster: [],
    });
    expect(
      getAllMockData().get(
        `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`
      )
    ).toEqual(targetPlayer);
    expect(
      [...getAllMockData().keys()].filter((path) =>
        path.startsWith(`architect_worlds/${WORLD_ID}/events/`)
      )
    ).toEqual(eventPathsBefore);
  });

  it('rejects a concurrent player change with no Team, event, or signing overwrite', async () => {
    const targetTeam = team();
    const targetPlayer = player();
    seedWorldMetadata(WORLD_ID, {
      worldId: WORLD_ID,
      userId: 'user-bze-286',
      worldName: 'BZE-286 stale player world',
      season: '2026-27',
      asOfDate: WORLD_DATE,
      parentWorldId: null,
    });
    seedTeamSnapshot(WORLD_ID, TEAM_ID, targetTeam as MockTeam, {
      padRoster: false,
    });
    seedMockData(
      `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`,
      targetPlayer
    );
    const computed = computeSigning({ targetTeam, targetPlayer });
    expect(computed.success, String(computed.error || '')).toBe(true);
    const changedPlayer = { ...targetPlayer, name: 'Changed concurrently' };
    seedMockData(
      `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`,
      changedPlayer
    );
    const eventPathsBefore = [...getAllMockData().keys()].filter((path) =>
      path.startsWith(`architect_worlds/${WORLD_ID}/events/`)
    );
    const persisted = await persistWorldMutation({
      worldId: WORLD_ID,
      seasonId: '2026-27',
      mutationType: 'signFreeAgent',
      computeResult: computed,
      committedTeamUpdates: computed.teamUpdates || [],
      timestamp: Date.parse(RECORDED_AT),
    });
    expect(persisted.success).toBe(false);
    expect(String(persisted.error)).toMatch(/Player snapshot.*changed/i);
    expect(getMockTeamSnapshot(WORLD_ID, TEAM_ID)).toMatchObject({
      roster: [],
    });
    expect(
      getAllMockData().get(
        `architect_worlds/${WORLD_ID}/teams/${TEAM_ID}/players/${PLAYER_ID}`
      )
    ).toEqual(changedPlayer);
    expect(
      [...getAllMockData().keys()].filter((path) =>
        path.startsWith(`architect_worlds/${WORLD_ID}/events/`)
      )
    ).toEqual(eventPathsBefore);
  });
});

describe('governed signing waiver set-off', () => {
  it('applies authenticated new compensation to the prior obligation and appends one immutable event', () => {
    const lifecycle = waiverLifecycle();
    const signingContract = contract({
      years: 1,
      contractYears: 1,
      totalValue: 10_000_000,
      salariesByYear: [
        {
          season: '2026-27',
          salary: 10_000_000,
          capHit: 10_000_000,
          guaranteed: true,
        },
      ],
    });
    const priorTeam = team({
      teamCode: 'BOS',
      deadCap: [
        {
          playerId: PLAYER_ID,
          playerName: 'Governed Signing Player',
          amountByYear: lifecycle.allocations.map((allocation) => ({
            season: allocation.season,
            amount: allocation.teamSalary,
            isStretched: false,
          })),
          governedLifecycle: lifecycle,
        },
      ],
    });
    const authority = resolveGovernedSigningAuthority({
      team: team(),
      contract: signingContract,
      mechanism: 'FULL_MLE',
      worldDate: WORLD_DATE,
      salaryCapYear: 2027,
    });
    expect(authority.status).toBe('complete');
    if (authority.status !== 'complete') return;
    const result = applyGovernedSigningSetOff({
      priorTeam,
      signingTeamId: TEAM_ID,
      player: player(),
      contract: signingContract,
      contractId: 'new-contract-bze-286',
      operationId: OPERATION_ID,
      authoringIdentity: 'user-bze-286',
      recordedAt: RECORDED_AT,
      authority: authority.authority,
    });
    expect(result.applied).toBe(true);
    expect(result.reduction).toBe(
      Math.floor(
        (10_000_000 -
          getCapRulesForYear(2027).salaries.getMinimumForYOS(1)) /
          2
      )
    );
    const updated = GovernedWaiverLifecycleZ.parse(
      result.team.deadCap?.[0]?.governedLifecycle
    );
    expect(updated.setOffStatus).toBe('applied-nba-signing');
    expect(updated.setOffApplication).toMatchObject({
      operationId: OPERATION_ID,
      signingTeamId: TEAM_ID,
      reduction: result.reduction,
    });
    expect(updated.events.at(-1)).toMatchObject({
      eventVersion: 5,
      eventKind: 'set-off-application',
      predecessorEventId: 'set-off-authority',
    });
    expect(
      updated.allocations.reduce(
        (sum, allocation) => sum + (allocation.setOffReduction || 0),
        0
      )
    ).toBe(result.reduction);
  });

  it('fails closed when an overlapping season lacks an official minimum-salary scale', () => {
    const lifecycle = waiverLifecycle();
    const authority = resolveGovernedSigningAuthority({
      team: team(),
      contract: contract(),
      mechanism: 'FULL_MLE',
      worldDate: WORLD_DATE,
      salaryCapYear: 2027,
    });
    expect(authority.status).toBe('complete');
    if (authority.status !== 'complete') return;

    expect(() =>
      applyGovernedSigningSetOff({
        priorTeam: team({
          teamCode: 'BOS',
          deadCap: [
            {
              playerId: PLAYER_ID,
              governedLifecycle: lifecycle,
            },
          ],
        }),
        signingTeamId: TEAM_ID,
        player: player(),
        contract: contract(),
        contractId: 'new-contract-bze-286',
        operationId: OPERATION_ID,
        authoringIdentity: 'user-bze-286',
        recordedAt: RECORDED_AT,
        authority: authority.authority,
      })
    ).toThrow(/exact overlapping Base Compensation and Minimum Salary inputs/i);
  });

  it('fails closed for malformed or conflicting prior-team waiver obligations', () => {
    const lifecycle = waiverLifecycle();
    const authority = resolveGovernedSigningAuthority({
      team: team(),
      contract: contract(),
      mechanism: 'FULL_MLE',
      worldDate: WORLD_DATE,
      salaryCapYear: 2027,
    });
    expect(authority.status).toBe('complete');
    if (authority.status !== 'complete') return;
    const oneYearContract = contract({
      years: 1,
      contractYears: 1,
      totalValue: 10_000_000,
      salariesByYear: [
        {
          season: '2026-27',
          salary: 10_000_000,
          capHit: 10_000_000,
          guaranteed: true,
        },
      ],
    });
    const call = (deadCap: ArchitectMutationTeamRecord['deadCap']) =>
      applyGovernedSigningSetOff({
        priorTeam: team({ teamCode: 'BOS', deadCap }),
        signingTeamId: TEAM_ID,
        player: player(),
        contract: oneYearContract,
        contractId: 'new-contract-bze-286',
        operationId: OPERATION_ID,
        authoringIdentity: 'user-bze-286',
        recordedAt: RECORDED_AT,
        authority: authority.authority,
      });
    expect(() =>
      call([
        {
          playerId: PLAYER_ID,
          governedLifecycle: { ...lifecycle, lifecycleVersion: 2 },
        },
      ])
    ).toThrow(/malformed/i);
    expect(() =>
      call([
        {
          playerId: PLAYER_ID,
          governedLifecycle: { ...lifecycle, playerId: 'other-player' },
        },
      ])
    ).toThrow(/conflicts with the signing player/i);
    const duplicate = {
      playerId: PLAYER_ID,
      governedLifecycle: lifecycle,
    };
    expect(() => call([duplicate, { ...duplicate }])).toThrow(/more than one/i);

    const unrelatedMalformed = {
      playerId: 'unrelated-player',
      governedLifecycle: { lifecycleVersion: 2 },
    };
    expect(
      call([
        unrelatedMalformed,
        { playerId: PLAYER_ID, governedLifecycle: lifecycle },
      ]).applied
    ).toBe(true);
  });

  it('does not append a set-off event when no Team Salary obligation remains', () => {
    const lifecycle = waiverLifecycle();
    const zeroRow = (row: (typeof lifecycle.allocations)[number]) => ({
      ...row,
      protectedBaseCompensation: 0,
      playerPayment: 0,
      teamSalary: 0,
    });
    const zeroLifecycle = GovernedWaiverLifecycleZ.parse({
      ...lifecycle,
      protectedBaseCompensation: 0,
      allocationsBeforeStretch: lifecycle.allocationsBeforeStretch.map(zeroRow),
      allocations: lifecycle.allocations.map(zeroRow),
      paymentAllocations: lifecycle.paymentAllocations.map(zeroRow),
    });
    const signingContract = contract({
      years: 1,
      contractYears: 1,
      totalValue: 10_000_000,
      salariesByYear: [
        {
          season: '2026-27',
          salary: 10_000_000,
          capHit: 10_000_000,
          guaranteed: true,
        },
      ],
    });
    const authority = resolveGovernedSigningAuthority({
      team: team(),
      contract: signingContract,
      mechanism: 'FULL_MLE',
      worldDate: WORLD_DATE,
      salaryCapYear: 2027,
    });
    expect(authority.status).toBe('complete');
    if (authority.status !== 'complete') return;
    const priorTeam = team({
      teamCode: 'BOS',
      deadCap: [{ playerId: PLAYER_ID, governedLifecycle: zeroLifecycle }],
    });
    const result = applyGovernedSigningSetOff({
      priorTeam,
      signingTeamId: TEAM_ID,
      player: player(),
      contract: signingContract,
      contractId: 'new-contract-bze-286',
      operationId: OPERATION_ID,
      authoringIdentity: 'user-bze-286',
      recordedAt: RECORDED_AT,
      authority: authority.authority,
    });
    expect(result).toEqual({ team: priorTeam, reduction: 0, applied: false });
  });
});
