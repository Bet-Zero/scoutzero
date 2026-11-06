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
  it('permits the existing Room path across admitted mixed assets and keeps exact salary authority', () => {
    const f = fixture();
    for (const slot of f.args.payload.teams)
      slot.salaryMatchingElection.path = 'ROOM';
    expect(
      simulationPlayerMovements(f.args, 'native-selections', f.state)
    ).toHaveLength(1);
    expect(
      simulationPlayerMovements(f.args, 'ordered-swap-rights', f.state)
    ).toHaveLength(1);
    for (const branch of ['unconditional', 'protection-programs'])
      expect(simulationPlayerMovements(f.args, branch, f.state)).toHaveLength(
        1
      );
    f.args.payload.teams[0].salaryMatchingElection.tradedPlayerPreTradeSalaries
      .p++;
    expect(() =>
      simulationPlayerMovements(f.args, 'native-selections', f.state)
    ).toThrow(/exact governed outgoing Salary/);
  });
  it.each([
    'unconditional',
    'protection-programs',
    'native-selections',
    'ordered-swap-rights',
  ])(
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
    'duplicate-proposal',
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
    if (mode === 'duplicate-proposal') slot.sends.push({ ...p });
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
    if (mode === 'wrong-path') slot.salaryMatchingElection.path = 'unknown';
    if (mode === 'recipient-path')
      f.args.payload.teams[1].salaryMatchingElection.path = 'unknown';
    if (mode === 'context') f.args.payload.tradeCtx.source = 'caller';
    for (const branch of ['unconditional', 'ordered-swap-rights'])
      expect(() =>
        simulationPlayerMovements(f.args, branch, f.state)
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

describe.each([
  'unconditional',
  'protection-programs',
  'native-selections',
  'ordered-swap-rights',
])('held Standard TPE consideration: %s', (branch) => {
  function heldFixture() {
    const f = fixture();
    const receiver: any = f.state.teams[1].team;
    receiver.exceptions = {
      tpe: [
        {
          id: 'held-tpe',
          amount: 6_000_000,
          remainingAmount: 6_000_000,
          expiresOn: '2027-06-05',
        },
      ],
    };
    const outgoing = f.args.payload.teams[0].sends[0];
    outgoing.absorptionMode = 'TPE';
    outgoing.tpeId = 'held-tpe';
    return { ...f, receiver, outgoing };
  }
  it('binds acquisition to the explicitly routed recipient without changing Contract consideration', () => {
    const f = heldFixture();
    expect(simulationPlayerMovements(f.args, branch, f.state)).toEqual([
      { playerId: 'p', contractId: 'c', fromTeam: 'CHI', toTeam: 'TOR' },
    ]);
    f.args.payload.teams.push({ ...f.args.payload.teams[1], teamCode: 'SAS' });
    f.state.teams.push({ teamCode: 'SAS', team: { roster: [], players: [] } });
    f.outgoing.tradeTo = 'SAS';
    f.outgoing.receivingTeamIndex = 2;
    expect(() => simulationPlayerMovements(f.args, branch, f.state)).toThrow(
      /receiving team/
    );
    f.state.teams[2].team.exceptions = structuredClone(f.receiver.exceptions);
    expect(simulationPlayerMovements(f.args, branch, f.state)).toEqual([
      { playerId: 'p', contractId: 'c', fromTeam: 'CHI', toTeam: 'SAS' },
    ]);
  });
  it('uses the existing legacy accessor and normalized exception identity', () => {
    const f = heldFixture();
    f.receiver.tradeExceptions = [{ ...f.receiver.exceptions.tpe[0], id: 123 }];
    delete f.receiver.exceptions;
    f.outgoing.tpeId = '123';
    expect(simulationPlayerMovements(f.args, branch, f.state)).toHaveLength(1);
    f.receiver.tradeExceptions.push({
      ...f.receiver.tradeExceptions[0],
      id: '123',
    });
    expect(() => simulationPlayerMovements(f.args, branch, f.state)).toThrow(
      /receiving team/
    );
  });
  it.each([
    'absent',
    'foreign',
    'duplicate',
    'missing-id',
    'empty-id',
    'wrong-mode',
    'unknown-mode',
    'caller-exception',
  ])(
    'rejects %s exception identity before preparing the complete trade',
    (mode) => {
      const f = heldFixture();
      if (mode === 'absent') f.receiver.exceptions.tpe = [];
      if (mode === 'foreign') {
        f.team.exceptions = f.receiver.exceptions;
        f.receiver.exceptions = {};
      }
      if (mode === 'duplicate')
        f.receiver.exceptions.tpe.push({ ...f.receiver.exceptions.tpe[0] });
      if (mode === 'missing-id') delete f.outgoing.tpeId;
      if (mode === 'empty-id') f.outgoing.tpeId = ' ';
      if (mode === 'wrong-mode') f.outgoing.absorptionMode = 'MATCH';
      if (mode === 'unknown-mode') f.outgoing.absorptionMode = 'FA_EXCEPTION';
      if (mode === 'caller-exception') {
        f.args.payload.teams[1].appliedTPEs = f.receiver.exceptions.tpe;
        f.receiver.exceptions = {};
      }
      expect(() =>
        simulationPlayerMovements(f.args, branch, f.state)
      ).toThrow();
    }
  );
});

describe.each(['native-selections', 'ordered-swap-rights'])(
  'three-team explicit player routing: %s',
  (branch) => {
    it('routes to the selected third team instead of the first counterparty', () => {
      const f = fixture();
      f.args.payload.teams.push({
        ...f.args.payload.teams[1],
        teamCode: 'SAS',
      });
      f.args.payload.teams[0].sends[0].tradeTo = 'SAS';
      f.args.payload.teams[0].sends[0].receivingTeamIndex = 2;
      expect(simulationPlayerMovements(f.args, branch, f.state)).toEqual([
        { playerId: 'p', contractId: 'c', fromTeam: 'CHI', toTeam: 'SAS' },
      ]);
    });
    it.each(['self', 'outside', 'conflicting-alias', 'index'])(
      'rejects %s routes',
      (mode) => {
        const f = fixture();
        f.args.payload.teams.push({
          ...f.args.payload.teams[1],
          teamCode: 'SAS',
        });
        const p = f.args.payload.teams[0].sends[0];
        if (mode === 'self') p.tradeTo = 'CHI';
        if (mode === 'outside') p.tradeTo = 'BOS';
        if (mode === 'conflicting-alias') p.toTeamId = 'SAS';
        if (mode === 'index') p.receivingTeamIndex = 2;
        expect(() =>
          simulationPlayerMovements(f.args, branch, f.state)
        ).toThrow(/destination/);
      }
    );
  }
);

// Distinct salaries/Contracts make dropping or substituting a later player observable.
function collectionFixture(count: number, split = false) {
  const f = fixture();
  const slot = f.args.payload.teams[0];
  if (split)
    f.args.payload.teams.push({
      ...structuredClone(f.args.payload.teams[1]),
      teamCode: 'SAS',
    });
  for (let i = 1; i < count; i++) {
    const id = `p${i}`;
    const salary = 5_000_000 + i * 100_000;
    const current = structuredClone(f.player);
    Object.assign(current, { id, playerId: id });
    current.contract.salariesByYear[0].salary = salary;
    Object.assign(current.governedTradeSalaryBasis, {
      playerId: id,
      contractId: `c${i}`,
      currentSalary: salary,
      outgoingSalary: salary,
      incomingSalary: salary,
    });
    f.team.roster.push(id);
    f.team.players.push(current);
    slot.sends.push({
      id,
      playerId: id,
      contract: structuredClone(current.contract),
      tradeTo: split && i % 2 ? 'SAS' : 'TOR',
      receivingTeamIndex: split && i % 2 ? 2 : 1,
    });
    slot.salaryMatchingElection.tradedPlayerPreTradeSalaries[id] = salary;
  }
  slot.salaryMatchingElection.path = 'AGGREGATED_STANDARD_TPE';
  return f;
}

describe.each([
  'unconditional',
  'protection-programs',
  'native-selections',
  'ordered-swap-rights',
])('shared Contract collection: %s', (branch) => {
  it.each([2, 3, 5])(
    'carries every one of %i outgoing Contracts and is order independent',
    (count) => {
      const f = collectionFixture(count);
      const expected = f.team.players.map((p: any) => ({
        playerId: p.playerId,
        contractId: p.governedTradeSalaryBasis.contractId,
        fromTeam: 'CHI',
        toTeam: 'TOR',
      }));
      expect(simulationPlayerMovements(f.args, branch, f.state)).toEqual(
        expected
      );
      f.args.payload.teams[0].sends.reverse();
      // Index aliases are not a substitute for explicit destinations.
      for (const p of f.args.payload.teams[0].sends)
        delete p.receivingTeamIndex;
      f.args.payload.teams.reverse();
      expect(simulationPlayerMovements(f.args, branch, f.state)).toEqual(
        expected.reverse()
      );
    }
  );

  it.each([
    'salary',
    'missing-salary',
    'contract',
    'duplicate-contract',
    'duplicate-player',
    'route',
    'authority',
    'poison-pill',
  ])('rejects %s on a later collection member', (mode) => {
    const f = collectionFixture(3),
      slot = f.args.payload.teams[0];
    const last = slot.sends[2],
      current = f.team.players[2];
    if (mode === 'salary')
      slot.salaryMatchingElection.tradedPlayerPreTradeSalaries.p2++;
    if (mode === 'missing-salary')
      delete slot.salaryMatchingElection.tradedPlayerPreTradeSalaries.p2;
    if (mode === 'contract') last.contract.salariesByYear[0].salary++;
    if (mode === 'duplicate-contract')
      current.governedTradeSalaryBasis.contractId = 'c';
    if (mode === 'duplicate-player') slot.sends[2] = { ...slot.sends[0] };
    if (mode === 'route') last.tradeTo = 'BOS';
    if (mode === 'authority')
      current.governedTradeSalaryBasis.status = 'needs-input';
    if (mode === 'poison-pill')
      current.governedTradeSalaryBasis.poisonPillIncomingSalary = 8_000_000;
    expect(() => simulationPlayerMovements(f.args, branch, f.state)).toThrow();
  });
});

it.each([
  'unconditional',
  'protection-programs',
  'native-selections',
  'ordered-swap-rights',
])(
  'preserves split per-player destinations and Room collections in %s',
  (branch) => {
    const f = collectionFixture(5, true);
    expect(
      simulationPlayerMovements(f.args, branch, f.state).map((p) => p.toTeam)
    ).toEqual(['TOR', 'SAS', 'TOR', 'SAS', 'TOR']);
    f.args.payload.teams.forEach(
      (s: any) => (s.salaryMatchingElection.path = 'ROOM')
    );
    expect(simulationPlayerMovements(f.args, branch, f.state)).toHaveLength(5);
  }
);
