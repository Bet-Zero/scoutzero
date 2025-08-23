import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/utils/architect/tradeMachine/engine/tradeValidator.js';
import capProjections from '@/utils/architect/capProjections.js';

const currentYear = 2025;
const tradeDate = '2025-07-01T00:00:00.000Z';

const makePlayer = (name, salary) => ({
  name,
  contract_clean: { salaries_by_year: { [currentYear]: { salary } } },
});

const makeTeam = (name, totalSalary, rosterSize = 14) => ({
  id: name,
  teamName: name,
  totalSalary,
  players: Array.from({ length: rosterSize }, (_, i) =>
    makePlayer(`${name}${i}`, 1_000_000)
  ),
  picks: [],
});

describe('TPE creation and usage', () => {
  it('creates a TPE when sending out more salary than received', () => {
    const teamA = makeTeam('A', 160_000_000); // Changed from 150M to be over 154.6M cap
    const teamB = makeTeam('B', 120_000_000);
    const outgoing = { ...makePlayer('Out', 18_000_000), toTeamId: 'B' };
    const incoming = { ...makePlayer('In', 10_000_000), fromTeamId: 'B' };
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
    const expiry = new Date(tpe.expiryISO);
    const expected = new Date(tradeDate);
    expected.setUTCFullYear(expected.getUTCFullYear() + 1);
    expect(expiry.getUTCFullYear()).toBe(expected.getUTCFullYear());
  });

  it('rejects usage of an expired TPE', () => {
    const teamA = makeTeam('A', 150_000_000);
    const teamB = makeTeam('B', 120_000_000);
    const tpe = {
      id: 't1',
      amount: 5_000_000,
      expiryISO: '2024-07-01T00:00:00.000Z',
      createdSeason: 2024,
    };
    teamA.tradeExceptions = [tpe];
    const incoming = {
      ...makePlayer('In', 4_000_000),
      acquiredViaTPE: true,
      tpeId: 't1',
      fromTeamId: 'B',
    };
    teamB.players.push(incoming);

    const res = validateTrade({
      teams: [
        { team: teamA, sends: [], picksOut: [], appliedTPEs: [tpe] },
        { team: teamB, sends: [incoming], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { tradeDate },
    });

    expect(res.teamResults[0].legal).toBe(false);
    expect(res.teamResults[0].violations).toContain(
      'Trade exception t1 is expired'
    );
  });

  it('rejects combining a TPE with outgoing salary', () => {
    const teamA = makeTeam('A', 150_000_000);
    const teamB = makeTeam('B', 120_000_000);
    const tpe = {
      id: 't2',
      amount: 5_000_000,
      expiryISO: '2026-07-01T00:00:00.000Z',
      createdSeason: 2025,
    };
    teamA.tradeExceptions = [tpe];
    const outgoing = { ...makePlayer('Out', 5_000_000), toTeamId: 'B' };
    const incoming = {
      ...makePlayer('In', 5_000_000),
      acquiredViaTPE: true,
      tpeId: 't2',
      fromTeamId: 'B',
    };
    teamA.players.push(outgoing);
    teamB.players.push(incoming);

    const res = validateTrade({
      teams: [
        { team: teamA, sends: [outgoing], picksOut: [], appliedTPEs: [tpe] },
        { team: teamB, sends: [incoming], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { tradeDate },
    });

    expect(res.teamResults[0].legal).toBe(false);
    expect(res.teamResults[0].violations).toContain(
      'Cannot aggregate trade exception with outgoing salary'
    );
  });

  it('rejects TPE usage for second-apron teams', () => {
    const teamA = makeTeam('A', 210_000_000); // Changed from 195M to be over 207.8M second apron
    const teamB = makeTeam('B', 120_000_000);
    const tpe = {
      id: 't3',
      amount: 5_000_000,
      expiryISO: '2025-07-02T00:00:00.000Z',
      createdSeason: 2024,
    };
    teamA.tradeExceptions = [tpe];
    const incoming = {
      ...makePlayer('In', 4_000_000),
      acquiredViaTPE: true,
      tpeId: 't3',
      fromTeamId: 'B',
    };
    teamB.players.push(incoming);

    const res = validateTrade({
      teams: [
        { team: teamA, sends: [], picksOut: [], appliedTPEs: [tpe] },
        { team: teamB, sends: [incoming], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { tradeDate },
    });

    expect(res.teamResults[0].legal).toBe(false);
    // Since this is a prior-year TPE (2024), expect the specific prior-year violation message
    expect(res.teamResults[0].violations).toContain(
      'Second apron: prior-year TPEs cannot be used.'
    );
  });
});
