/**
 * FILE: tests/signAndTradeAggregation.test.js
 * PURPOSE: Tests for sign-and-trade aggregation prohibition rules in the
 * authoritative Trade Machine validator path.
 */

import { describe, expect, it } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine';
import capProjections from '@/features/architect/utils/capProjections';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;
const tradeCtx = {
  offseason: true,
  source: 'tradeMachine',
  asOfDate: '2025-01-20',
};

const issueTexts = (issues = []) => issues.map((issue) => getValidationIssueText(issue));

const makeSatContract = (firstYearSalary) => ({
  contractType: 'Sign & Trade',
  contractYears: 3,
  firstYearGuaranteed: true,
  salariesByYear: [
    { season, salary: firstYearSalary, capHit: firstYearSalary, guaranteed: true },
    {
      season: `${currentYear}-${String(currentYear + 1).slice(-2)}`,
      salary: Math.round(firstYearSalary * 1.05),
      capHit: Math.round(firstYearSalary * 1.05),
      guaranteed: true,
    },
    {
      season: `${currentYear + 1}-${String(currentYear + 2).slice(-2)}`,
      salary: Math.round(firstYearSalary * 1.1),
      capHit: Math.round(firstYearSalary * 1.1),
      guaranteed: true,
    },
  ],
});

const makePlayer = (name, salary, extra = {}) => {
  const id = name.toLowerCase().replace(/\s+/g, '-');

  return {
    id,
    player_id: id,
    name,
    contractYears: 4,
    firstYearGuaranteed: true,
    contract: {
      salariesByYear: [{ season, salary, capHit: salary, guaranteed: true }],
    },
    ...extra,
  };
};

const makeSatPlayer = (name, firstYearSalary, originTeamId, extra = {}) =>
  makePlayer(name, 0, {
    signAndTrade: true,
    freeAgentYear: currentYear,
    originTeamId,
    signAndTradeContract: makeSatContract(firstYearSalary),
    contract: {
      salariesByYear: [{ season, salary: 0, capHit: 0, guaranteed: false }],
    },
    ...extra,
  });

const makeTeam = (name, totalSalary, rosterSize = 14, picks = []) => ({
  teamId: name,
  teamName: name,
  teamCode: name,
  totalSalary,
  teamTotalSalary: totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000)
  ),
  picks,
  rosterSize,
});

const makePick = (year, round = '1st') => ({
  year,
  round,
  type: 'pick',
});

function runTrade(teams) {
  return validateTrade({
    teams,
    capProjections,
    currentYear,
    tradeCtx,
  });
}

describe('Sign-and-trade aggregation rules', () => {
  describe('Baseline: valid S&T trades', () => {
    it('allows valid S&T where receiving team gets only the S&T player', () => {
      const teamA = makeTeam('A', 100_000_000);
      const teamB = makeTeam('B', 100_000_000);

      const satPlayer = makeSatPlayer('SATstar', 15_000_000, 'A', {
        tradeTo: 'B',
      });
      const regularPlayer = makePlayer('Bstar', 15_000_000, { tradeTo: 'A' });
      teamA.players.push(satPlayer);
      teamB.players.push(regularPlayer);

      const result = runTrade([
        { team: teamA, sends: [satPlayer], picksOut: [] },
        { team: teamB, sends: [regularPlayer], picksOut: [] },
      ]);

      expect(result.legal).toBe(true);
      expect(result.teamResults[0].rules.signAndTrade.passed).toBe(true);
      expect(result.teamResults[1].rules.signAndTrade.passed).toBe(true);
    });
  });

  describe('Outgoing aggregation (Rule 1.5)', () => {
    it('blocks origin team sending S&T player plus another player', () => {
      const teamA = makeTeam('A', 100_000_000);
      const teamB = makeTeam('B', 100_000_000);

      const satPlayer = makeSatPlayer('SATstar', 15_000_000, 'A', {
        tradeTo: 'B',
      });
      const extraPlayer = makePlayer('Aextra', 5_000_000, { tradeTo: 'B' });
      const bPlayer = makePlayer('Bstar', 20_000_000, { tradeTo: 'A' });
      teamA.players.push(satPlayer, extraPlayer);
      teamB.players.push(bPlayer);

      const result = runTrade([
        { team: teamA, sends: [satPlayer, extraPlayer], picksOut: [] },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ]);

      expect(result.legal).toBe(false);
      expect(issueTexts(result.teamResults[0].violations)).toEqual(
        expect.arrayContaining(['Sign-and-trade player must be traded alone.'])
      );
      expect(result.teamResults[0].rules.signAndTrade.passed).toBe(false);
    });
  });

  describe('Incoming aggregation (Rule 1.6)', () => {
    it('blocks receiving team getting S&T plus another player from the same origin team', () => {
      const teamA = makeTeam('A', 100_000_000, 13);
      const teamB = makeTeam('B', 100_000_000, 13);

      const satPlayer = makeSatPlayer('SATstar', 15_000_000, 'A', {
        tradeTo: 'B',
      });
      const extraPlayer = makePlayer('Aextra', 5_000_000, { tradeTo: 'B' });
      const bPlayer = makePlayer('Bstar', 20_000_000, { tradeTo: 'A' });
      teamA.players.push(satPlayer, extraPlayer);
      teamB.players.push(bPlayer);

      const result = runTrade([
        {
          team: teamA,
          sends: [satPlayer, extraPlayer],
          picksOut: [],
        },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ]);

      expect(result.legal).toBe(false);
      expect(issueTexts(result.teamResults[0].violations)).toEqual(
        expect.arrayContaining(['Sign-and-trade player must be traded alone.'])
      );
      expect(issueTexts(result.teamResults[1].violations)).toEqual(
        expect.arrayContaining([
          'Cannot aggregate other players with sign-and-trade player.',
        ])
      );
      expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
    });

    it('blocks receiving team getting S&T plus another player in the same inbound 3-team trade', () => {
      const teamA = makeTeam('A', 100_000_000, 13);
      const teamB = makeTeam('B', 100_000_000, 13);
      const teamC = makeTeam('C', 100_000_000, 13);

      const satPlayer = makeSatPlayer('SATstar', 15_000_000, 'A', {
        tradeTo: 'B',
      });
      const extraPlayer = makePlayer('Aextra', 5_000_000, { tradeTo: 'B' });
      const bOut = makePlayer('Bout', 20_000_000, { tradeTo: 'C' });
      const cOut = makePlayer('Cout', 20_000_000, { tradeTo: 'A' });
      teamA.players.push(satPlayer, extraPlayer);
      teamB.players.push(bOut);
      teamC.players.push(cOut);

      const result = runTrade([
        {
          team: teamA,
          sends: [satPlayer, extraPlayer],
          picksOut: [],
        },
        { team: teamB, sends: [bOut], picksOut: [] },
        { team: teamC, sends: [cOut], picksOut: [] },
      ]);

      expect(result.legal).toBe(false);
      expect(issueTexts(result.teamResults[1].violations)).toEqual(
        expect.arrayContaining([
          'Cannot aggregate other players with sign-and-trade player.',
        ])
      );
      expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
    });
  });

  describe('3-team incoming aggregation (Rule 1.6)', () => {
    it('blocks receiving team getting S&T plus a player from a different team', () => {
      const teamA = makeTeam('A', 100_000_000, 13);
      const teamB = makeTeam('B', 100_000_000, 13);
      const teamC = makeTeam('C', 100_000_000, 14);

      const satPlayer = makeSatPlayer('SATstar', 15_000_000, 'A', {
        tradeTo: 'B',
      });
      const bOut = makePlayer('Bout', 15_000_000, { tradeTo: 'A' });
      const cOut = makePlayer('Cout', 5_000_000, { tradeTo: 'B' });
      teamA.players.push(satPlayer);
      teamB.players.push(bOut);
      teamC.players.push(cOut);

      const result = runTrade([
        { team: teamA, sends: [satPlayer], picksOut: [] },
        { team: teamB, sends: [bOut], picksOut: [] },
        { team: teamC, sends: [cOut], picksOut: [] },
      ]);

      expect(result.legal).toBe(false);
      expect(issueTexts(result.teamResults[1].violations)).toEqual(
        expect.arrayContaining([
          'Cannot aggregate other players with sign-and-trade player.',
        ])
      );
      expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
      expect(result.teamResults[0].rules.signAndTrade.passed).toBe(true);
      expect(result.teamResults[2].rules.signAndTrade.passed).toBe(true);
    });
  });

  describe('Picks allowed with S&T', () => {
    it('allows S&T with draft picks alongside because picks are not players', () => {
      const teamA = makeTeam('A', 100_000_000);
      const teamB = makeTeam('B', 100_000_000);

      const satPlayer = makeSatPlayer('SATstar', 15_000_000, 'A', {
        tradeTo: 'B',
      });
      const bPlayer = makePlayer('Bstar', 15_000_000, { tradeTo: 'A' });
      teamA.players.push(satPlayer);
      teamB.players.push(bPlayer);

      const result = runTrade([
        {
          team: teamA,
          sends: [satPlayer],
          picksOut: [makePick(2027, '1st')],
        },
        { team: teamB, sends: [bPlayer], picksOut: [] },
      ]);

      expect(result.legal).toBe(true);
      expect(result.teamResults[0].rules.signAndTrade.passed).toBe(true);
    });
  });

  describe('Control: non-S&T trades unaffected', () => {
    it('allows non-S&T multi-player trades', () => {
      const teamA = makeTeam('A', 100_000_000, 13);
      const teamB = makeTeam('B', 100_000_000, 13);

      const aPlayer1 = makePlayer('Astar1', 10_000_000);
      const aPlayer2 = makePlayer('Astar2', 10_000_000);
      const bPlayer1 = makePlayer('Bstar1', 10_000_000);
      const bPlayer2 = makePlayer('Bstar2', 10_000_000);
      teamA.players.push(aPlayer1, aPlayer2);
      teamB.players.push(bPlayer1, bPlayer2);

      const result = runTrade([
        { team: teamA, sends: [aPlayer1, aPlayer2], picksOut: [] },
        { team: teamB, sends: [bPlayer1, bPlayer2], picksOut: [] },
      ]);

      expect(result.legal).toBe(true);
      expect(result.teamResults[0].rules.signAndTrade.passed).toBe(true);
      expect(result.teamResults[1].rules.signAndTrade.passed).toBe(true);
    });
  });

  describe('Complex 3-team S&T aggregation (Rule 1.6)', () => {
    it('blocks receiving team that gets an S&T player plus any other players', () => {
      const teamA = makeTeam('A', 100_000_000, 13);
      const teamB = makeTeam('B', 100_000_000, 12);
      const teamC = makeTeam('C', 100_000_000, 14);

      const satPlayer = makeSatPlayer('SATstar', 15_000_000, 'A', {
        tradeTo: 'B',
      });
      const bOut = makePlayer('Bout', 15_000_000, { tradeTo: 'A' });
      const cOut1 = makePlayer('Cout1', 5_000_000, { tradeTo: 'B' });
      const cOut2 = makePlayer('Cout2', 4_000_000, { tradeTo: 'B' });
      teamA.players.push(satPlayer);
      teamB.players.push(bOut);
      teamC.players.push(cOut1, cOut2);

      const result = runTrade([
        { team: teamA, sends: [satPlayer], picksOut: [] },
        { team: teamB, sends: [bOut], picksOut: [] },
        {
          team: teamC,
          sends: [cOut1, cOut2],
          picksOut: [],
        },
      ]);

      expect(result.legal).toBe(false);
      expect(issueTexts(result.teamResults[1].violations)).toEqual(
        expect.arrayContaining([
          'Cannot aggregate other players with sign-and-trade player.',
        ])
      );
      expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
    });
  });

  describe('Third-party teams remain unaffected by Rule 1.6', () => {
    it('allows a third party to receive multiple non-S&T players in a routed fixture', () => {
      const teamA = makeTeam('A', 100_000_000, 13);
      const teamB = makeTeam('B', 100_000_000, 13);
      const teamC = makeTeam('C', 100_000_000, 13);

      const satPlayer = makeSatPlayer('SATstar', 15_000_000, 'A', {
        tradeTo: 'B',
      });
      const bOut1 = makePlayer('Bout1', 8_000_000, { tradeTo: 'C' });
      const bOut2 = makePlayer('Bout2', 7_000_000, { tradeTo: 'C' });
      const cOut = makePlayer('Cout', 15_000_000, { tradeTo: 'A' });
      teamA.players.push(satPlayer);
      teamB.players.push(bOut1, bOut2);
      teamC.players.push(cOut);

      const result = runTrade([
        { team: teamA, sends: [satPlayer], picksOut: [] },
        {
          team: teamB,
          sends: [bOut1, bOut2],
          picksOut: [],
        },
        { team: teamC, sends: [cOut], picksOut: [] },
      ]);

      expect(result.legal).toBe(true);
      expect(result.teamResults[1].rules.signAndTrade.passed).toBe(true);
      expect(result.teamResults[2].rules.signAndTrade.passed).toBe(true);
    });
  });
});
