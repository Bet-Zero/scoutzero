import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/utils/architect/tradeMachine/engine/tradeValidator.js';
import capProjections from '@/utils/architect/capProjections.js';

const currentYear = 2025;

const makePlayer = (
  name,
  salary,
  {
    signAndTrade = false,
    contractYears = 4,
    firstYearGuaranteed = true,
    originTeamId = 'A',
  } = {}
) => ({
  name,
  signAndTrade,
  contractYears,
  firstYearGuaranteed,
  originTeamId,
  contract_clean: { salaries_by_year: { [currentYear]: { salary } } },
});

const makeTeam = (id, totalSalary, extra = {}) => ({
  id,
  teamName: id,
  totalSalary,
  picks: [],
  players: Array.from({ length: 14 }, (_, i) =>
    makePlayer(`${id}${i}`, 1_000_000, { originTeamId: id })
  ),
  ...extra,
});

describe('sign-and-trade completeness', () => {
  it('rejects invalid contract years', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const sat = makePlayer('SAT', 10_000_000, { signAndTrade: true, contractYears: 2, originTeamId: 'A' });
    const b = makePlayer('B1', 5_000_000, { originTeamId: 'B' });
    teamA.players.push(sat);
    teamB.players.push(b);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [sat], picksOut: [] },
        { team: teamB, sends: [b], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { offseason: true },
    });

    expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
  });

  it('rejects non-guaranteed first year', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const sat = makePlayer('SAT', 10_000_000, { signAndTrade: true, firstYearGuaranteed: false, originTeamId: 'A' });
    const b = makePlayer('B1', 5_000_000, { originTeamId: 'B' });
    teamA.players.push(sat);
    teamB.players.push(b);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [sat], picksOut: [] },
        { team: teamB, sends: [b], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { offseason: true },
    });

    expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
  });

  it('rejects sign-and-trade from non-origin team', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const sat = makePlayer('SAT', 10_000_000, { signAndTrade: true, originTeamId: 'C' });
    const b = makePlayer('B1', 5_000_000, { originTeamId: 'B' });
    teamA.players.push(sat);
    teamB.players.push(b);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [sat], picksOut: [] },
        { team: teamB, sends: [b], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { offseason: true },
    });

    expect(result.teamResults[0].rules.signAndTrade.passed).toBe(false);
  });

  it('rejects sign-and-trade outside offseason', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000);
    const sat = makePlayer('SAT', 10_000_000, { signAndTrade: true, originTeamId: 'A' });
    const b = makePlayer('B1', 5_000_000, { originTeamId: 'B' });
    teamA.players.push(sat);
    teamB.players.push(b);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [sat], picksOut: [] },
        { team: teamB, sends: [b], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { offseason: false },
    });

    expect(result.teamResults[0].rules.signAndTrade.passed).toBe(false);
    expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
  });

  it('rejects teams using taxpayer MLE from receiving S&T players', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 100_000_000, { usedTaxpayerMLEThisSeason: true });
    const sat = makePlayer('SAT', 10_000_000, { signAndTrade: true, originTeamId: 'A' });
    const b = makePlayer('B1', 5_000_000, { originTeamId: 'B' });
    teamA.players.push(sat);
    teamB.players.push(b);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [sat], picksOut: [] },
        { team: teamB, sends: [b], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { offseason: true },
    });

    expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
  });

  it('enforces hard cap after sign-and-trade', () => {
    const teamA = makeTeam('A', 100_000_000);
    const teamB = makeTeam('B', 171_000_000);
    const sat = makePlayer('SAT', 20_000_000, { signAndTrade: true, originTeamId: 'A' });
    const b = makePlayer('B1', 1_000_000, { originTeamId: 'B' });
    teamA.players.push(sat);
    teamB.players.push(b);

    const result = validateTrade({
      teams: [
        { team: teamA, sends: [sat], picksOut: [] },
        { team: teamB, sends: [b], picksOut: [] },
      ],
      capProjections,
      currentYear,
      tradeCtx: { offseason: true },
    });

    expect(result.teamResults[1].rules.signAndTrade.passed).toBe(false);
    expect(result.teamResults[1].hardCapped).toBe(true);
  });
});
