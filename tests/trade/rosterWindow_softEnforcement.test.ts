import { describe, it, expect, afterEach } from 'vitest';
import { enforceRosterWindow } from '@/features/architect/utils/tradeMachine/rules/validateRoster';
import { validationFlags } from '@/config/validationFlags';

type RosterWindowTeam = Parameters<typeof enforceRosterWindow>[0];
type RosterWindowPlayer = NonNullable<
  NonNullable<RosterWindowTeam['postTradeTeam']>['players']
>[number];

const makePlayers = (count: number): RosterWindowPlayer[] =>
  Array.from({ length: count }, (_, index) => ({
    name: `Player ${index}`,
  }));

const makeTeam = (count: number): RosterWindowTeam => ({
  postTradeTeam: { players: makePlayers(count), twoWayPlayers: [] },
});

describe('roster window soft enforcement', () => {
  afterEach(() => {
    validationFlags.rosterEnforcement = 'warn';
  });

  it('rejects at 13 players when set to error', () => {
    validationFlags.rosterEnforcement = 'error';
    const rejects: string[] = [];
    const warns: string[] = [];
    enforceRosterWindow(
      makeTeam(13),
      {},
      {
        warn: (message) => warns.push(message),
        reject: (message) => rejects.push(message),
      }
    );
    expect(rejects).toHaveLength(1);
    expect(warns).toHaveLength(0);
  });

  it('warns but does not reject at 13 players when set to warn', () => {
    validationFlags.rosterEnforcement = 'warn';
    const rejects: string[] = [];
    const warns: string[] = [];
    enforceRosterWindow(
      makeTeam(13),
      {},
      {
        warn: (message) => warns.push(message),
        reject: (message) => rejects.push(message),
      }
    );
    expect(warns).toHaveLength(1);
    expect(rejects).toHaveLength(0);
  });

  it('allows 13 players during grace mode', () => {
    validationFlags.rosterEnforcement = 'error';
    const rejects: string[] = [];
    const warns: string[] = [];
    enforceRosterWindow(
      makeTeam(13),
      { graceMode: true },
      {
        warn: (message) => warns.push(message),
        reject: (message) => rejects.push(message),
      }
    );
    expect(warns).toHaveLength(0);
    expect(rejects).toHaveLength(0);
  });
});
