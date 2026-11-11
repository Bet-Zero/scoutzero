import { describe, expect, it } from 'vitest';
import {
  moveTradeMinimumUplifts,
  tradeMinimumUpliftFor,
} from '@/features/architect/utils/tradeMachine/utils/tradeMinimumUplift';

const DAY = '2026-06-05';
const START = `${DAY}T00:00:00.000Z`;

const line = (
  id: string,
  amount: number,
  leaf = 'CBA2-C07.3',
  extra: Record<string, unknown> = {}
) => ({
  id,
  ledger: 'apron-team-salary' as const,
  label: `row ${id}`,
  amount,
  effectiveFrom: START,
  canonLeafIds: [leaf],
  source: { authority: 'team-state' as const, reference: `ref ${id}` },
  ...extra,
});

const books = (team: string, lines: ReturnType<typeof line>[]) => ({
  version: 1 as const,
  salaryCapYear: 2026,
  apronAdjustments: {
    status: 'ready' as const,
    lineItems: [
      line(
        `apron-team-salary:simulation:${team}:performance-bonus:none`,
        0,
        'CBA2-C07.2'
      ),
      ...lines,
    ],
  },
  taxSalary: {
    status: 'ready' as const,
    lineItems: [
      {
        id: `tax-salary:simulation:${team}:baseline`,
        ledger: 'tax-salary' as const,
        label: 'baseline',
        amount: 150_000_000,
        effectiveFrom: '2026-04-12T23:59:59.000Z',
        canonLeafIds: ['CBA2-C08.1'],
        source: { authority: 'team-state' as const, reference: 'baseline' },
      },
    ],
  },
});

const PHI = books('PHI', [
  line(
    'apron-team-salary:simulation:PHI:minimum-uplift:justin_edwards',
    247_780
  ),
]);
const TOR = books('TOR', [
  line(
    'apron-team-salary:simulation:TOR:minimum-uplift:jamison_battle',
    236_520
  ),
  line(
    'apron-team-salary:simulation:TOR:minimum-uplift:old_player:dead-3',
    11_000
  ),
]);
const NYK = books('NYK', [
  line('apron-team-salary:simulation:NYK:minimum-uplift:none', 0),
]);

describe('CBA2-C07.3 uplift attribution', () => {
  it('reads a baseline roster row and ignores dead money and other players', () => {
    expect(tradeMinimumUpliftFor(TOR, 'jamison_battle', DAY)).toMatchObject({
      status: 'ready',
      amount: 236_520,
    });
    expect(tradeMinimumUpliftFor(TOR, 'old_player', DAY)).toMatchObject({
      status: 'ready',
      amount: 0,
    });
    expect(tradeMinimumUpliftFor(NYK, 'anyone', DAY)).toMatchObject({
      status: 'ready',
      amount: 0,
    });
    expect(tradeMinimumUpliftFor(undefined, 'anyone', DAY)).toMatchObject({
      status: 'ready',
      amount: 0,
    });
  });

  it('reads a signing row tied to its player and blocks an untied one', () => {
    const tied = books('CHI', [
      line('apron-team-salary:minimum-uplift:op-1', 1_000, 'CBA2-C07.3', {
        source: {
          authority: 'team-state',
          reference: 'signing-operation:op-1;player:new_guy',
        },
      }),
    ]);
    expect(tradeMinimumUpliftFor(tied, 'new_guy', DAY)).toMatchObject({
      status: 'ready',
      amount: 1_000,
    });
    const untied = books('CHI', [
      line('apron-team-salary:minimum-uplift:op-2', 1_000, 'CBA2-C07.3', {
        source: {
          authority: 'team-state',
          reference: 'signing-operation:op-2',
        },
      }),
    ]);
    expect(tradeMinimumUpliftFor(untied, 'anyone', DAY).status).toBe('blocked');
  });

  it('needs an exact world date and ignores rows that are not yet or no longer effective', () => {
    expect(tradeMinimumUpliftFor(PHI, 'justin_edwards', 'later').status).toBe(
      'blocked'
    );
    const ended = books('PHI', [
      line(
        'apron-team-salary:simulation:PHI:minimum-uplift:justin_edwards',
        247_780,
        'CBA2-C07.3',
        {
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveUntil: START,
        }
      ),
    ]);
    expect(tradeMinimumUpliftFor(ended, 'justin_edwards', DAY)).toMatchObject({
      amount: 0,
    });
  });
});

describe('CBA2-C07.3 uplift transfer', () => {
  const move = (
    movements: Array<{ playerId: string; fromTeam: string; toTeam: string }>,
    teams: Record<string, unknown> = { PHI, TOR, NYK },
    asOfDate: string = DAY
  ) =>
    moveTradeMinimumUplifts({
      booksByTeam: new Map(Object.entries(teams)),
      movements,
      asOfDate,
      transactionId: 'trade-1',
    });

  it('moves the row from sender to receiver and keeps the sender covered with a zero row', () => {
    const result = move([
      { playerId: 'justin_edwards', fromTeam: 'PHI', toTeam: 'NYK' },
    ]);
    if (!result.ok) throw new Error(result.error);
    const phi = result.books.get('PHI')!.apronAdjustments;
    const nyk = result.books.get('NYK')!.apronAdjustments;
    if (phi.status !== 'ready' || nyk.status !== 'ready') throw new Error();
    const phiUplift = phi.lineItems.filter((l) =>
      l.canonLeafIds.includes('CBA2-C07.3')
    );
    expect(phiUplift).toEqual([
      expect.objectContaining({
        id: 'apron-team-salary:PHI:minimum-uplift:none:trade-1',
        amount: 0,
      }),
    ]);
    const added = nyk.lineItems.find((l) => l.id.includes(':trade:trade-1:'));
    expect(added).toMatchObject({
      id: 'apron-team-salary:NYK:minimum-uplift:trade:trade-1:justin_edwards',
      amount: 247_780,
      effectiveFrom: START,
      canonLeafIds: ['CBA2-C07.3'],
    });
    // The moved row is attributable again for a later trade.
    expect(
      tradeMinimumUpliftFor(result.books.get('NYK'), 'justin_edwards', DAY)
    ).toMatchObject({ amount: 247_780 });
    // Tax Salary is fixed at the last game, so it does not change.
    expect(result.books.get('PHI')!.taxSalary).toEqual(PHI.taxSalary);
    expect(result.books.get('NYK')!.taxSalary).toEqual(NYK.taxSalary);
  });

  it('end-dates an older row instead of removing it, and leaves dead money behind', () => {
    const older = books('TOR', [
      line(
        'apron-team-salary:simulation:TOR:minimum-uplift:jamison_battle',
        236_520,
        'CBA2-C07.3',
        {
          effectiveFrom: '2026-05-01T00:00:00.000Z',
        }
      ),
      line(
        'apron-team-salary:simulation:TOR:minimum-uplift:old_player:dead-3',
        11_000
      ),
    ]);
    const result = move(
      [{ playerId: 'jamison_battle', fromTeam: 'TOR', toTeam: 'PHI' }],
      { TOR: older, PHI }
    );
    if (!result.ok) throw new Error(result.error);
    const tor = result.books.get('TOR')!.apronAdjustments;
    if (tor.status !== 'ready') throw new Error();
    expect(
      tor.lineItems.find((l) => l.id.endsWith(':jamison_battle'))
    ).toMatchObject({ effectiveUntil: START });
    expect(tor.lineItems.some((l) => l.id.endsWith(':dead-3'))).toBe(true);
    expect(
      tor.lineItems.some((l) => l.id.includes('minimum-uplift:none'))
    ).toBe(false);
  });

  it('handles a swap of two uplift players', () => {
    const result = move([
      { playerId: 'justin_edwards', fromTeam: 'PHI', toTeam: 'TOR' },
      { playerId: 'jamison_battle', fromTeam: 'TOR', toTeam: 'PHI' },
    ]);
    if (!result.ok) throw new Error(result.error);
    const total = (team: string) => {
      const apron = result.books.get(team)!.apronAdjustments;
      if (apron.status !== 'ready') throw new Error();
      return apron.lineItems
        .filter(
          (l) =>
            l.canonLeafIds.includes('CBA2-C07.3') &&
            !l.effectiveUntil &&
            !l.id.includes(':dead-')
        )
        .reduce((sum, l) => sum + l.amount, 0);
    };
    expect(total('PHI')).toBe(236_520);
    expect(total('TOR')).toBe(247_780);
  });

  it('changes nothing for players without an uplift', () => {
    const result = move([
      { playerId: 'someone', fromTeam: 'NYK', toTeam: 'PHI' },
    ]);
    expect(result).toEqual({ ok: true, books: new Map() });
  });

  it('refuses a move before Tax Salary is fixed or into a team without governed books', () => {
    const early = move(
      [{ playerId: 'justin_edwards', fromTeam: 'PHI', toTeam: 'NYK' }],
      { PHI, NYK },
      '2026-02-01'
    );
    // The row starts June 5, so on February 1 there is nothing to move.
    expect(early).toEqual({ ok: true, books: new Map() });
    const preBaseline = books('PHI', [
      line(
        'apron-team-salary:simulation:PHI:minimum-uplift:justin_edwards',
        247_780,
        'CBA2-C07.3',
        {
          effectiveFrom: '2026-01-01T00:00:00.000Z',
        }
      ),
    ]);
    const before = move(
      [{ playerId: 'justin_edwards', fromTeam: 'PHI', toTeam: 'NYK' }],
      { PHI: preBaseline, NYK },
      '2026-02-01'
    );
    expect(before.ok).toBe(false);
    const legacy = move(
      [{ playerId: 'justin_edwards', fromTeam: 'PHI', toTeam: 'LEG' }],
      { PHI, LEG: { apronAdjustments: { status: 'needs-input' } } }
    );
    expect(legacy.ok).toBe(false);
  });
});

describe('CBA2-C07.3 uplift in projected Apron Team Salary', () => {
  it('moves the uplift from the sender to the receiver in validation', async () => {
    const { validateTrade } = await import(
      '@/features/architect/utils/tradeMachine/engine/tradeValidator'
    );
    const capProjections = (
      await import('@/features/architect/utils/capProjections')
    ).default;
    const player = (id: string, teamCode: string, salary: number) => ({
      id,
      player_id: id,
      name: id,
      teamCode,
      salary,
      matchOutgoing: salary,
      matchIncoming: salary,
      contract: {
        salariesByYear: [
          { season: '2025-26', salary, capHit: salary, guaranteed: true },
          { season: '2026-27', salary, capHit: salary, guaranteed: true },
        ],
      },
    });
    const edwards = player('justin_edwards', 'PHI', 2_048_494);
    const other = player('nyk_player', 'NYK', 2_100_000);
    const result = validateTrade({
      teams: [
        {
          team: {
            teamCode: 'PHI',
            teamName: 'PHI',
            teamTotalSalary: 180_000_000,
            apronTeamSalary: 180_000_000,
            players: [edwards],
            salaryBookInputs: PHI,
          },
          sends: [{ ...edwards, tradeTo: 'NYK' }],
        },
        {
          team: {
            teamCode: 'NYK',
            teamName: 'NYK',
            teamTotalSalary: 170_000_000,
            apronTeamSalary: 170_000_000,
            players: [other],
            salaryBookInputs: NYK,
          },
          sends: [{ ...other, tradeTo: 'PHI' }],
        },
      ],
      capProjections,
      currentYear: 2026,
      tradeCtx: { asOfDate: DAY, tradeDate: DAY },
    } as unknown as Parameters<typeof validateTrade>[0]);
    const projected = (code: string) =>
      (
        result.teamResults as Array<{
          teamCode?: string;
          projectedSalary?: number;
        }>
      ).find((team) => team.teamCode === code)?.projectedSalary;
    expect(projected('PHI')).toBe(
      180_000_000 - 2_048_494 + 2_100_000 - 247_780
    );
    expect(projected('NYK')).toBe(
      170_000_000 - 2_100_000 + 2_048_494 + 247_780
    );
  });
});
