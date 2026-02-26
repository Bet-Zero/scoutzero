import { describe, it, expect } from 'vitest';
import { getTeamSnapshot } from '@/features/architect/hooks/useTradeMachineSnapshot';
import {
  getDisplayAllowableIncoming,
  getOfficialSalaryMatchingSnapshot,
} from '@/features/architect/tradeMachine/utils/getOfficialSalaryMatchingSnapshot';

describe('Allowable Incoming UI Parity Guardrail', () => {
  it('Team Card and Summary use the same hard-cap-limited display value', () => {
    const validationResult = {
      teamResults: [
        {
          teamId: 'LAL',
          teamName: 'Los Angeles Lakers',
          salaryOut: 10_000_000,
          salaryIn: 12_000_000,
          rules: {
            salaryMatching: {
              passed: true,
              allowableIncoming: 17_500_000,
              effectiveAllowableIncoming: 11_000_000,
              hardCapIncomingCeiling: 11_000_000,
              details: {
                hardCapStatus: { isHardCapped: true },
                hardCapCeiling: { limiter: 'hardCap', apronLabel: '1st Apron' },
              },
            },
          },
        },
      ],
    };

    const teamCardSnapshot = getTeamSnapshot('LAL', validationResult);
    const officialSnapshot = getOfficialSalaryMatchingSnapshot(
      validationResult.teamResults[0]
    );
    const summaryDisplayAllowable = getDisplayAllowableIncoming(officialSnapshot);

    expect(teamCardSnapshot?.displayAllowableIncoming).toBe(11_000_000);
    expect(summaryDisplayAllowable).toBe(11_000_000);
    expect(teamCardSnapshot?.displayAllowableIncoming).toBe(summaryDisplayAllowable);
  });

  it('falls back to salary matching allowable when no hard-cap ceiling is active', () => {
    const validationResult = {
      teamResults: [
        {
          teamId: 'BOS',
          teamName: 'Boston Celtics',
          salaryOut: 10_000_000,
          salaryIn: 12_000_000,
          rules: {
            salaryMatching: {
              passed: true,
              allowableIncoming: 17_500_000,
              effectiveAllowableIncoming: null,
              hardCapIncomingCeiling: null,
              details: {
                hardCapStatus: null,
              },
            },
          },
        },
      ],
    };

    const teamCardSnapshot = getTeamSnapshot('BOS', validationResult);
    const officialSnapshot = getOfficialSalaryMatchingSnapshot(
      validationResult.teamResults[0]
    );
    const summaryDisplayAllowable = getDisplayAllowableIncoming(officialSnapshot);

    expect(teamCardSnapshot?.displayAllowableIncoming).toBe(17_500_000);
    expect(summaryDisplayAllowable).toBe(17_500_000);
    expect(teamCardSnapshot?.displayAllowableIncoming).toBe(summaryDisplayAllowable);
  });
});
