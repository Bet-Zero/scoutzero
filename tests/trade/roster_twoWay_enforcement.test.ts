import { describe, it, expect, afterEach } from 'vitest';
import { enforceRosterWindow } from '@/features/architect/utils/tradeMachine/rules/validateRoster';
import { validationFlags } from '@/config/validationFlags';

type RosterWindowTeam = Parameters<typeof enforceRosterWindow>[0];
type RosterWindowPlayer = NonNullable<
  NonNullable<RosterWindowTeam['postTradeTeam']>['players']
>[number];

const makePlayers = (count: number, prefix: string): RosterWindowPlayer[] =>
  Array.from({ length: count }, (_, index) => ({
    name: `${prefix} Player ${index}`,
  }));

const makeTeam = (
  standardCount: number,
  twoWayCount: number
): RosterWindowTeam => ({
  postTradeTeam: {
    players: makePlayers(standardCount, 'Standard'),
    twoWayPlayers: makePlayers(twoWayCount, 'TwoWay'),
  },
});

describe('two-way roster enforcement', () => {
  afterEach(() => {
    validationFlags.twoWayRoster = 'warn';
    validationFlags.rosterEnforcement = 'warn';
  });

  it('warns or rejects when two-way slots exceeded', () => {
    validationFlags.twoWayRoster = 'warn';
    const team = makeTeam(14, 4);
    const warns: string[] = [];
    const rejects: string[] = [];
    enforceRosterWindow(team, {}, { warn: (message) => warns.push(message) });
    expect(warns).toContain('Two-way slots exceeded (4/3)');
    validationFlags.twoWayRoster = 'error';
    enforceRosterWindow(team, {}, { reject: (message) => rejects.push(message) });
    expect(rejects).toContain('Two-way slots exceeded (4/3)');
  });

  it('errors when standard roster outside 14-15', () => {
    validationFlags.rosterEnforcement = 'error';
    const rejects: string[] = [];
    enforceRosterWindow(makeTeam(13, 0), {}, {
      reject: (message) => rejects.push(message),
    });
    expect(rejects).toHaveLength(1);
  });
});
