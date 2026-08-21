import { describe, it, expect } from 'vitest';
import { validateTrade } from '@/features/architect/utils/tradeMachine/engine/tradeValidator';
import { validateTradeInput } from '@/features/architect/utils/tradeMachine/utils/validateInput';
import { normalizeTradeInput } from '@/features/architect/utils/tradeMachine/utils/normalizeTradeInput';
import { getMatchingValue } from '@/features/architect/utils/tradeMachine/utils/matchingValues';
import capProjections from '@/features/architect/utils/capProjections';
import { getValidationIssueText } from '@/features/architect/utils/tradeMachine/utils/validationIssueText';
import type {
  NormalizedPlayer,
  ValidationIssue,
} from '@/features/architect/utils/tradeMachine/constants/types';

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;
const issueTexts = (issues: ValidationIssue[] = []) =>
  issues.map((issue) => getValidationIssueText(issue));

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
            teamSalary: 99_000_000,
            apronTeamSalary: 100_000_000,
            taxSalary: 101_000_000,
            players: [],
          },
          sends: [],
        },
        {
          team: {
            teamName: 'Team B',
            teamSalary: 89_000_000,
            apronTeamSalary: 90_000_000,
            taxSalary: 91_000_000,
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
              contract: {
                salariesByYear: [{ season, salary: 10_000_000 }],
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

    expect(player).toBeDefined();
    if (!player) {
      throw new Error('Expected normalized outgoing player');
    }
    expect(player.name).toBe('Player A');
    expect(player.salary).toBe(10_000_000);
    expect(player.signAndTrade).toBe(true);
    expect(player.absorptionMode).toBe('MATCH');
    expect(player.firstYearGuaranteed).toBe(true);
  });

  it('preserves deprecated getMatchingValue fallback behavior for normalizeTradeInput', () => {
    const legacyConsumerPlayer = {
      name: 'Legacy Consumer Player',
      currentSalary: 10_000_000,
      isPoisonPill: true,
      isRookieScale: true,
      extensionYears: [
        { salary: 20_000_000 },
        { salary: 22_000_000 },
        { salary: 24_000_000 },
      ],
      contract: {
        salariesByYear: [{ season, salary: 10_000_000 }],
      },
    } satisfies Partial<NormalizedPlayer>;
    const expectedLegacySalary = getMatchingValue(
      legacyConsumerPlayer,
      currentYear,
      false
    );
    const input = {
      teams: [
        {
          team: {
            teamName: 'Team A',
            players: [],
          },
          sends: [legacyConsumerPlayer],
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

    expect(expectedLegacySalary).toBe(16_000_000);
    const player = teams[0].sends[0];
    expect(player).toBeDefined();
    if (!player) {
      throw new Error('Expected normalized legacy outgoing player');
    }
    expect(player.salary).toBe(expectedLegacySalary);
  });

  it('handles validation errors in main validator', () => {
    const result = validateTrade({
      teams: [{ team: { teamName: 'Solo Team' } }],
      capProjections,
      currentYear,
    });

    expect(result.legal).toBe(false);
    expect(result.error).toBe('INVALID_INPUT');
    expect(issueTexts(result.violations)).toContain(
      'Trade must include at least 2 teams'
    );
  });
});
