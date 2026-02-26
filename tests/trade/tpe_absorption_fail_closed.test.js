import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator.js';
import { validateTradeExceptions } from '@/features/architect/utils/tradeMachine/rules/validateTradeExceptions.js';
import capProjections from '@/features/architect/utils/capProjections.js';

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;
const tradeDate = '2025-07-01T00:00:00.000Z';

const makePlayer = (name, salary) => ({
  name,
  contract: { salariesByYear: [{ season, salary }] },
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

describe('TPE absorption fail-closed guards', () => {
  it('rejects absorptionMode=TPE when tpeId is missing', () => {
    const teamA = makeTeam('A', 150_000_000);
    const teamB = makeTeam('B', 120_000_000);
    const tpe = {
      id: 'tpe1',
      amount: 10_000_000,
      expiryISO: '2026-07-01T00:00:00.000Z',
      createdSeason: 2025,
    };
    teamA.tradeExceptions = [tpe];

    // Player has absorptionMode='TPE' but NO tpeId
    const incoming = {
      ...makePlayer('In', 5_000_000),
      absorptionMode: 'TPE',
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

    expect(res.teamResults[0].violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining("absorptionMode='TPE' but no tpeId"),
      ])
    );
  });

  it('rejects tpeId that does not resolve to an existing TPE', () => {
    const teamA = makeTeam('A', 150_000_000);
    const teamB = makeTeam('B', 120_000_000);
    const tpe = {
      id: 'real-tpe',
      amount: 10_000_000,
      expiryISO: '2026-07-01T00:00:00.000Z',
      createdSeason: 2025,
    };
    teamA.tradeExceptions = [tpe];

    // Player references a tpeId that doesn't exist
    const incoming = {
      ...makePlayer('In', 5_000_000),
      absorptionMode: 'TPE',
      tpeId: 'nonexistent-tpe',
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

    expect(res.teamResults[0].violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining("does not exist on this team"),
      ])
    );
  });

  it('validates successfully when absorptionMode=TPE with valid tpeId', () => {
    const teamA = makeTeam('A', 150_000_000);
    const teamB = makeTeam('B', 120_000_000);
    const tpe = {
      id: 'valid-tpe',
      amount: 10_000_000,
      expiryISO: '2026-07-01T00:00:00.000Z',
      createdSeason: 2025,
    };
    teamA.tradeExceptions = [tpe];

    const incoming = {
      ...makePlayer('In', 5_000_000),
      absorptionMode: 'TPE',
      tpeId: 'valid-tpe',
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

    // Should not contain fail-closed violations
    const tpeViolations = (res.teamResults[0].violations || []).filter(
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
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining("absorptionMode='TPE' but no tpeId"),
      ])
    );
  });

  it('validateTradeExceptions directly rejects unresolvable tpeId', () => {
    const result = validateTradeExceptions({
      teamTotalSalary: 150_000_000,
      context: { capSettings: { secondApron: 190_000_000 } },
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
      appliedTPEs: [
        { id: 'real-one', amount: 10_000_000, createdSeason: 2025 },
      ],
      tradeExceptions: [],
      salaryOut: 0,
      salaryIn: 0,
    });

    expect(result.passed).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining("does not exist on this team"),
      ])
    );
  });
});
