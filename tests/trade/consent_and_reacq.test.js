import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/utils/architect/tradeMachine/engine/tradeValidator.js';
import capProjections from '@/utils/architect/capProjections.js';

const currentYear = 2025;
const salary = 10_000_000;

const makePlayer = (name, extra = {}) => ({
  id: name,
  name,
  contract_clean: { salaries_by_year: { [currentYear]: { salary } } },
  ...extra,
});

const makeTeam = (id, extraPlayers = []) => ({
  id,
  teamName: id,
  totalSalary: 100_000_000,
  picks: [],
  players: Array.from({ length: 14 }, (_, i) => makePlayer(`${id}${i}`)).concat(
    extraPlayers
  ),
});

describe('consent and re-acquisition rules', () => {
  it('blocks full NTC without consent', () => {
    const ntc = makePlayer('NTC', { hasFullNTC: true });
    const b1 = makePlayer('B1');
    const teamA = makeTeam('A', [ntc]);
    const teamB = makeTeam('B', [b1]);
    const result = validateTrade({
      teams: [
        { team: teamA, sends: [ntc], picksOut: [] },
        { team: teamB, sends: [b1], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: {},
    });
    expect(result.legal).toBe(false);
  });

  it('allows full NTC with consent', () => {
    const ntc = makePlayer('NTC', { hasFullNTC: true, consent: true });
    const b1 = makePlayer('B1');
    const teamA = makeTeam('A', [ntc]);
    const teamB = makeTeam('B', [b1]);
    const result = validateTrade({
      teams: [
        { team: teamA, sends: [ntc], picksOut: [] },
        { team: teamB, sends: [b1], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: {},
    });
    expect(result.legal).toBe(true);
  });

  it('allows limited NTC to approved team', () => {
    const lntc = makePlayer('LNTC', { limitedNTCTeams: ['B'] });
    const b1 = makePlayer('B1');
    const teamA = makeTeam('A', [lntc]);
    const teamB = makeTeam('B', [b1]);
    const result = validateTrade({
      teams: [
        { team: teamA, sends: [lntc], picksOut: [] },
        { team: teamB, sends: [b1], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: {},
    });
    expect(result.legal).toBe(true);
  });

  it('blocks limited NTC to non-approved team', () => {
    const lntc = makePlayer('LNTC', { limitedNTCTeams: ['C'] });
    const b1 = makePlayer('B1');
    const teamA = makeTeam('A', [lntc]);
    const teamB = makeTeam('B', [b1]);
    const result = validateTrade({
      teams: [
        { team: teamA, sends: [lntc], picksOut: [] },
        { team: teamB, sends: [b1], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: {},
    });
    expect(result.legal).toBe(false);
  });

  it('blocks one-year Bird veto without consent', () => {
    const bird = makePlayer('BIRD', { oneYearBirdVeto: true });
    const b1 = makePlayer('B1');
    const teamA = makeTeam('A', [bird]);
    const teamB = makeTeam('B', [b1]);
    const result = validateTrade({
      teams: [
        { team: teamA, sends: [bird], picksOut: [] },
        { team: teamB, sends: [b1], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: {},
    });
    expect(result.legal).toBe(false);
  });

  it('blocks re-acquisition within one year', () => {
    const reacq = makePlayer('REACQ');
    const a1 = makePlayer('A1');
    const teamA = makeTeam('A', [a1]);
    const teamB = makeTeam('B', [reacq]);
    const result = validateTrade({
      teams: [
        { team: teamA, sends: [a1], picksOut: [] },
        { team: teamB, sends: [reacq], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: {
        wasTradedAwayWithinOneYear: (playerId, destTeamId) =>
          playerId === 'REACQ' && destTeamId === 'A',
      },
    });
    expect(result.legal).toBe(false);
  });
});

