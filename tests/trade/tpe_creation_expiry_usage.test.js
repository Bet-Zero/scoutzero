import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import capProjections from '@/features/architect/utils/capProjections.js';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';

const DEFAULT_CURRENT_YEAR = 2025;
const DEFAULT_TRADE_DATE = '2025-07-01T00:00:00.000Z';

const seasonForYear = (year) => `${year - 1}-${String(year).slice(-2)}`;

const makePlayer = (name, salary, extra = {}, year = DEFAULT_CURRENT_YEAR) => ({
  name,
  salary,
  contract: { salariesByYear: [{ season: seasonForYear(year), salary }] },
  ...extra,
});

const makeTeam = (
  name,
  totalSalary,
  rosterSize = 14,
  year = DEFAULT_CURRENT_YEAR
) => ({
  id: name,
  teamName: name,
  totalSalary,
  teamTotalSalary: totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000, {}, year)
  ),
  picks: [],
});

const makeHeldTpe = (id, amount, expiresOn, createdSeason) => ({
  id,
  amount,
  totalAmount: amount,
  remaining: amount,
  remainingAmount: amount,
  expiresOn,
  expirationDate: expiresOn,
  createdSeason,
});

const issueTexts = (issues = []) =>
  issues.map((issue) => getValidationIssueText(issue));

describe('TPE creation and usage', () => {
  it('creates a TPE when sending out more salary than received', () => {
    const currentYear = DEFAULT_CURRENT_YEAR;
    const tradeDate = DEFAULT_TRADE_DATE;
    const teamA = makeTeam('A', 150_000_000, 14, currentYear);
    const teamB = makeTeam('B', 120_000_000, 14, currentYear);
    const outgoing = {
      ...makePlayer('Out', 18_000_000, { toTeamId: 'B' }, currentYear),
    };
    const incoming = {
      ...makePlayer('In', 10_000_000, { fromTeamId: 'B' }, currentYear),
    };
    teamA.players.push(outgoing);
    teamB.players.push(incoming);

    const res = validateTrade({
      teams: [
        { team: teamA, sends: [outgoing], picksOut: [] },
        { team: teamB, sends: [incoming], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { tradeDate },
    });

    const tpe = res.teamResults[0].createdTPE;
    expect(tpe.amount).toBe(8_000_000);
    const expiry = new Date(tpe.expiresOn);
    const expected = new Date(tradeDate);
    expected.setUTCFullYear(expected.getUTCFullYear() + 1);
    expect(expiry.getUTCFullYear()).toBe(expected.getUTCFullYear());
  });

  it('allows a historical team-held TPE when canonical tradeDate is before expiry', () => {
    const currentYear = 2025;
    const tradeDate = '2025-07-15T00:00:00.000Z';
    const teamA = makeTeam('A', 150_000_000, 14, currentYear);
    const teamB = makeTeam('B', 120_000_000, 14, currentYear);
    const tpe = makeHeldTpe(
      'historic-tpe',
      5_000_000,
      '2025-08-01T00:00:00.000Z',
      2025
    );
    teamA.exceptions = { tpe: [tpe] };

    const incoming = {
      ...makePlayer(
        'In',
        4_000_000,
        {
          absorptionMode: 'TPE',
          tpeId: 'historic-tpe',
          fromTeamId: 'B',
        },
        currentYear
      ),
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

    expect(res.teamResults[0].legal).toBe(true);
    expect(res.teamResults[0].rules.tradeExceptions.passed).toBe(true);
    expect(issueTexts(res.teamResults[0].rules.tradeExceptions.violations)).toEqual(
      []
    );
  });

  it('rejects an expired tpeId using the canonical future tradeDate', () => {
    const currentYear = 2026;
    const tradeDate = '2026-06-15T00:00:00.000Z';
    const teamA = makeTeam('A', 150_000_000, 14, currentYear);
    const teamB = makeTeam('B', 120_000_000, 14, currentYear);
    const tpe = makeHeldTpe(
      'future-expired-tpe',
      5_000_000,
      '2026-05-15T00:00:00.000Z',
      2026
    );
    teamA.exceptions = { tpe: [tpe] };

    const incoming = {
      ...makePlayer(
        'In',
        4_000_000,
        {
          absorptionMode: 'TPE',
          tpeId: 'future-expired-tpe',
          fromTeamId: 'B',
        },
        currentYear
      ),
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

    expect(res.teamResults[0].legal).toBe(false);
    expect(issueTexts(res.teamResults[0].violations)).toContain(
      'Trade exception future-expired-tpe is expired'
    );
  });

  it('rejects combining a live-path team-held TPE with outgoing salary', () => {
    const currentYear = DEFAULT_CURRENT_YEAR;
    const tradeDate = DEFAULT_TRADE_DATE;
    const teamA = makeTeam('A', 150_000_000, 14, currentYear);
    const teamB = makeTeam('B', 120_000_000, 14, currentYear);
    const tpe = makeHeldTpe(
      'live-tpe',
      5_000_000,
      '2026-07-01T00:00:00.000Z',
      2025
    );
    teamA.exceptions = { tpe: [tpe] };
    const outgoing = {
      ...makePlayer('Out', 5_000_000, { toTeamId: 'B' }, currentYear),
    };
    const incoming = {
      ...makePlayer(
        'In',
        5_000_000,
        {
          absorptionMode: 'TPE',
          tpeId: 'live-tpe',
          fromTeamId: 'B',
        },
        currentYear
      ),
    };
    teamA.players.push(outgoing);
    teamB.players.push(incoming);

    const res = validateTrade({
      teams: [
        { team: teamA, sends: [outgoing], picksOut: [] },
        { team: teamB, sends: [incoming], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { tradeDate },
    });

    expect(res.teamResults[0].legal).toBe(false);
    expect(issueTexts(res.teamResults[0].violations)).toContain(
      'Cannot aggregate trade exception with outgoing salary'
    );
  });
});
