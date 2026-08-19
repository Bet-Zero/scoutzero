import { describe, expect, it } from 'vitest';

import { computeWorldMutation } from '@/features/architect/utils/mutationPipeline';
import {
  compareInstant,
  exerciseNoticeDeadline,
  oneYearAfter,
} from '@/features/architect/utils/offerSheets/governedOfferSheetTime';
import { GovernedOfferSheetLifecycleZ } from '@/schemas/governedOfferSheet';
import {
  makeGovernedOfferSheetContract,
  makeGovernedOfferSheetEvidence,
  makeGovernedOfferSheetFixture,
  makeGovernedOfferSheetProposal,
  makeGovernedOfferSheetState,
} from '../fixtures/architect/governedOfferSheet';

function store(overrides: Record<string, unknown> = {}) {
  const defaultProposal = makeGovernedOfferSheetProposal();
  const proposalInput = Object.prototype.hasOwnProperty.call(
    overrides,
    'proposal'
  )
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
  const team = result.teamUpdates?.find(
    (update) => update.teamCode === teamCode
  )?.team;
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
      offerSheetResolutionAt: asOfDate,
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
    asOfDate:
      typeof payloadPatch.offerSheetAveragingElection === 'object' &&
      payloadPatch.offerSheetAveragingElection !== null &&
      'relayedToPlayersAssociationAt' in
        payloadPatch.offerSheetAveragingElection
        ? String(
            payloadPatch.offerSheetAveragingElection
              .relayedToPlayersAssociationAt
          ).slice(0, 10)
        : String(asOfDate).slice(0, 10),
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
      'non-Eastern signing time',
      {
        proposal: makeGovernedOfferSheetProposal({
          signedAt: '2025-07-08T13:55:00Z',
        }),
      },
      'Eastern-time instant',
    ],
    [
      'wrong seasonal Eastern offset',
      {
        proposal: makeGovernedOfferSheetProposal({
          signedAt: '2025-07-08T09:55:00-05:00',
        }),
      },
      'Eastern-time instant',
    ],
    [
      'receipt before signing',
      {
        proposal: makeGovernedOfferSheetProposal({
          receivedAt: '2025-07-08T09:54:59-04:00',
        }),
      },
      'received before it is signed',
    ],
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
      'undocumented QO extension',
      {
        currentState: makeGovernedOfferSheetState(
          makeGovernedOfferSheetEvidence({
            qualifyingOffer: {
              ...makeGovernedOfferSheetEvidence().qualifyingOffer,
              openThrough: '2025-10-02T23:59:59-04:00',
            },
          })
        ),
      },
      'written extension record',
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
      'internally conflicting RFA category',
      {
        currentState: makeGovernedOfferSheetState(
          makeGovernedOfferSheetEvidence({
            eligibility: {
              ...makeGovernedOfferSheetEvidence().eligibility,
              qualifyingTwoWayService: true,
            },
          })
        ),
      },
      'internally conflicting',
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
    [
      'Maximum QO schedule mismatch',
      {
        currentState: makeGovernedOfferSheetState(
          makeGovernedOfferSheetEvidence({
            qualifyingOffer: {
              ...makeGovernedOfferSheetEvidence().qualifyingOffer,
              branch: 'maximum',
              amount: 40_000_000,
              contractYears: 5,
              annualRaiseBasisPoints: 800,
              annualBaseSchedule: [
                40_000_000, 43_200_000, 46_400_000, 49_600_000, 52_800_001,
              ],
              calculation: {
                ...makeGovernedOfferSheetEvidence().qualifyingOffer.calculation,
                certifiedAmount: 40_000_000,
              },
            },
          })
        ),
      },
      'does not use 8% of first-year Base',
    ],
    [
      'expired home matching authority',
      {
        currentState: makeGovernedOfferSheetState(
          makeGovernedOfferSheetEvidence({
            homeTeamMatchingAuthority: {
              ...makeGovernedOfferSheetEvidence().homeTeamMatchingAuthority,
              effectiveThrough: '2025-07-09T23:59:58-04:00',
            },
          })
        ),
      },
      'throughout the Exercise Notice period',
    ],
    [
      'insufficient home matching authority',
      {
        currentState: makeGovernedOfferSheetState(
          makeGovernedOfferSheetEvidence({
            homeTeamMatchingAuthority: {
              ...makeGovernedOfferSheetEvidence().homeTeamMatchingAuthority,
              amount: 9_999_999,
            },
          })
        ),
      },
      'insufficient for the signed Principal Terms',
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

  it('rejects a saved Contract whose bonus totals diverge from signed Principal Terms', () => {
    const proposal = makeGovernedOfferSheetProposal({
      salariesByYear: makeGovernedOfferSheetProposal().salariesByYear.map(
        (row, index) => ({
          ...row,
          salaryExcludingIncentive: row.regularSalary - 500_000,
          bonuses: [
            {
              bonusId: `likely-${index + 1}`,
              classification: 'likely' as const,
              amount: 500_000,
            },
          ],
        })
      ),
    });
    const contract = makeGovernedOfferSheetContract(proposal);
    const result = store({
      proposal,
      contract: {
        ...contract,
        salariesByYear: contract.salariesByYear.map((row) => ({
          ...row,
          incentives: { likely: 499_999, unlikely: 0 },
        })),
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('do not match the saved Contract');
    expect(result.teamUpdates ?? []).toHaveLength(0);
  });

  it('blocks a second outstanding Offer Sheet for the same player', () => {
    const first = store();
    const offeringTeam = changedTeam(first, 'LAL');
    const homeTeam = changedTeam(first, 'BOS');
    const existing = offeringTeam.offerSheets?.[0];
    if (!existing) throw new Error('Missing first Offer Sheet');

    const result = store({
      offerSheetId: 'os-governed-2',
      currentState: {
        ...makeGovernedOfferSheetState(),
        team: {
          ...offeringTeam,
          offerSheets: [{ ...existing, dedupKey: 'another-outstanding-key' }],
        },
        homeTeam,
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('another outstanding Offer Sheet');
    expect(result.teamUpdates ?? []).toHaveLength(0);
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
                  {
                    season: '2025-26',
                    salary: 499_000_000,
                    capHit: 499_000_000,
                  },
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

  it('counts every other governed reservation exactly once in the Room test', () => {
    const currentState = makeGovernedOfferSheetState();
    const other = makeGovernedOfferSheetFixture({
      worldId: 'world_test_123',
      playerId: 'other-player',
      homeTeamId: 'NYK',
      offeringTeamId: 'LAL',
      offerSheetId: 'os-other-player',
      salariesByYear: [
        { season: '2025-26', salary: 15_000_000 },
        { season: '2026-27', salary: 15_750_000 },
      ],
    });
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
                  {
                    season: '2025-26',
                    salary: 480_000_000,
                    capHit: 480_000_000,
                  },
                ],
              },
            },
          ],
          offerSheets: [
            {
              id: 'os-other-player',
              dedupKey: 'os:world_test_123:LAL:other-player:2025-26',
              playerId: 'other-player',
              playerName: 'Other Player',
              offeringTeamCode: 'LAL',
              homeTeamCode: 'NYK',
              seasonKey: '2025-26',
              year: 2026,
              contractYears: 2,
              salariesByYear: other.contract.salariesByYear,
              status: 'PENDING_MATCH',
              createdAt: other.proposal.receivedAt,
              totalValue: other.contract.totalValue,
              governedLifecycle: other.lifecycle,
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
    expect(changedTeam(matched, 'LAL').totals?.outstandingOfferSheetTotal).toBe(
      0
    );
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
    expect(matched.playerUpdates?.[0]?.player.contract).toMatchObject({
      offerSheetMatchRestriction: {
        restrictionVersion: 1,
        lifecycleId: lifecycle.ledgerId,
        eventId: lifecycle.events.at(-1)?.eventId,
        matchedAt: '2025-07-09T23:59:59-04:00',
        restrictedUntil: '2026-07-09T23:59:59-04:00',
        offeringTeamId: 'LAL',
        playerTradeConsentRequired: true,
        offeringTeamTradeBarred: true,
        signAndTradeBarred: true,
      },
      tradeRestrictions: expect.arrayContaining([
        expect.stringContaining('player consent required'),
        expect.stringContaining('contract amendment'),
      ]),
    });
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

  it('blocks a resolution before the certified Offer Sheet receipt', () => {
    const result = resolve(
      store(),
      'declineOfferSheet',
      '2025-07-08T09:59:59-04:00'
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('before the home Team receives it');
    expect(result.teamUpdates ?? []).toHaveLength(0);
  });

  it('declines atomically and moves the player exactly once', () => {
    const declined = resolve(store(), 'declineOfferSheet');
    expect(declined.success, declined.error).toBe(true);
    expect(
      changedTeam(declined, 'LAL').players?.map((player) => player.player_id)
    ).toEqual(['player123']);
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

  it('rejects a mirror envelope whose player identity disagrees with its lifecycle', () => {
    const stored = store();
    const homeTeam = changedTeam(stored, 'BOS');
    const incoming = homeTeam.incomingOfferSheets?.[0];
    const result = resolve(stored, 'matchOfferSheet', undefined, {
      homeTeam: {
        ...homeTeam,
        incomingOfferSheets: [{ ...incoming, playerId: 'wrong-player' }],
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('authenticated lifecycle identity');
    expect(result.teamUpdates ?? []).toHaveLength(0);
  });

  it('rejects ambiguous identity matches instead of selecting the first mirror', () => {
    const stored = store();
    const homeTeam = changedTeam(stored, 'BOS');
    const incoming = homeTeam.incomingOfferSheets?.[0];
    const result = resolve(stored, 'matchOfferSheet', undefined, {
      homeTeam: {
        ...homeTeam,
        incomingOfferSheets: [incoming, { ...incoming, id: 'duplicate-id' }],
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('exactly one matching mirror');
    expect(result.teamUpdates ?? []).toHaveLength(0);
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
    expect(exerciseNoticeDeadline('2025-10-31T12:00:00-04:00')).toBe(
      '2025-11-02T23:59:59-05:00'
    );
  });

  it('uses the target date Eastern offset for one-year restrictions and normalizes leap day', () => {
    expect(oneYearAfter('2025-11-01T17:00:00-04:00')).toBe(
      '2026-11-01T17:00:00-05:00'
    );
    expect(oneYearAfter('2024-02-29T17:00:00-05:00')).toBe(
      '2025-02-28T17:00:00-05:00'
    );
    expect(
      Number.isNaN(
        compareInstant('2025-02-30T12:00:00-05:00', '2025-03-01T12:00:00-05:00')
      )
    ).toBe(true);
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
    expect(
      lifecycle.reservations.offeringTeam.map((row) => row.amount)
    ).toEqual([28_137_500, 28_137_500, 28_137_500, 28_137_500]);
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
      deliveredToNbaAt: '2025-07-09T18:00:00-04:00',
      relayedToPlayersAssociationAt: '2025-07-10T17:00:00-04:00',
    };
    const matched = resolve(
      stored,
      'matchOfferSheet',
      resolutionAt,
      {},
      {
        offerSheetAveragingElection: election,
      }
    );
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
      matchingTeamSalaryReference: {
        ledgerKind: 'team-salary',
        asOfDate: resolutionAt,
        salaryCap: 500_000_000,
        canonLeafIds: ['CBA2-C15.10'],
      },
    });
    expect(matched.playerUpdates?.[0]?.player.contract?.salariesByYear).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          season: '2025-26',
          salary: 15_000_000,
          capHit: 23_583_333.33,
        }),
        expect.objectContaining({
          season: '2027-28',
          salary: 40_000_000,
          capHit: 23_583_333.33,
        }),
      ])
    );
  });

  it('persists the signed incentive breakdown when the home Team declines', () => {
    const proposal = makeGovernedOfferSheetProposal({
      salariesByYear: makeGovernedOfferSheetProposal().salariesByYear.map(
        (row, index) => ({
          ...row,
          salaryExcludingIncentive: row.regularSalary - 500_000,
          bonuses: [
            {
              bonusId: `likely-${index + 1}`,
              classification: 'likely' as const,
              amount: 500_000,
            },
          ],
        })
      ),
    });
    const declined = resolve(
      store({ proposal, contract: makeGovernedOfferSheetContract(proposal) }),
      'declineOfferSheet'
    );

    expect(declined.success, declined.error).toBe(true);
    expect(
      declined.playerUpdates?.[0]?.player.contract?.salariesByYear
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          season: '2025-26',
          salary: 10_000_000,
          capHit: 10_000_000,
          incentives: { likely: 500_000, unlikely: 0 },
        }),
      ])
    );
  });

  it('blocks the averaging election when the matching Team is not below the cap', () => {
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
    const homeTeam = changedTeam(stored, 'BOS');
    const resolutionAt = '2025-07-09T17:00:00-04:00';
    const result = resolve(
      stored,
      'matchOfferSheet',
      resolutionAt,
      {
        homeTeam: {
          ...homeTeam,
          players: [
            ...(homeTeam.players ?? []),
            {
              player_id: 'above-cap-player',
              contract: {
                salariesByYear: [
                  {
                    season: '2025-26',
                    salary: 500_000_000,
                    capHit: 500_000_000,
                  },
                ],
              },
            },
          ],
        },
      },
      {
        offerSheetAveragingElection: {
          statementId: 'averaging-election-player123-v1',
          deliveredToNbaAt: resolutionAt,
          relayedToPlayersAssociationAt: '2025-07-10T17:00:00-04:00',
        },
      }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('below-cap matching Team');
    expect(result.teamUpdates ?? []).toHaveLength(0);
  });

  it('blocks an averaging election that was not delivered on the Exercise Notice date', () => {
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
          deliveredToNbaAt: '2025-07-10T00:00:00-04:00',
          relayedToPlayersAssociationAt: '2025-07-10T17:00:00-04:00',
        },
      }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('on the Exercise Notice date');
    expect(result.teamUpdates ?? []).toHaveLength(0);
  });

  it('blocks an averaging-election relay after one business day', () => {
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
          deliveredToNbaAt: '2025-07-09T18:00:00-04:00',
          relayedToPlayersAssociationAt: '2025-07-11T17:00:00-04:00',
        },
      }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('within one business day');
    expect(result.teamUpdates ?? []).toHaveLength(0);
  });

  it('requires an exact Eastern Players Association relay instant', () => {
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
          deliveredToNbaAt: '2025-07-09T18:00:00-04:00',
          relayedToPlayersAssociationAt: '2025-07-10T21:00:00Z',
        },
      }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain(
      'Players Association relay must be an exact Eastern-time instant'
    );
    expect(result.teamUpdates ?? []).toHaveLength(0);
  });

  it.each([
    [
      'first-year NTMLE',
      15_000_001,
      15_750_000,
      40_000_000,
      41_800_000,
      'NTMLE',
    ],
    [
      'second-year basis',
      15_000_000,
      15_750_001,
      40_000_000,
      41_800_000,
      'more than 5%',
    ],
    [
      'third-year maximum',
      15_000_000,
      15_750_000,
      40_000_001,
      41_800_000,
      'maximum',
    ],
    [
      'fourth-year change',
      15_000_000,
      15_750_000,
      40_000_000,
      41_800_001,
      '4.5%',
    ],
    [
      'third-year jump prerequisite',
      15_000_000,
      15_749_999,
      40_000_000,
      41_800_000,
      'maximum permitted first two',
    ],
  ])(
    'blocks the Arenas %s boundary independently',
    (_label, y1, y2, y3, y4, message) => {
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
    }
  );

  it('blocks nonconsecutive Principal Terms Salary Cap Years', () => {
    const base = makeGovernedOfferSheetProposal().salariesByYear[0];
    const proposal = makeGovernedOfferSheetProposal({
      salariesByYear: [
        base,
        {
          ...base,
          season: '2027-28',
          salaryExcludingIncentive: 10_500_000,
          regularSalary: 10_500_000,
        },
      ],
    });
    const result = store({
      proposal,
      contract: makeGovernedOfferSheetContract(proposal),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('consecutive Salary Cap Years');
  });

  it('requires a dated third-year maximum for an Arenas jump', () => {
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
    const originalEvidence = makeGovernedOfferSheetEvidence();
    const evidence = makeGovernedOfferSheetEvidence({
      eligibility: { ...originalEvidence.eligibility, yearsOfService: 2 },
      league: {
        ...originalEvidence.league,
        maximumSalaryBySeason:
          originalEvidence.league.maximumSalaryBySeason.filter(
            (row) => row.season !== '2027-28'
          ),
      },
    });
    const result = store({
      proposal,
      contract: makeGovernedOfferSheetContract(proposal),
      currentState: makeGovernedOfferSheetState(evidence),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain(
      'third-year offering Team maximum is missing'
    );
  });
});
