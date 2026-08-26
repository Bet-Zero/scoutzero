import { describe, expect, it } from 'vitest';
import { resolveGovernedIncompleteRosterCharge } from '@/features/architect/utils/capTotals/governedIncompleteRosterCharge';
import { validateNonTradeMutationStage } from '@/features/architect/utils/nonTradeMutationValidationStage';
import { makePendingGovernedOfferSheetLifecycle } from '../../../../tests/fixtures/architect/governedOfferSheet';

const YEAR = 2027;
const MINIMUM = 1_272_870;
const ACTIVE_DATE = '2026-07-02T12:00:00-04:00';

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

function pickState(entries: Array<Record<string, unknown>> = []) {
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
      canonLeafIds: ['CBA2-C02.1', 'CBA2-C03.1'] as const,
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
    salaryBookInputs: { unsignedFirstRoundPickState: pickState() },
  };
}

function resolve(
  roster: ReturnType<typeof team>,
  overrides: Partial<Parameters<typeof resolveGovernedIncompleteRosterCharge>[0]> = {}
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

  it.each([
    [
      'missing pick evidence',
      (roster: ReturnType<typeof team>, _args: Record<string, unknown>) =>
        delete (roster.salaryBookInputs as { unsignedFirstRoundPickState?: unknown })
          .unsignedFirstRoundPickState,
    ],
    [
      'projected minimum',
      (_roster: ReturnType<typeof team>, args: Record<string, unknown>) => {
        args.zeroYosMinimumSource = 'projected';
      },
    ],
    [
      'missing date',
      (_roster: ReturnType<typeof team>, args: Record<string, unknown>) => {
        args.asOfDate = null;
      },
    ],
  ] as const)('fails closed for %s', (_label, mutate) => {
    const roster = team(11);
    const args: Record<string, unknown> = {};
    mutate(roster, args);
    const result = resolve(roster, args);
    expect(result.status).toBe('needs-input');
    expect(result.amount).toBeNull();
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
});
