import { describe, expect, it } from 'vitest';
import {
  computeMatchingValues as computeMatchingValuesWrapper,
  getCapHitForSeason as getCapHitForSeasonWrapper,
  getIncomingCeilingForTeam,
} from '@/features/architect/utils/tradeMachine/utils/salaryUtils';
import { computeMatchingValues as computeMatchingValuesCanonical } from '@/features/architect/utils/tradeMachine/utils/matchingValues';
import { getCapHitForSeason as getCapHitForSeasonCanonical } from '@/features/architect/utils/tradeMachine/utils/seasonUtils';
import { getSalaryMatchingResult } from '@/features/architect/utils/tradeMachine/utils/salaryMatchingRules';

const currentYear = 2025;
const season = `${currentYear - 1}-${String(currentYear).slice(-2)}`;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('salaryUtils compatibility wrapper', () => {
  it('delegates computeMatchingValues to the canonical matching-values surface', () => {
    const player = {
      id: 'byc-player',
      name: 'BYC Player',
      isBYC: true,
      previousSalary: 8_000_000,
      contract: {
        salariesByYear: [
          {
            season,
            salary: 20_000_000,
          },
        ],
      },
    };

    const wrapperTeams = [{ sends: [clone(player)] }];
    const canonicalTeams = [{ sends: [clone(player)] }];

    const wrapperResult = computeMatchingValuesWrapper({
      teams: wrapperTeams,
      yearKey: currentYear,
    });
    const canonicalResult = computeMatchingValuesCanonical({
      teams: canonicalTeams,
      yearKey: currentYear,
    });

    expect(wrapperTeams[0].sends[0].matchOutgoing).toBe(
      canonicalTeams[0].sends[0].matchOutgoing
    );
    expect(wrapperTeams[0].sends[0].matchIncoming).toBe(
      canonicalTeams[0].sends[0].matchIncoming
    );
    expect(wrapperResult).toEqual(canonicalResult);
  });

  it('mirrors seasonUtils getCapHitForSeason for season-string and numeric inputs', () => {
    const player = {
      id: 'cap-hit-player',
      contract: {
        salariesByYear: [
          {
            season,
            salary: 5_000_000,
            capHit: 5_500_000,
          },
          {
            season: '2025-26',
            salary: 6_000_000,
            capHit: 6_500_000,
          },
        ],
      },
    };

    expect(getCapHitForSeasonWrapper(player, season)).toBe(
      getCapHitForSeasonCanonical(player, season)
    );
    expect(getCapHitForSeasonWrapper(player, currentYear)).toBe(
      getCapHitForSeasonCanonical(player, currentYear)
    );
  });

  it('preserves the legacy under-cap compatibility ceiling behavior', () => {
    const team = {
      sends: [{ matchOutgoing: 10_000_000 }],
      team: {
        isOverCap: false,
        totalSalary: 130_000_000,
      },
      context: {
        capSettings: {
          salaryCap: 140_588_000,
          firstApron: 178_132_000,
          secondApron: 188_938_000,
        },
      },
    };

    expect(getIncomingCeilingForTeam(team)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('uses explicit nested Apron Team Salary and the cap alias for ceiling calculations', () => {
    const team = {
      sends: [{ matchOutgoing: 10_000_000 }],
      team: {
        isOverCap: true,
        apronTeamSalary: 130_000_000,
        totalSalary: 130_000_000,
      },
      context: {
        capSettings: {
          cap: 140_588_000,
          firstApron: 178_132_000,
          secondApron: 188_938_000,
        },
      },
    };

    const expected = getSalaryMatchingResult({
      teamTotalSalary: 130_000_000,
      outgoingSalary: 10_000_000,
      capSettings: {
        salaryCap: 140_588_000,
        firstApron: 178_132_000,
        secondApron: 188_938_000,
      },
    }).allowableIncoming;

    expect(getIncomingCeilingForTeam(team)).toBe(expected);
  });
});
