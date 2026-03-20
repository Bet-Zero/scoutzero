import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator.js';
import { validateConsent } from '@/features/architect/utils/tradeMachine/rules/validateConsent';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import capProjections from '@/features/architect/utils/capProjections.js';

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;
const salary = 10_000_000;

const makePlayer = (name, extra = {}) => ({
  id: name,
  name,
  contract: { salariesByYear: [{ season, salary }] },
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

const issueTexts = (issues = []) => issues.map((issue) => getValidationIssueText(issue));

describe('consent and re-acquisition rules', () => {
  it('validateConsent emits canonical issues for full NTC without consent', () => {
    const ntc = makePlayer('NTC', { hasFullNTC: true });

    const result = validateConsent(
      { teamId: 'A', teamName: 'A', sends: [ntc] },
      {
        teams: [
          { teamId: 'A', teamName: 'A' },
          { teamId: 'B', teamName: 'B' },
        ],
      }
    );

    expect(result.passed).toBe(false);
    expect(result.violations).toMatchObject([
      {
        rule: 'consent',
        code: 'CONSENT__FULL_NTC_REQUIRED',
      },
    ]);
    expect(issueTexts(result.violations)).toEqual([
      'NTC has a full no-trade clause and must consent',
    ]);
  });

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

    const teamAResult = result.teamResults.find((team) => team.teamId === 'A');

    expect(result.legal).toBe(false);
    expect(teamAResult?.rules?.consent).toMatchObject({ passed: false });
    expect(issueTexts(teamAResult?.rules?.consent?.violations)).toEqual(
      expect.arrayContaining(['NTC has a full no-trade clause and must consent'])
    );
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

    const teamAResult = result.teamResults.find((team) => team.teamId === 'A');

    expect(result.legal).toBe(true);
    expect(teamAResult?.rules?.consent).toMatchObject({ passed: true });
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

    const teamAResult = result.teamResults.find((team) => team.teamId === 'A');

    expect(result.legal).toBe(false);
    expect(teamAResult?.rules?.reacquisition).toMatchObject({ passed: false });
    expect(issueTexts(teamAResult?.rules?.reacquisition?.violations)).toEqual(
      expect.arrayContaining([
        'Cannot re-acquire REACQ within one year of trading them away',
      ])
    );
  });
});
