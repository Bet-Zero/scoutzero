import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator.js';
import { validateTradeExceptions } from '@/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js';
import capProjections from '@/features/architect/utils/capProjections.js';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;
const tradeDate = '2025-07-01T00:00:00.000Z';

const makePlayer = (name, salary, extra = {}) => ({
  name,
  salary,
  contract: { salariesByYear: [{ season, salary }] },
  ...extra,
});

const makeTeam = (name, totalSalary, rosterSize = 14) => ({
  id: name,
  teamName: name,
  totalSalary,
  teamTotalSalary: totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000)
  ),
  picks: [],
});

const makeHeldTpe = (id, amount) => ({
  id,
  amount,
  totalAmount: amount,
  remaining: amount,
  remainingAmount: amount,
  expiresOn: '2026-07-01T00:00:00.000Z',
  expirationDate: '2026-07-01T00:00:00.000Z',
  createdSeason: 2025,
});

const issueTexts = (issues = []) =>
  issues.map((issue) => getValidationIssueText(issue));

describe('TPE absorption fail-closed guards', () => {
  it('rejects absorptionMode=TPE when tpeId is missing', () => {
    const teamA = makeTeam('A', 150_000_000);
    const teamB = makeTeam('B', 120_000_000);
    teamA.exceptions = { tpe: [makeHeldTpe('tpe1', 10_000_000)] };

    const incoming = {
      ...makePlayer('In', 5_000_000, {
        absorptionMode: 'TPE',
        fromTeamId: 'B',
      }),
    };
    teamB.players.push(incoming);

    const res = validateTrade({
      teams: [
        { team: teamA, sends: [], picksOut: [] },
        { team: teamB, sends: [incoming], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { tradeDate },
    });

    expect(issueTexts(res.teamResults[0].violations)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("absorptionMode='TPE' but no tpeId"),
      ])
    );
  });

  it('rejects an unknown tpeId through live validateTrade', () => {
    const teamA = makeTeam('A', 150_000_000);
    const teamB = makeTeam('B', 120_000_000);

    const incoming = {
      ...makePlayer('In', 5_000_000, {
        absorptionMode: 'TPE',
        tpeId: 'ghost-tpe',
        fromTeamId: 'B',
      }),
    };
    teamB.players.push(incoming);

    const res = validateTrade({
      teams: [
        { team: teamA, sends: [], picksOut: [] },
        { team: teamB, sends: [incoming], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { tradeDate },
    });

    expect(issueTexts(res.teamResults[0].violations)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("tpeId 'ghost-tpe' which does not exist on this team"),
      ])
    );
  });

  it('rejects an assigned tpeId that does not resolve against team-held TPEs', () => {
    const teamA = makeTeam('A', 150_000_000);
    const teamB = makeTeam('B', 120_000_000);
    teamA.exceptions = { tpe: [makeHeldTpe('real-tpe', 10_000_000)] };

    const incoming = {
      ...makePlayer('In', 5_000_000, {
        absorptionMode: 'TPE',
        tpeId: 'stale-selected-tpe',
        fromTeamId: 'B',
      }),
    };
    teamB.players.push(incoming);

    const res = validateTrade({
      teams: [
        { team: teamA, sends: [], picksOut: [] },
        { team: teamB, sends: [incoming], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { tradeDate },
    });

    expect(issueTexts(res.teamResults[0].violations)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          "tpeId 'stale-selected-tpe' which does not exist on this team"
        ),
      ])
    );
  });

  it('validates successfully when absorptionMode=TPE with a valid team-held tpeId', () => {
    const teamA = makeTeam('A', 150_000_000);
    const teamB = makeTeam('B', 120_000_000);
    teamA.exceptions = { tpe: [makeHeldTpe('valid-tpe', 10_000_000)] };

    const incoming = {
      ...makePlayer('In', 5_000_000, {
        absorptionMode: 'TPE',
        tpeId: 'valid-tpe',
        fromTeamId: 'B',
      }),
    };
    teamB.players.push(incoming);

    const res = validateTrade({
      teams: [
        { team: teamA, sends: [], picksOut: [] },
        { team: teamB, sends: [incoming], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { tradeDate },
    });

    const tpeViolations = issueTexts(res.teamResults[0].violations || []).filter(
      (v) => v.includes('tpeId') || v.includes('absorptionMode')
    );
    expect(tpeViolations).toHaveLength(0);
  });

  it('validateTradeExceptions directly rejects absorptionMode=TPE without tpeId', () => {
    const result = validateTradeExceptions({
      teamTotalSalary: 150_000_000,
      context: { capSettings: { secondApron: 190_000_000 } },
      incomingPlayers: [
        { name: 'TestPlayer', absorptionMode: 'TPE', salary: 5_000_000 },
      ],
      outgoingPlayers: [],
      sends: [],
      appliedTPEs: [],
      tradeExceptions: [],
      salaryOut: 0,
      salaryIn: 0,
    });

    expect(result.passed).toBe(false);
    expect(issueTexts(result.violations)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("absorptionMode='TPE' but no tpeId"),
      ])
    );
  });

  it('validateTradeExceptions directly rejects unresolvable tpeId', () => {
    const result = validateTradeExceptions({
      teamTotalSalary: 150_000_000,
      context: { capSettings: { secondApron: 190_000_000 } },
      team: {
        exceptions: {
          tpe: [makeHeldTpe('real-one', 10_000_000)],
        },
      },
      incomingPlayers: [
        {
          name: 'TestPlayer',
          absorptionMode: 'TPE',
          tpeId: 'ghost',
          salary: 5_000_000,
        },
      ],
      outgoingPlayers: [],
      sends: [],
      appliedTPEs: [],
      tradeExceptions: [],
      salaryOut: 0,
      salaryIn: 0,
    });

    expect(result.passed).toBe(false);
    expect(issueTexts(result.violations)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("does not exist on this team"),
      ])
    );
  });
});
