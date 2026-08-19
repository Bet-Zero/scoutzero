import { describe, expect, it } from 'vitest';

import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';
import {
  exerciseNoticeDeadline,
} from '@/features/architect/utils/offerSheets/governedOfferSheetTime';
import { GovernedOfferSheetLifecycleZ } from '@/schemas/governedOfferSheet';
import {
  makeGovernedOfferSheetContract,
  makeGovernedOfferSheetEvidence,
  makeGovernedOfferSheetProposal,
  makeGovernedOfferSheetState,
} from '../fixtures/architect/governedOfferSheet';

function store(overrides: Record<string, unknown> = {}) {
  const defaultProposal = makeGovernedOfferSheetProposal();
  const proposalInput = Object.prototype.hasOwnProperty.call(overrides, 'proposal')
    ? overrides.proposal
    : defaultProposal;
  const proposal = (proposalInput ?? defaultProposal) as ReturnType<
    typeof makeGovernedOfferSheetProposal
  >;
  const contract =
    (overrides.contract as ReturnType<typeof makeGovernedOfferSheetContract>) ??
    makeGovernedOfferSheetContract(proposal);
  return computeWorldMutation({
    mutationType: 'storeOfferSheet',
    payload: {
      teamCode: 'LAL',
      playerId: 'player123',
      worldId: 'world_test_123',
      offerSheetId: String(overrides.offerSheetId ?? 'os-governed-1'),
      contract,
      offerSheetProposal: proposalInput,
    },
    currentState:
      (overrides.currentState as ReturnType<
        typeof makeGovernedOfferSheetState
      >) ?? makeGovernedOfferSheetState(),
    seasonId: '2025-26',
    timestamp: Date.parse('2025-07-08T14:00:01Z'),
    asOfDate: Object.prototype.hasOwnProperty.call(overrides, 'asOfDate')
      ? (overrides.asOfDate as string | number | null)
      : '2025-07-08',
    worldId: String(overrides.worldId ?? 'world_test_123'),
  } as Parameters<typeof computeWorldMutation>[0]);
}

function changedTeam(
  result: ReturnType<typeof computeWorldMutation>,
  teamCode: string
) {
  const team = result.teamUpdates?.find((update) => update.teamCode === teamCode)?.team;
  if (!team) throw new Error(`Missing changed Team ${teamCode}`);
  return team;
}

function pendingSheet(result: ReturnType<typeof computeWorldMutation>) {
  const sheet = changedTeam(result, 'LAL').offerSheets?.[0];
  if (!sheet) throw new Error('Missing pending Offer Sheet');
  return sheet;
}

function resolve(
  storeResult: ReturnType<typeof computeWorldMutation>,
  action: 'matchOfferSheet' | 'declineOfferSheet',
  asOfDate = '2025-07-09T23:59:59-04:00',
  statePatch: Record<string, unknown> = {},
  payloadPatch: Record<string, unknown> = {}
) {
  const homeTeam = changedTeam(storeResult, 'BOS');
  const offeringTeam = changedTeam(storeResult, 'LAL');
  return computeWorldMutation({
    mutationType: action,
    payload: {
      teamCode: 'BOS',
      homeTeamCode: 'BOS',
      offeringTeamCode: 'LAL',
      offerSheetId: 'os-governed-1',
      dedupKey: 'os:world_test_123:LAL:player123:2025-26',
      ...payloadPatch,
    },
    currentState: {
      homeTeam,
      offeringTeam,
      offerSheetId: 'os-governed-1',
      ...statePatch,
    },
    seasonId: '2025-26',
    timestamp: Date.parse('2025-07-10T04:00:00Z'),
    asOfDate,
    worldId: 'world_test_123',
  } as Parameters<typeof computeWorldMutation>[0]);
}

describe('BZE-283 governed RFA Offer Sheet workflow', () => {
  it('stores one certified lifecycle identically on both Teams and reserves Team Salary', () => {
    const result = store();
    expect(result.success, result.error).toBe(true);
    const offering = changedTeam(result, 'LAL');
    const home = changedTeam(result, 'BOS');
    const outgoing = offering.offerSheets?.[0];
    const incoming = home.incomingOfferSheets?.[0];
    expect(outgoing?.createdAt).toBe('2025-07-08T10:00:00-04:00');
    expect(outgoing?.governedLifecycle).toEqual(incoming?.governedLifecycle);
    const lifecycle = GovernedOfferSheetLifecycleZ.parse(
      outgoing?.governedLifecycle
    );
    expect(lifecycle.status).toBe('pending-match');
    expect(lifecycle.reservations.offeringTeamSalaryReference).toMatchObject({
      ledgerKind: 'team-salary',
      asOfDate: '2025-07-08T09:55:00-04:00',
      salaryCap: 500_000_000,
      canonLeafIds: ['CBA2-L04.3'],
    });
    expect(
      lifecycle.reservations.offeringTeamSalaryReference.teamStateReference
    ).toMatch(/^world_test_123:LAL:/);
    expect(lifecycle.events[0]).toMatchObject({
      eventKind: 'offer-sheet-signed',
      exerciseNoticeDeadline: '2025-07-09T23:59:59-04:00',
    });
    expect(offering.totals?.outstandingOfferSheetTotal).toBe(10_000_000);
    expect(result.metadata?.governedOfferSheetLifecycle).toEqual(lifecycle);
  });

  it.each([
    ['missing proposal', { proposal: null }, 'Principal Terms'],
    [
      'wrong world evidence',
      {
        currentState: makeGovernedOfferSheetState(
          makeGovernedOfferSheetEvidence({ worldId: 'another-world' })
        ),
      },
      'does not match',
    ],
    [
      'tardy QO',
      {
        currentState: makeGovernedOfferSheetState(
          makeGovernedOfferSheetEvidence({
            qualifyingOffer: {
              ...makeGovernedOfferSheetEvidence().qualifyingOffer,
              deliveredAt: '2025-06-29T17:00:01-04:00',
            },
          })
        ),
      },
      'June 29',
    ],
    [
      'withdrawn QO',
      {
        currentState: makeGovernedOfferSheetState(
          makeGovernedOfferSheetEvidence({
            qualifyingOffer: {
              ...makeGovernedOfferSheetEvidence().qualifyingOffer,
              withdrawnAt: '2025-07-08T09:00:00-04:00',
            },
          })
        ),
      },
      'withdrawn',
    ],
    [
      'stale authority',
      {
        currentState: makeGovernedOfferSheetState(
          makeGovernedOfferSheetEvidence({
            qualifyingOffer: {
              ...makeGovernedOfferSheetEvidence().qualifyingOffer,
              recordStatus: 'superseded',
            },
          })
        ),
      },
      'stale',
    ],
    [
      'unknown evidence',
      {
        currentState: makeGovernedOfferSheetState(
          makeGovernedOfferSheetEvidence({ status: 'unknown' })
        ),
      },
      'incomplete',
    ],
    [
      'conflicting evidence',
      {
        currentState: makeGovernedOfferSheetState(
          makeGovernedOfferSheetEvidence({ status: 'conflicting' })
        ),
      },
      'conflicts',
    ],
    [
      'QO calculation mismatch',
      {
        currentState: makeGovernedOfferSheetState(
          makeGovernedOfferSheetEvidence({
            qualifyingOffer: {
              ...makeGovernedOfferSheetEvidence().qualifyingOffer,
              calculation: {
                ...makeGovernedOfferSheetEvidence().qualifyingOffer.calculation,
                certifiedAmount: 4_999_999,
              },
            },
          })
        ),
      },
      'certified calculation',
    ],
    ['missing world date', { asOfDate: null }, 'Team Plan date'],
  ])('fails closed with no mutation for %s', (_label, overrides, message) => {
    const result = store(overrides as Record<string, unknown>);
    expect(result.success).toBe(false);
    expect(result.error).toContain(message);
    expect(result.teamUpdates ?? []).toHaveLength(0);
  });

  it('does not let a mutable retry replace signed Principal Terms', () => {
    const first = store();
    expect(first.success).toBe(true);
    const changedProposal = makeGovernedOfferSheetProposal({
      principalTermsDocumentId: 'different-principal-terms',
    });
    const retry = store({
      offerSheetId: 'os-governed-retry',
      proposal: changedProposal,
      contract: makeGovernedOfferSheetContract(changedProposal),
      currentState: {
        ...makeGovernedOfferSheetState(),
        team: changedTeam(first, 'LAL'),
        homeTeam: changedTeam(first, 'BOS'),
      },
    });
    expect(retry.success).toBe(false);
    expect(retry.error).toContain('changed its signed Principal Terms');
  });

  it('blocks when dated Team Salary does not preserve the offered Room', () => {
    const currentState = makeGovernedOfferSheetState();
    const result = store({
      currentState: {
        ...currentState,
        team: {
          ...currentState.team,
          players: [
            {
              player_id: 'room-consumer',
              contract: {
                salariesByYear: [
                  { season: '2025-26', salary: 499_000_000, capHit: 499_000_000 },
                ],
              },
            },
          ],
        },
      },
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('sufficient governed Room');
    expect(result.teamUpdates ?? []).toHaveLength(0);
  });

  it('matches at the exact deadline, archives restrictions, and removes both active mirrors', () => {
    const stored = store();
    const matched = resolve(stored, 'matchOfferSheet');
    expect(matched.success, matched.error).toBe(true);
    expect(changedTeam(matched, 'BOS').incomingOfferSheets).toEqual([]);
    expect(changedTeam(matched, 'LAL').offerSheets).toEqual([]);
    const lifecycle = GovernedOfferSheetLifecycleZ.parse(
      matched.metadata?.governedOfferSheetLifecycle
    );
    expect(lifecycle.status).toBe('matched');
    expect(lifecycle.events.at(-1)).toMatchObject({
      eventKind: 'offer-sheet-matched',
      restrictionsUntil: '2026-07-09T23:59:59-04:00',
      playerTradeConsentRequired: true,
      offeringTeamTradeBarred: true,
      signAndTradeBarred: true,
    });
    expect(matched.playerUpdates).toHaveLength(1);
    expect(matched.playerDeletes).toEqual([]);
  });

  it('blocks a match one second late without changing either Team', () => {
    const result = resolve(
      store(),
      'matchOfferSheet',
      '2025-07-10T00:00:00-04:00'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('deadline has passed');
    expect(result.teamUpdates ?? []).toHaveLength(0);
  });

  it('declines atomically and moves the player exactly once', () => {
    const declined = resolve(store(), 'declineOfferSheet');
    expect(declined.success, declined.error).toBe(true);
    expect(changedTeam(declined, 'LAL').players?.map((player) => player.player_id)).toEqual([
      'player123',
    ]);
    expect(changedTeam(declined, 'BOS').players).toEqual([]);
    expect(declined.playerUpdates).toHaveLength(1);
    expect(declined.playerDeletes).toEqual([
      { playerId: 'player123', teamCode: 'BOS' },
    ]);
  });

  it('rejects divergent Team mirrors before resolution', () => {
    const stored = store();
    const homeTeam = changedTeam(stored, 'BOS');
    const incoming = homeTeam.incomingOfferSheets?.[0];
    const corruptedHome = {
      ...homeTeam,
      incomingOfferSheets: [
        {
          ...incoming,
          governedLifecycle: {
            ...(incoming?.governedLifecycle as Record<string, unknown>),
            ledgerVersion: 99,
          },
        },
      ],
    };
    const result = resolve(stored, 'matchOfferSheet', undefined, {
      homeTeam: corruptedHome,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('mirrors disagree');
  });

  it('applies exact before-noon, at-noon, and Moratorium notice deadlines', () => {
    expect(exerciseNoticeDeadline('2025-07-08T11:59:59-04:00')).toBe(
      '2025-07-09T23:59:59-04:00'
    );
    expect(exerciseNoticeDeadline('2025-07-08T12:00:00-04:00')).toBe(
      '2025-07-10T23:59:59-04:00'
    );
    expect(exerciseNoticeDeadline('2025-07-06T23:59:59-04:00')).toBe(
      '2025-07-07T23:59:59-04:00'
    );
  });

  it('uses Average Annual Salary for the offering Team on an Arenas sheet', () => {
    const proposal = makeGovernedOfferSheetProposal({
      salariesByYear: [
        {
          ...makeGovernedOfferSheetProposal().salariesByYear[0],
          regularSalary: 15_000_000,
          salaryExcludingIncentive: 15_000_000,
        },
        {
          ...makeGovernedOfferSheetProposal().salariesByYear[1],
          regularSalary: 15_750_000,
          salaryExcludingIncentive: 15_750_000,
        },
        {
          ...makeGovernedOfferSheetProposal().salariesByYear[0],
          season: '2027-28',
          regularSalary: 40_000_000,
          salaryExcludingIncentive: 40_000_000,
        },
        {
          ...makeGovernedOfferSheetProposal().salariesByYear[0],
          season: '2028-29',
          regularSalary: 41_800_000,
          salaryExcludingIncentive: 41_800_000,
        },
      ],
    });
    const evidence = makeGovernedOfferSheetEvidence({
      eligibility: {
        ...makeGovernedOfferSheetEvidence().eligibility,
        yearsOfService: 2,
      },
    });
    const result = store({
      proposal,
      contract: makeGovernedOfferSheetContract(proposal),
      currentState: makeGovernedOfferSheetState(evidence),
    });
    expect(result.success, result.error).toBe(true);
    const lifecycle = GovernedOfferSheetLifecycleZ.parse(
      pendingSheet(result).governedLifecycle
    );
    expect(lifecycle.reservations.offeringTeamAccounting).toBe(
      'average-annual-salary'
    );
    expect(lifecycle.reservations.offeringTeam.map((row) => row.amount)).toEqual([
      28_137_500, 28_137_500, 28_137_500, 28_137_500,
    ]);
  });

  it('records a timely matching-Team averaging election with the Exercise Notice', () => {
    const base = makeGovernedOfferSheetProposal().salariesByYear[0];
    const proposal = makeGovernedOfferSheetProposal({
      salariesByYear: [15_000_000, 15_750_000, 40_000_000].map(
        (salary, index) => ({
          ...base,
          season: `${2025 + index}-${String(26 + index).padStart(2, '0')}`,
          salaryExcludingIncentive: salary,
          regularSalary: salary,
        })
      ),
    });
    const evidence = makeGovernedOfferSheetEvidence({
      eligibility: {
        ...makeGovernedOfferSheetEvidence().eligibility,
        yearsOfService: 2,
      },
    });
    const stored = store({
      proposal,
      contract: makeGovernedOfferSheetContract(proposal),
      currentState: makeGovernedOfferSheetState(evidence),
    });
    const resolutionAt = '2025-07-09T17:00:00-04:00';
    const election = {
      statementId: 'averaging-election-player123-v1',
      deliveredToNbaAt: resolutionAt,
      relayedToPlayersAssociationAt: '2025-07-10T17:00:00-04:00',
    };
    const matched = resolve(stored, 'matchOfferSheet', resolutionAt, {}, {
      offerSheetAveragingElection: election,
    });
    expect(matched.success, matched.error).toBe(true);
    const lifecycle = GovernedOfferSheetLifecycleZ.parse(
      matched.metadata?.governedOfferSheetLifecycle
    );
    expect(lifecycle.reservations.homeTeamAccounting).toBe(
      'average-annual-salary'
    );
    expect(lifecycle.events.at(-1)).toMatchObject({
      eventKind: 'offer-sheet-matched',
      averagingElection: election,
    });
  });

  it('blocks an averaging election that was not delivered with the Exercise Notice', () => {
    const base = makeGovernedOfferSheetProposal().salariesByYear[0];
    const proposal = makeGovernedOfferSheetProposal({
      salariesByYear: [15_000_000, 15_750_000, 40_000_000].map(
        (salary, index) => ({
          ...base,
          season: `${2025 + index}-${String(26 + index).padStart(2, '0')}`,
          salaryExcludingIncentive: salary,
          regularSalary: salary,
        })
      ),
    });
    const evidence = makeGovernedOfferSheetEvidence({
      eligibility: {
        ...makeGovernedOfferSheetEvidence().eligibility,
        yearsOfService: 2,
      },
    });
    const stored = store({
      proposal,
      contract: makeGovernedOfferSheetContract(proposal),
      currentState: makeGovernedOfferSheetState(evidence),
    });
    const result = resolve(
      stored,
      'matchOfferSheet',
      '2025-07-09T17:00:00-04:00',
      {},
      {
        offerSheetAveragingElection: {
          statementId: 'averaging-election-player123-v1',
          deliveredToNbaAt: '2025-07-09T17:00:01-04:00',
          relayedToPlayersAssociationAt: '2025-07-10T17:00:00-04:00',
        },
      }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('with the Exercise Notice');
    expect(result.teamUpdates ?? []).toHaveLength(0);
  });

  it.each([
    ['first-year NTMLE', 15_000_001, 15_750_000, 40_000_000, 41_800_000, 'NTMLE'],
    ['second-year basis', 15_000_000, 15_750_001, 40_000_000, 41_800_000, 'more than 5%'],
    ['third-year maximum', 15_000_000, 15_750_000, 40_000_001, 41_800_000, 'maximum'],
    ['fourth-year change', 15_000_000, 15_750_000, 40_000_000, 41_800_001, '4.5%'],
  ])('blocks the Arenas %s boundary independently', (_label, y1, y2, y3, y4, message) => {
    const base = makeGovernedOfferSheetProposal().salariesByYear[0];
    const proposal = makeGovernedOfferSheetProposal({
      salariesByYear: [y1, y2, y3, y4].map((salary, index) => ({
        ...base,
        season: `${2025 + index}-${String(26 + index).padStart(2, '0')}`,
        salaryExcludingIncentive: salary,
        regularSalary: salary,
      })),
    });
    const evidence = makeGovernedOfferSheetEvidence({
      eligibility: {
        ...makeGovernedOfferSheetEvidence().eligibility,
        yearsOfService: 2,
      },
    });
    const result = store({
      proposal,
      contract: makeGovernedOfferSheetContract(proposal),
      currentState: makeGovernedOfferSheetState(evidence),
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain(message);
  });
});
