import { describe, it, expect, afterEach } from 'vitest';
import { enforceRosterWindow } from '@/features/architect/utils/tradeMachine/rules/validateRoster';
import { validationFlags } from '@/config/validationFlags';

const makeTeam = (count) => ({
  postTradeTeam: { players: Array(count), twoWayPlayers: [] },
});

describe('roster window soft enforcement', () => {
  afterEach(() => {
    validationFlags.rosterEnforcement = 'warn';
  });

  it('rejects at 13 players when set to error', () => {
    validationFlags.rosterEnforcement = 'error';
    const rejects = [];
    const warns = [];
    enforceRosterWindow(
      makeTeam(13),
      {},
      {
        warn: (m) => warns.push(m),
        reject: (m) => rejects.push(m),
      }
    );
    expect(rejects).toHaveLength(1);
    expect(warns).toHaveLength(0);
  });

  it('warns but does not reject at 13 players when set to warn', () => {
    validationFlags.rosterEnforcement = 'warn';
    const rejects = [];
    const warns = [];
    enforceRosterWindow(
      makeTeam(13),
      {},
      {
        warn: (m) => warns.push(m),
        reject: (m) => rejects.push(m),
      }
    );
    expect(warns).toHaveLength(1);
    expect(rejects).toHaveLength(0);
  });

  it('allows 13 players during grace mode', () => {
    validationFlags.rosterEnforcement = 'error';
    const rejects = [];
    const warns = [];
    enforceRosterWindow(
      makeTeam(13),
      { graceMode: true },
      {
        warn: (m) => warns.push(m),
        reject: (m) => rejects.push(m),
      }
    );
    expect(warns).toHaveLength(0);
    expect(rejects).toHaveLength(0);
  });
});
