import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/utils/architect/tradeMachine/tradeValidator.js';
import { validateTradeInput } from '@/utils/architect/tradeMachine/utils/validateInput.js';
import { normalizeTradeInput } from '@/utils/architect/tradeMachine/utils/normalizeTradeInput.js';
import capProjections from '@/utils/architect/capProjections.js';

const currentYear = 2025;

describe('Trade Input Validation', () => {
  it('catches missing teams array', () => {
    const result = validateTradeInput({
      capProjections,
      currentYear,
    });

    expect(result).toContain('Teams must be provided as an array');
  });

  it('requires at least 2 teams', () => {
    const result = validateTradeInput({
      teams: [{ team: { teamName: 'Team A' } }],
      capProjections,
      currentYear,
    });

    expect(result).toContain('Trade must include at least 2 teams');
  });

  it('validates required team properties', () => {
    const result = validateTradeInput({
      teams: [{ team: {} }, { team: { teamName: 'Team B' } }],
      capProjections,
      currentYear,
    });

    expect(result).toContain('must have either');
  });

  it('validates player salary data', () => {
    const result = validateTradeInput({
      teams: [
        {
          team: { teamName: 'Team A' },
          sends: [{ name: 'Player A' }],
        },
        { team: { teamName: 'Team B' } },
      ],
      capProjections,
      currentYear,
    });

    expect(result).toContain('missing required salary data');
  });

  it('validates pick data', () => {
    const result = validateTradeInput({
      teams: [
        {
          team: { teamName: 'Team A' },
          picksOut: [{}],
        },
        { team: { teamName: 'Team B' } },
      ],
      capProjections,
      currentYear,
    });

    expect(result).toContain('Pick missing required year/round');
  });
});

describe('Trade Input Normalization', () => {
  it('normalizes team data', () => {
    const input = {
      teams: [
        {
          team: {
            teamName: 'Team A',
            totalSalary: 100_000_000,
            players: [],
          },
          sends: [],
        },
        {
          team: {
            teamName: 'Team B',
            payroll: 90_000_000,
            players: [],
          },
          sends: [],
        },
      ],
      capProjections,
      currentYear,
    };

    const { teams } = normalizeTradeInput(input);

    expect(teams[0].team.teamTotalSalary).toBe(100_000_000);
    expect(teams[1].team.teamTotalSalary).toBe(90_000_000);
    expect(teams[0].team.projectedSalary).toBe(100_000_000);
    expect(teams[1].team.projectedSalary).toBe(90_000_000);
  });

  it('normalizes player data', () => {
    const input = {
      teams: [
        {
          team: {
            teamName: 'Team A',
            players: [],
          },
          sends: [
            {
              name: 'Player A',
              contract_clean: {
                salaries_by_year: { [currentYear]: { salary: 10_000_000 } },
              },
              signAndTrade: true,
            },
          ],
        },
        {
          team: { teamName: 'Team B', players: [] },
          sends: [],
        },
      ],
      capProjections,
      currentYear,
    };

    const { teams } = normalizeTradeInput(input);
    const player = teams[0].sends[0];

    expect(player.name).toBe('Player A');
    expect(player.salary).toBe(10_000_000);
    expect(player.signAndTrade).toBe(true);
    expect(player.absorptionMode).toBe('MATCH');
    expect(player.firstYearGuaranteed).toBe(true);
  });

  it('handles validation errors in main validator', () => {
    const result = validateTrade({
      teams: [{ team: { teamName: 'Solo Team' } }],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(false);
    expect(result.error).toBe('INVALID_INPUT');
    expect(result.violations).toContain('Trade must include at least 2 teams');
  });
});
