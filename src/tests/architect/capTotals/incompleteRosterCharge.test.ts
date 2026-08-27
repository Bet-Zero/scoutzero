import { describe, expect, it } from 'vitest';
import { createCanonicalTeamTotalsSnapshot } from '@/features/architect/utils/capTotals/computeTeamCapTotals';
import { resolveGovernedIncompleteRosterCharge } from '@/features/architect/utils/capTotals/governedIncompleteRosterCharge';
import { validateNonTradeMutationStage } from '@/features/architect/utils/nonTradeMutationValidationStage';
import type { GovernedUnsignedFirstRoundPickState } from '@/schemas/governedIncompleteRosterCharge';
import { makePendingGovernedOfferSheetLifecycle } from '../../../../tests/fixtures/architect/governedOfferSheet';

const YEAR = 2027;
const MINIMUM = 1_357_763;
const ACTIVE_DATE = '2026-07-02T12:00:00-04:00';

type ResolveInput = Parameters<
  typeof resolveGovernedIncompleteRosterCharge
>[0];
type ResolveOverrides = Partial<
  Omit<ResolveInput, 'team' | 'salaryCapYear'>
>;
type UnavailableCaseMutator = (
  roster: ReturnType<typeof team>,
  overrides: ResolveOverrides
) => void;

function player(index: number, contractType = 'Standard') {
  return {
    id: `player-${index}`,
    contract: {
      contractType,
      salariesByYear: [
        { season: '2026-27', salary: 2_000_000, capHit: 2_000_000 },
      ],
    },
  };
}

function pickState(
  entries: Extract<
    GovernedUnsignedFirstRoundPickState,
    { status: 'ready' }
  >['entries'] = []
): Extract<GovernedUnsignedFirstRoundPickState, { status: 'ready' }> {
  return {
    version: 1 as const,
    status: 'ready' as const,
    teamCode: 'MIA',
    salaryCapYear: YEAR,
    entries,
    source: {
      evidenceId: 'test:unsigned-first-round-picks:MIA:2027',
      evidenceVersion: 1,
      authority: 'external-determination' as const,
      reference: 'authenticated-test-team-state',
      authenticatedAt: '2026-07-01T00:00:00-04:00',
      recordStatus: 'current' as const,
      canonLeafIds: ['CBA2-C02.1', 'CBA2-C03.1'],
    },
  };
}

function team(count: number) {
  return {
    id: 'MIA',
    teamId: 'MIA',
    teamCode: 'MIA',
    worldId: 'world-bze-293',
    players: Array.from({ length: count }, (_, index) => player(index)),
    capHolds: [] as Array<Record<string, unknown>>,
    offerSheets: [],
    salaryBookInputs: {
      version: 1 as const,
      salaryCapYear: YEAR,
      unsignedFirstRoundPickState: pickState(),
      apronAdjustments: {
        status: 'not-evaluated' as const,
        reason: 'Not needed for resolver fixtures.',
      },
      taxSalary: {
        status: 'not-evaluated' as const,
        reason: 'Not needed for resolver fixtures.',
      },
    },
  };
}

function resolve(
  roster: ReturnType<typeof team>,
  overrides: ResolveOverrides = {}
) {
  return resolveGovernedIncompleteRosterCharge({
    team: roster,
    salaryCapYear: YEAR,
    asOfDate: ACTIVE_DATE,
    zeroYosMinimum: MINIMUM,
    zeroYosMinimumSource: 'real',
    ...overrides,
  });
}

describe('BZE-293 governed incomplete-roster charge', () => {
  it.each([
    [0, 12],
    [10, 2],
    [11, 1],
    [12, 0],
    [14, 0],
    [15, 0],
  ])('uses the C03 threshold of twelve for %i counted players', (count, slots) => {
    const result = resolve(team(count));
    expect(result).toMatchObject({
      status: 'complete',
      activeWindow: true,
      threshold: 12,
      missingSlots: slots,
      chargePerSlot: MINIMUM,
      amount: slots * MINIMUM,
    });
    expect(result.counts?.underContract).toBe(count);
  });

  it('does not count Two-Way players', () => {
    const roster = team(11);
    roster.players.push(player(99, 'Two-Way'));
    const result = resolve(roster);
    expect(result.counts?.underContract).toBe(11);
    expect(result.missingSlots).toBe(1);
  });

  it.each([
    ['2026-07-01T00:00:00-04:00', true],
    ['2026-10-19T23:59:59-04:00', true],
    ['2026-10-20T00:00:00-04:00', false],
    ['2027-04-11T12:00:00-04:00', false],
    ['2027-06-30T23:59:59-04:00', false],
  ])('applies only inside the governed window at %s', (asOfDate, activeWindow) => {
    const result = resolve(team(11), { asOfDate });
    expect(result.status).toBe('complete');
    expect(result.activeWindow).toBe(activeWindow);
    expect(result.amount).toBe(activeWindow ? MINIMUM : 0);
  });

  it('resolves date-only July 1 identically to Eastern-midnight July 1', () => {
    const dateOnly = resolve(team(11), { asOfDate: '2026-07-01' });
    const easternMidnight = resolve(team(11), {
      asOfDate: '2026-07-01T00:00:00-04:00',
    });

    expect(dateOnly).toEqual(easternMidnight);
    expect(dateOnly).toMatchObject({
      status: 'complete',
      activeWindow: true,
      amount: MINIMUM,
    });
  });

  it.each([
    ['2026-06-30', false, 0],
    ['2026-10-20', false, 0],
    ['2026-06-30T20:00:00-11:00', true, MINIMUM],
  ] as const)(
    'compares %s as a governing Eastern calendar day',
    (asOfDate, activeWindow, amount) => {
      const result = resolve(team(11), { asOfDate });
      expect(result).toMatchObject({
        status: 'complete',
        activeWindow,
        amount,
      });
    }
  );

  it('counts an authenticated unsigned first-round pick only when its Team Salary hold reconciles', () => {
    const roster = team(10);
    roster.capHolds = [
      {
        playerId: 'rookie-1',
        playerName: 'Rookie One',
        amount: 4_200_000,
        season: '2026-27',
        type: 'Rookie Scale',
        active: true,
        isSigned: false,
      },
    ];
    roster.salaryBookInputs.unsignedFirstRoundPickState = pickState([
      {
        pickId: '2026:MIA:1:18',
        playerId: 'rookie-1',
        teamCode: 'MIA',
        salaryCapYear: YEAR,
        teamSalaryAmount: 4_200_000,
        includedInTeamSalary: true,
        requiresUnresolvedDraftDetermination: false,
        canonLeafIds: ['CBA2-C02.1', 'CBA2-C03.1'],
      },
    ]);
    const result = resolve(roster);
    expect(result.counts?.unsignedFirstRoundPicks).toBe(1);
    expect(result.counts?.total).toBe(11);
    expect(result.amount).toBe(MINIMUM);
  });

  it('rejects duplicate rookie holds instead of losing one during reconciliation', () => {
    const roster = team(10);
    roster.capHolds = [
      {
        playerId: 'rookie-1',
        amount: 4_200_000,
        season: '2026-27',
        type: 'Rookie Scale',
        active: true,
        isSigned: false,
      },
      {
        playerId: 'rookie-1',
        amount: 4_200_000,
        season: '2026-27',
        type: 'Rookie Scale',
        active: true,
        isSigned: false,
      },
    ];
    roster.salaryBookInputs.unsignedFirstRoundPickState = pickState([
      {
        pickId: '2026:MIA:1:18',
        playerId: 'rookie-1',
        teamCode: 'MIA',
        salaryCapYear: YEAR,
        teamSalaryAmount: 4_200_000,
        includedInTeamSalary: true,
        requiresUnresolvedDraftDetermination: false,
        canonLeafIds: ['CBA2-C02.1', 'CBA2-C03.1'],
      },
    ]);

    const result = resolve(roster);
    expect(result.status).toBe('needs-input');
    expect(result.missingInputs).toContain(
      'salaryBookInputs.unsignedFirstRoundPickState.unmatchedRookieHolds'
    );
  });

  it('reports the original cap-hold index after active-hold filtering', () => {
    const roster = team(10);
    roster.capHolds = [
      {
        playerId: 'inactive-hold',
        amount: 2_000_000,
        season: '2026-27',
        type: 'Bird',
        active: false,
        isSigned: false,
      },
      {
        playerId: 'veteran-fa-1',
        amount: 3_000_000,
        season: '2026-27',
        type: 'Bird',
        active: true,
        isSigned: false,
      },
    ];

    const result = resolve(roster);
    expect(result.status).toBe('needs-input');
    expect(result.missingInputs).toContain(
      'team.capHolds[1].governedVeteranFreeAgentAmount'
    );
  });

  it('counts each governed C03.1 category exactly once', () => {
    const roster = team(8);
    roster.capHolds = [
      {
        playerId: 'veteran-fa-1',
        playerName: 'Veteran Free Agent One',
        amount: 3_000_000,
        season: '2026-27',
        type: 'Bird',
        active: true,
        isSigned: false,
        governedContractEventId: 'contract-event:veteran-fa-1',
      },
    ];
    const offerSheet = makePendingGovernedOfferSheetLifecycle();
    offerSheet.offeringTeamId = 'MIA';
    offerSheet.salaryCapYear = YEAR;
    offerSheet.evidenceSnapshot.salaryCapYear = YEAR;
    offerSheet.reservations.offeringTeam[0].season = '2026-27';
    (roster as unknown as { offerSheets: unknown[] }).offerSheets = [
      {
        status: 'PENDING_MATCH',
        governedLifecycle: offerSheet,
      },
    ];

    const result = resolve(roster);
    expect(result).toMatchObject({
      status: 'complete',
      counts: {
        underContract: 8,
        veteranFreeAgentAmounts: 1,
        offerSheets: 1,
        unsignedFirstRoundPicks: 0,
        total: 10,
      },
      missingSlots: 2,
      amount: 2 * MINIMUM,
    });
  });

  it.each([
    ['unsupported veteran amount', 'veteran'],
    ['wrong-team pending Offer Sheet', 'offer-sheet'],
  ] as const)('fails closed for %s', (_label, variant) => {
    const roster = team(10);
    if (variant === 'veteran') {
      roster.capHolds = [
        {
          playerId: 'veteran-fa-1',
          playerName: 'Veteran Free Agent One',
          amount: 3_000_000,
          season: '2026-27',
          type: 'Bird',
          active: true,
          isSigned: false,
        },
      ];
    } else {
      const offerSheet = makePendingGovernedOfferSheetLifecycle();
      offerSheet.salaryCapYear = YEAR;
      offerSheet.evidenceSnapshot.salaryCapYear = YEAR;
      (roster as unknown as { offerSheets: unknown[] }).offerSheets = [
        {
          status: 'PENDING_MATCH',
          governedLifecycle: offerSheet,
        },
      ];
    }
    const result = resolve(roster);
    expect(result.status).toBe('needs-input');
    expect(result.amount).toBeNull();
  });

  const unavailableCases: ReadonlyArray<
    readonly [string, UnavailableCaseMutator]
  > = [
    [
      'missing pick evidence',
      (roster) =>
        delete (roster.salaryBookInputs as { unsignedFirstRoundPickState?: unknown })
          .unsignedFirstRoundPickState,
    ],
    [
      'projected minimum',
      (_roster, overrides) => {
        overrides.zeroYosMinimumSource = 'projected';
      },
    ],
    [
      'zero minimum',
      (_roster, overrides) => {
        overrides.zeroYosMinimum = 0;
      },
    ],
    [
      'missing date',
      (_roster, overrides) => {
        overrides.asOfDate = null;
      },
    ],
  ];

  it.each(unavailableCases)('fails closed for %s', (_label, mutate) => {
    const roster = team(11);
    const overrides: ResolveOverrides = {};
    mutate(roster, overrides);
    const result = resolve(roster, overrides);
    expect(result.status).toBe('needs-input');
    expect(result.amount).toBeNull();
  });

  it('publishes no shared allocation total while the governed charge is unresolved', () => {
    const roster = team(11);
    (
      roster.salaryBookInputs as {
        unsignedFirstRoundPickState: unknown;
      }
    ).unsignedFirstRoundPickState = null;

    const totals = createCanonicalTeamTotalsSnapshot(roster, YEAR, {
      asOfDate: ACTIVE_DATE,
    });

    expect(totals.incompleteRosterResolution?.status).toBe('needs-input');
    expect(totals.incompleteChargesTotal).toBeNull();
    expect(totals.totalCapAllocations).toBeNull();
    expect(totals.deltas).toEqual({
      vsCap: null,
      vsLuxuryTax: null,
      vsFirstApron: null,
      vsSecondApron: null,
    });
    expect(totals.teamSalary).toBeNull();
    expect(totals.apronTeamSalary).toBeNull();
  });

  it('names a cross-category duplicate instead of returning a number', () => {
    const roster = team(11);
    roster.capHolds = [
      {
        playerId: 'player-1',
        playerName: 'Player 1',
        amount: 3_000_000,
        season: '2026-27',
        type: 'Bird',
        active: true,
        isSigned: false,
        governedContractEventId: 'contract-event:player-1',
      },
    ];
    const result = resolve(roster);
    expect(result.status).toBe('needs-input');
    expect(result.missingInputs.join(' ')).toContain('duplicate-with');
  });
});

describe('BZE-293 governed mutation persistence gate', () => {
  const countChangingMutations = [
    'signFreeAgent',
    'storeOfferSheet',
    'waivePlayer',
    'renounceRights',
    'matchOfferSheet',
    'declineOfferSheet',
    'finalizeMatchedOfferSheet',
    'finalizeDeclinedOfferSheet',
  ] as const;

  it.each(countChangingMutations)(
    'blocks %s before persistence when a governed post-state salary book is incomplete',
    (mutationType) => {
      const result = validateNonTradeMutationStage({
        mutationType,
        payload: {},
        currentState: {},
        computeResult: {
          success: true,
          teamUpdates: [
            {
              teamCode: 'MIA',
              team: {
                totals: {
                  incompleteRosterResolution: { mode: 'governed' },
                  salaryBooks: {
                    ledgers: {
                      teamSalary: {
                        status: 'needs-input',
                        reason: 'Unsigned first-round pick state is unresolved.',
                        missingInputs: [
                          'salaryBookInputs.unsignedFirstRoundPickState',
                        ],
                      },
                      apronTeamSalary: { status: 'complete' },
                    },
                  },
                },
              },
            },
          ],
        },
        seasonId: '2026-27',
        asOfDate: ACTIVE_DATE,
        dateDefaulted: false,
        worldId: 'world-bze-293',
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('No changes were saved for MIA');
      expect(result.violations?.[0]).toContain(
        'governed_incomplete_roster_books_required'
      );
      expect(result.violations?.[0]).toContain(
        'salaryBookInputs.unsignedFirstRoundPickState'
      );
    }
  );

  it('blocks a governed post-state that drops the derived resolution entirely', () => {
    const result = validateNonTradeMutationStage({
      mutationType: 'signFreeAgent',
      payload: {},
      currentState: {},
      computeResult: {
        success: true,
        teamUpdates: [
          {
            teamCode: 'MIA',
            team: {
              salaryBookInputs: {
                version: 1,
                salaryCapYear: YEAR,
                unsignedFirstRoundPickState: pickState(),
                apronAdjustments: {
                  status: 'not-evaluated',
                  reason: 'Not needed for this gate fixture.',
                },
                taxSalary: {
                  status: 'not-evaluated',
                  reason: 'Not needed for this gate fixture.',
                },
              },
              totals: {},
            },
          },
        ],
      },
      seasonId: '2026-27',
      asOfDate: ACTIVE_DATE,
      dateDefaulted: false,
      worldId: 'world-bze-293',
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain(
      'governed incomplete-roster result is missing'
    );
    expect(result.violations?.[0]).toContain(
      'governed_incomplete_roster_books_required'
    );
  });

  it('blocks a count-changing operation that drops the governed Team update', () => {
    const result = validateNonTradeMutationStage({
      mutationType: 'waivePlayer',
      payload: {},
      currentState: {
        team: team(11),
        player: player(1),
      },
      computeResult: {
        success: true,
        teamUpdates: [],
      },
      seasonId: '2026-27',
      asOfDate: ACTIVE_DATE,
      dateDefaulted: false,
      worldId: 'world-bze-293',
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain(
      'did not produce a reconciled post-action Team state'
    );
    expect(result.violations?.[0]).toContain(
      'governed_incomplete_roster_books_required'
    );
  });
});
