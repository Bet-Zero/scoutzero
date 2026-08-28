// tradeValidator.test.js
import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine';
import { capProjections } from '@/features/architect/utils/capProjections';
import { getSalaryMatchingResult } from '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import { validateBYC } from '@/features/architect/utils/tradeMachine/rules/miscRules';

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

const makePlayer = (name, salary, signAndTrade = false, contractYears = 4) => ({
  name,
  signAndTrade,
  contractYears,
  contract: { salariesByYear: [{ season, salary }] },
});

const makeTeam = (name, totalSalary, rosterSize = 14, picks = []) => ({
  id: name,
  teamCode: name,
  teamName: name,
  totalSalary,
  teamSalary: totalSalary,
  apronTeamSalary: totalSalary,
  taxSalary: totalSalary,
  teamTotalSalary: totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000)
  ),
  picks,
});

const issueTexts = (issues = []) =>
  issues.map((issue) => getValidationIssueText(issue));

describe('tradeValidator', () => {
  it('enforces salary matching when a team is over the cap', () => {
    const teamA = makeTeam('A', 160_000_000);
    const teamB = makeTeam('B', 160_000_000);
    const aPlayer = makePlayer('Astar', 10_000_000);
    const bPlayer = makePlayer('Bstar', 20_000_000);
    teamA.players.push(aPlayer);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [aPlayer], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(false);
    expect(result.teamResults[0].legal).toBe(false);
    expect(getValidationIssueText(result.teamResults[0].violations[0])).toMatch(
      /Incoming salary exceeds/
    );
    expect(result.teamResults[0].rules.salaryMatching.passed).toBe(false);
  });

  it('recomputes BYC matching values before salary-matching legality is evaluated', () => {
    const teamA = makeTeam('A', 160_000_000);
    const teamB = makeTeam('B', 160_000_000);
    const bycPlayer = {
      ...makePlayer('Abyc', 20_000_000),
      isBYC: true,
      previousSalary: 8_000_000,
    };
    const incomingPlayer = makePlayer('Bstar', 20_000_000);
    teamA.players.push(bycPlayer);
    teamB.players.push(incomingPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [bycPlayer], picksOut: [] },
        { team: teamB, sends: [incomingPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    const rawSalaryResult = getSalaryMatchingResult({
      teamTotalSalary: teamA.totalSalary,
      outgoingSalary: 20_000_000,
      capSettings: {
        salaryCap: capProjections[season].cap,
        firstApron: capProjections[season].firstApron,
        secondApron: capProjections[season].secondApron,
      },
    });

    // Raw (un-BYC) 20M outgoing would allow the 20M incoming, but BYC drops
    // matchOutgoing to 10M so the Band 2 ceiling (10M + 9.096M = 19.096M) is
    // exceeded — proving BYC recompute happens before legality.
    expect(rawSalaryResult.allowableIncoming).toBeGreaterThan(20_000_000);
    expect(result.legal).toBe(false);
    expect(bycPlayer.matchOutgoing).toBe(10_000_000);
    expect(bycPlayer.matchIncoming).toBe(20_000_000);
    expect(result.teamResults[0].salaryOut).toBe(10_000_000);
    expect(result.teamResults[0].salaryOut).not.toBe(20_000_000);
    expect(result.teamResults[0].salaryIn).toBe(20_000_000);
    expect(result.teamResults[0].rules.salaryMatching.allowableIncoming).toBe(
      19_096_000
    );
    expect(result.teamResults[0].rules.salaryMatching.passed).toBe(false);
    expect(issueTexts(result.teamResults[0].violations)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Incoming salary exceeds/i),
      ])
    );
  });

  it('preserves validateBYC mutations through the live validator salary path', () => {
    const teamA = makeTeam('A', 160_000_000);
    const teamB = makeTeam('B', 160_000_000);
    const bycPlayer = {
      ...makePlayer('AautoByc', 30_000_000),
      contract: {
        salariesByYear: [
          { season: '2023-24', salary: 10_000_000, capHit: 10_000_000 },
          { season, salary: 30_000_000, capHit: 30_000_000 },
        ],
      },
    };
    const incomingPlayer = makePlayer('Bstar', 18_000_000);
    const teamEntry = { team: teamA, sends: [bycPlayer], picksOut: [] };
    teamA.players.push(bycPlayer);
    teamB.players.push(incomingPlayer);

    const bycResult = validateBYC(teamEntry, { yearKey: currentYear });

    expect(bycResult).toEqual({
      passed: true,
      violations: [],
      warningsOnly: false,
    });
    expect(bycPlayer.isBYC).toBe(true);
    expect(bycPlayer.previousSalary).toBe(10_000_000);
    expect(bycPlayer.matchOutgoing).toBe(15_000_000);

    const result = validateTrade({
      teams: [
        teamEntry,
        { team: teamB, sends: [incomingPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(false);
    expect(result.teamResults[0].salaryOut).toBe(15_000_000);
    expect(result.teamResults[0].salaryOut).not.toBe(30_000_000);
    expect(bycPlayer.previousSalary).toBe(10_000_000);
    expect(bycPlayer.matchOutgoing).toBe(15_000_000);
    expect(result.teamResults[0].rules.salaryMatching.allowableIncoming).toBe(
      24_096_000
    );
    expect(result.teamResults[0].rules.salaryMatching.passed).toBe(true);
  });

  it('uses season-utils cap-hit lookups for validator salary totals', () => {
    const teamA = makeTeam('A', 160_000_000);
    const teamB = makeTeam('B', 160_000_000);
    const capHitPlayer = {
      ...makePlayer('Acap', 5_000_000),
      contract: {
        salariesByYear: [{ season, salary: 5_000_000, capHit: 5_500_000 }],
      },
    };
    const matchingPlayer = makePlayer('Bmatch', 5_500_000);
    teamA.players.push(capHitPlayer);
    teamB.players.push(matchingPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [capHitPlayer], picksOut: [] },
        { team: teamB, sends: [matchingPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(true);
    expect(capHitPlayer.matchOutgoing).toBe(5_500_000);
    expect(capHitPlayer.matchIncoming).toBe(5_500_000);
    expect(result.teamResults[0].salaryOut).toBe(5_500_000);
    expect(result.teamResults[0].salaryOut).not.toBe(5_000_000);
    expect(result.teamResults[1].salaryIn).toBe(5_500_000);
    expect(result.teamResults[0].rules.salaryMatching.passed).toBe(true);
  });

  it('flags trades that would violate a hard cap', () => {
    // Team A is at first apron level (180M) and hard-capped
    // First apron is 179M for 2024-25, so 180M is above first apron but below second apron (190M)
    const teamA = makeTeam('A', 180_000_000);
    const teamB = makeTeam('B', 150_000_000);
    const incoming = makePlayer('Bstar', 10_000_000);
    teamB.players.push(incoming);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [], picksOut: [], hardCapped: true },
        { team: teamB, sends: [incoming], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(false);
    expect(result.teamResults[0].legal).toBe(false);
    // Assert against rule-scoped violations (not violations[0]) to avoid order dependency
    expect(result.teamResults[0].rules.hardCap.passed).toBe(false);
    expect(issueTexts(result.teamResults[0].rules.hardCap.violations)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('1st Apron hard cap violation'),
      ])
    );
  });

  it('enforces sign-and-trade restrictions', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const sat = makePlayer('Astar', 10_000_000, true);
    const extra = makePlayer('Aextra', 5_000_000);
    const bPlayer = makePlayer('Bstar', 15_000_000);
    teamA.players.push(sat, extra);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [sat, extra], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(false);
    // Team A violates outgoing aggregation (sends S&T + extra)
    expect(result.teamResults[0].legal).toBe(false);
    expect(issueTexts(result.teamResults[0].violations)).toEqual(
      expect.arrayContaining(['Sign-and-trade player must be traded alone.'])
    );
    expect(result.teamResults[0].rules.signAndTrade.passed).toBe(false);
    // Team B also violates incoming aggregation (receives S&T + extra) - Phase 32
    expect(result.teamResults[1].legal).toBe(false);
    expect(issueTexts(result.teamResults[1].violations)).toEqual(
      expect.arrayContaining([
        'Cannot aggregate other players with sign-and-trade player.',
      ])
    );
    expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
  });

  it('allows valid sign-and-trade deals', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const sat = makePlayer('Astar', 20_000_000, true, 4);
    const bPlayer = makePlayer('Bstar', 15_000_000);
    teamA.players.push(sat);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [sat], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { offseason: true, asOfDate: '2025-01-20' },
    });

    expect(result.legal).toBe(true);
  });

  it('blocks sign-and-trade hard cap violations', () => {
    // Team A at under cap
    const teamA = makeTeam('A', 100_000_000);
    // Team B at first apron level (182M), which is below second apron (190M)
    // First apron is 179M for 2024-25
    const teamB = makeTeam('B', 182_000_000);
    const sat = makePlayer('Astar', 20_000_000, true, 4);
    const bPlayer = makePlayer('Bstar', 15_000_000);
    teamA.players.push(sat);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [sat], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { offseason: true, asOfDate: '2025-01-20' },
    });

    // Trade should be blocked - either hard-cap or first apron salary matching violation
    expect(result.legal).toBe(false);
    // Verify the reason indicates the issue is related to salary rules
    expect(result.reason).toMatch(/apron|hard-cap|salary/i);
  });

  it('requires sign-and-trade contracts to be 3-4 years', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const sat = makePlayer('Astar', 10_000_000, true, 2);
    const bPlayer = makePlayer('Bstar', 10_000_000);
    teamA.players.push(sat);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [sat], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { offseason: true, asOfDate: '2025-01-20' },
    });

    expect(result.legal).toBe(false);
    expect(result.reason).toContain('must be 3-4 years');
  });

  it('fails closed when first-round Stepien authority is unavailable', () => {
    const teamA = makeTeam('A', 100_000_000, 14, [
      { year: 2027, round: '1st' },
      { year: 2028, round: '1st' },
    ]);
    const teamB = makeTeam('B', 100_000_000);

    const result = validateTrade({
      teams: [
        {
          team: teamA,
          sends: [],
          picksOut: [
            { year: 2027, round: '1st' },
            { year: 2028, round: '1st' },
          ],
        },
        { team: teamB, sends: [], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(false);
    expect(result.reason).toContain('Needs input');
    expect(issueTexts(result.violations)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Needs input'),
      ])
    );
    expect(result.teamResults[0].legal).toBe(false);
    expect(issueTexts(result.teamResults[0].violations)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Needs input'),
      ])
    );
    expect(result.teamResults[0].rules.stepienRule).toMatchObject({
      passed: false,
      status: 'NEEDS_INPUT',
      evaluated: false,
    });
    expect(result.teamResults[1].rules.stepienRule.passed).toBe(true);
  });

  it('does not treat protection text as complete governed Stepien history', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);

    const result = validateTrade({
      teams: [
        {
          team: teamA,
          sends: [],
          picksOut: [
            { year: 2027, round: '1st', protection: 'Top 5' },
            { year: 2028, round: '1st' },
          ],
        },
        { team: teamB, sends: [], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(false);
    expect(result.teamResults[0].rules.stepienRule.status).toBe('NEEDS_INPUT');
  });

  it('enforces second apron restrictions', () => {
    const teamA = makeTeam('A', 210_000_000); // Above 2nd apron (207.8M for 2025-26)
    const teamB = makeTeam('B', 100_000_000);
    const aPlayer1 = makePlayer('A1', 10_000_000);
    const aPlayer2 = makePlayer('A2', 5_000_000);
    const bPlayer = makePlayer('B1', 15_000_000);
    teamA.players.push(aPlayer1, aPlayer2);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [aPlayer1, aPlayer2], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(false);
    expect(result.reason).toContain(
      'Second apron team cannot aggregate salaries'
    );
  });

  it('prevents second apron teams from taking back more salary', () => {
    const teamA = makeTeam('A', 210_000_000); // Above 2nd apron (207.8M for 2025-26)
    const teamB = makeTeam('B', 100_000_000);
    const aPlayer = makePlayer('A1', 10_000_000);
    const bPlayer = makePlayer('B1', 12_000_000);
    teamA.players.push(aPlayer);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [aPlayer], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(false);
    expect(result.reason).toContain(
      'Second apron team cannot receive more salary than sent'
    );
  });

  it('fails closed when cash lacks saved-world authority', () => {
    const teamA = makeTeam('A', 210_000_000); // Above 2nd apron (207.8M for 2025-26)
    const teamB = makeTeam('B', 100_000_000);
    const aPlayer = makePlayer('A1', 1_000_000);
    const bPlayer = makePlayer('B1', 1_000_000);
    teamA.players.push(aPlayer);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [aPlayer], picksOut: [], cashSent: 1_000_000 },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(false);
    expect(result.reason).toContain('Cash consideration needs governed input');
  });

  it('fails closed before evaluating a beyond-seven-years first-round pick', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);

    const result = validateTrade({
      teams: [
        {
          team: teamA,
          sends: [],
          picksOut: [{ year: 2033, round: '1st' }],
        },
        { team: teamB, sends: [], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(false);
    expect(result.reason).toContain('Needs input');
    expect(result.teamResults[0].rules.stepienRule.status).toBe('NEEDS_INPUT');
  });

  it('handles 3-team trades correctly', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const teamC = makeTeam('C', 100_000_000, 15);
    const aPlayer = { ...makePlayer('A1', 10_000_000), tradeTo: 'B' };
    const bPlayer = { ...makePlayer('B1', 5_000_000), tradeTo: 'A' };
    const cPlayer = { ...makePlayer('C1', 5_000_000), tradeTo: 'A' };

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [aPlayer], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
        { team: teamC, sends: [cPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(true);
    expect(result.summaryByTeamIndex[0].playersIn.length).toBe(2);
    expect(result.summaryByTeamIndex[1].playersIn.length).toBe(1);
  });

  it('provides summary and financial deltas', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const aPlayer = makePlayer('Astar', 10_000_000);
    const bPlayer = makePlayer('Bstar', 5_000_000);
    teamA.players.push(aPlayer);
    teamB.players.push(bPlayer);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [aPlayer], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ],
      capProjections,
      currentYear,
    });

    const summaryA = result.summaryByTeamIndex[0];
    const summaryB = result.summaryByTeamIndex[1];

    expect(summaryA.playersOut).toContain('Astar');
    expect(summaryA.playersIn).toContain('Bstar');
    expect(summaryA.capDelta).toBe(-5_000_000);

    expect(summaryB.capDelta).toBe(5_000_000);
    expect(result.teamResults[0]).toHaveProperty('totalSalary');
    expect(result.teamResults[0]).toHaveProperty('capRoom');
  });
});
