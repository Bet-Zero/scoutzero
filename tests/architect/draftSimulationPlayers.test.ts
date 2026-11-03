import { describe, expect, it } from 'vitest';
import { normalizeCurrentStatePlayerContract } from '@/features/architect/utils/mutationPipeline.helpers';
import { simulationPlayerMovements } from '@/features/architect/utils/draftReview/simulationPlayers';
import { LIVE_GOVERNED_TRADE_SALARY_AUTHORITY } from '@/features/architect/utils/tradeContext/tradeContext.payloadNormalization';

function fixture() {
  const player: any = {
    playerId: 'p',
    id: 'p',
    contract: { salariesByYear: [{ season: '2025-26', salary: 5_000_000 }] },
    governedTradeSalaryBasis: {
      authorityVersion: 1,
      status: 'ready',
      worldId: 'w',
      teamId: 'CHI',
      playerId: 'p',
      contractId: 'c',
      asOfDate: '2026-06-05',
      salaryCapYear: 2026,
      method: 'postseason-lesser-of',
      currentSalary: 5_000_000,
      outgoingSalary: 5_000_000,
      incomingSalary: 5_000_000,
      poisonPillIncomingSalary: null,
      canonLeafIds: ['CBA2-A03.3'],
      reasons: [],
      proof: {
        ledgerId: 'l',
        ledgerVersion: 1,
        contractVersion: 1,
        stateDigest: 'fnv1a64:aaaaaaaaaaaaaaaa',
        calendarRecordId: 'calendar',
        calendarRecordVersion: 1,
        calendarSourceRecordId: 'source',
        calendarSourceRecordVersion: 1,
      },
    },
  };
  player.contract = normalizeCurrentStatePlayerContract(player.contract);
  const team: any = { roster: ['p'], players: [player] };
  Object.defineProperty(team, LIVE_GOVERNED_TRADE_SALARY_AUTHORITY, {
    value: true,
    configurable: true,
  });
  const args: any = {
    worldId: 'w',
    payload: {
      asOfDate: '2026-06-05',
      tradeCtx: { source: 'tradeMachine', yearKey: 2026 },
      teams: [
        {
          teamCode: 'CHI',
          salaryMatchingElection: {
            version: 1,
            path: 'STANDARD_TPE',
            postAssignmentApronTeamSalary: 170000000,
            tradedPlayerPreTradeSalaries: { p: 5000000 },
          },
          sends: [
            {
              id: 'p',
              playerId: 'p',
              tradeTo: 'TOR',
              receivingTeamIndex: 1,
              contract: structuredClone(player.contract),
            },
          ],
        },
        {
          teamCode: 'TOR',
          sends: [],
          salaryMatchingElection: {
            version: 1,
            path: 'STANDARD_TPE',
            postAssignmentApronTeamSalary: 170000000,
            tradedPlayerPreTradeSalaries: {},
          },
        },
      ],
    },
  };
  return {
    args,
    player,
    team,
    state: {
      teams: [
        { teamCode: 'CHI', team },
        { teamCode: 'TOR', team: { roster: [], players: [] } },
      ],
    },
  };
}
describe('bounded ordinary player consideration', () => {
  it('permits the existing Room path only for admitted native selections and keeps exact salary authority', () => {
    const f = fixture();
    for (const slot of f.args.payload.teams)
      slot.salaryMatchingElection.path = 'ROOM';
    expect(
      simulationPlayerMovements(f.args, 'native-selections', f.state)
    ).toHaveLength(1);
    for (const branch of ['unconditional', 'protection-programs'])
      expect(() => simulationPlayerMovements(f.args, branch, f.state)).toThrow(
        /matching path/
      );
    f.args.payload.teams[0].salaryMatchingElection.tradedPlayerPreTradeSalaries
      .p++;
    expect(() =>
      simulationPlayerMovements(f.args, 'native-selections', f.state)
    ).toThrow(/exact governed outgoing Salary/);
  });
  it.each(['unconditional', 'protection-programs', 'native-selections'])(
    'derives the outgoing Contract identity from live saved-world authority in %s',
    (branch) => {
      const f = fixture();
      f.args.payload.teams[0].sends[0].governedTradeSalaryBasis = {
        contractId: 'caller-forgery',
      };
      expect(simulationPlayerMovements(f.args, branch, f.state)).toEqual([
        { playerId: 'p', contractId: 'c', fromTeam: 'CHI', toTeam: 'TOR' },
      ]);
    }
  );
  it.each([
    'alias',
    'owner',
    'missing-player',
    'duplicate-snapshot',
    'route',
    'route-index',
    'no-route',
    'contract',
    'two-way',
    'sign-and-trade',
    'missing-authority',
    'unready',
    'world',
    'date',
    'year',
    'poison-pill',
    'incoming-override',
    'aggregation',
    'cap-override',
    'date-override',
    'season-override',
    'tpe',
    'missing-election',
    'inflated-salary',
    'extra-salary',
    'wrong-path',
    'recipient-path',
    'context',
  ])('blocks %s before issuing review authority', (mode) => {
    const f = fixture(),
      slot = f.args.payload.teams[0],
      p = slot.sends[0];
    if (mode === 'alias') p.player_id = 'another';
    if (mode === 'owner') f.team.roster = [];
    if (mode === 'missing-player') f.team.players = [];
    if (mode === 'duplicate-snapshot') f.team.players.push(f.player);
    if (mode === 'route') p.receivingTeamId = 'CHI';
    if (mode === 'route-index') p.receivingTeamIndex = 0;
    if (mode === 'no-route') delete p.tradeTo;
    if (mode === 'contract') p.contract.salariesByYear[0].salary = 0;
    if (mode === 'two-way') f.player.contract.isTwoWay = true;
    if (mode === 'sign-and-trade') p.signAndTrade = true;
    if (mode === 'missing-authority')
      delete f.team[LIVE_GOVERNED_TRADE_SALARY_AUTHORITY];
    if (mode === 'unready')
      f.player.governedTradeSalaryBasis.status = 'needs-input';
    if (mode === 'world') f.player.governedTradeSalaryBasis.worldId = 'other';
    if (mode === 'date')
      f.player.governedTradeSalaryBasis.asOfDate = '2026-06-04';
    if (mode === 'year') f.player.governedTradeSalaryBasis.salaryCapYear = 2027;
    if (mode === 'poison-pill')
      f.player.governedTradeSalaryBasis.poisonPillIncomingSalary = 10_000_000;
    if (mode === 'incoming-override') f.args.payload.teams[1].receives = [p];
    if (mode === 'aggregation') slot.sends.push({ ...p });
    if (mode === 'cap-override') f.args.payload.capProjections = {};
    if (mode === 'date-override')
      f.args.payload.tradeCtx.tradeDate = '2028-01-01';
    if (mode === 'season-override') f.args.payload.tradeCtx.offseason = true;
    if (mode === 'tpe') p.tpeId = 'unproved';
    if (mode === 'missing-election') slot.salaryMatchingElection = null;
    if (mode === 'inflated-salary')
      slot.salaryMatchingElection.tradedPlayerPreTradeSalaries.p++;
    if (mode === 'extra-salary')
      slot.salaryMatchingElection.tradedPlayerPreTradeSalaries.other = 5000000;
    if (mode === 'wrong-path') slot.salaryMatchingElection.path = 'ROOM';
    if (mode === 'recipient-path')
      f.args.payload.teams[1].salaryMatchingElection.path = 'ROOM';
    if (mode === 'context') f.args.payload.tradeCtx.source = 'caller';
    expect(() =>
      simulationPlayerMovements(f.args, 'unconditional', f.state)
    ).toThrow();
  });
  it.each(['conditional-2027', 'swap-program', 'apron-lifecycle'])(
    'preserves the %s player restriction',
    (branch) => {
      const f = fixture();
      expect(() => simulationPlayerMovements(f.args, branch, f.state)).toThrow(
        /complete protection programs/
      );
    }
  );
});
