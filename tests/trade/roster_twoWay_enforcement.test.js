import { describe, it, expect, afterEach } from 'vitest';
import { enforceRosterWindow } from '@/features/architect/utils/tradeMachine/rules/validateRoster';
import { validationFlags } from '@/config/validationFlags';

const makeTeam = (std, tw) => ({
  postTradeTeam: { players: Array(std), twoWayPlayers: Array(tw) },
});

describe('two-way roster enforcement', () => {
  afterEach(() => {
    validationFlags.twoWayRoster = 'warn';
    validationFlags.rosterEnforcement = 'warn';
  });

  it('warns or rejects when two-way slots exceeded', () => {
    validationFlags.twoWayRoster = 'warn';
    const team = makeTeam(14, 4);
    const warns = [];
    const rejects = [];
    enforceRosterWindow(team, {}, { warn: (m) => warns.push(m) });
    expect(warns).toContain('Two-way slots exceeded (4/3)');
    validationFlags.twoWayRoster = 'error';
    enforceRosterWindow(team, {}, { reject: (m) => rejects.push(m) });
    expect(rejects).toContain('Two-way slots exceeded (4/3)');
  });

  it('errors when standard roster outside 14-15', () => {
    validationFlags.rosterEnforcement = 'error';
    const rejects = [];
    enforceRosterWindow(makeTeam(13, 0), {}, { reject: (m) => rejects.push(m) });
    expect(rejects).toHaveLength(1);
  });
});
