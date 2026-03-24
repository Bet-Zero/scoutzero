// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import useCapValidation, {
  buildSigningGuardrails,
} from '@/features/architect/hooks/useCapValidation';
import { getCapSettings } from '@/features/architect/utils/capHelpers';
import { formatMillions } from '@/shared/utils/formatting/basicFormatting.js';

const formatSeason = (endYear: number) =>
  `${endYear - 1}-${String(endYear % 100).padStart(2, '0')}`;

const createSalaryRow = (
  endYear: number,
  amount: number,
  guaranteed = true
) => ({
  season: formatSeason(endYear),
  salary: amount,
  capHit: amount,
  guaranteed,
});

const createPlayer = ({
  playerId = 'player_one',
  birdRights = 'None',
  salariesByYear = [createSalaryRow(2026, 5_000_000)],
}: {
  playerId?: string;
  birdRights?: string;
  salariesByYear?: Array<ReturnType<typeof createSalaryRow>>;
} = {}) => ({
  playerId,
  name: playerId,
  contract: {
    birdRights: {
      status: birdRights,
    },
    salariesByYear,
  },
});

const requireCapSettings = (year: number) => {
  const capSettings = getCapSettings(year);
  if (!capSettings) {
    throw new Error(`Missing cap settings for ${year}`);
  }
  return capSettings;
};

afterEach(() => {
  cleanup();
});

describe('useCapValidation', () => {
  it('preserves signing guardrail assembly and key order', () => {
    const capSettings = requireCapSettings(2026);
    const guardrails = buildSigningGuardrails(
      {
        minimumSalary: 2_000_000,
        restrictedFreeAgency: {
          qualifyingOfferAmount: 3_000_000,
        },
        birdRights: {
          type: 'Early Bird',
          signingAbilities: {
            maxFirstYearSalary: 20_000_000,
            raisePercentage: 0.08,
            maxYears: 4,
            canSignToMax: false,
          },
        },
        maxSalary: {
          maxSalary: 30_000_000,
          maxSalaryBird: 31_000_000,
        },
      },
      capSettings,
      'Taxpayer MLE'
    );

    expect(Object.keys(guardrails)).toEqual([
      'source',
      'minFirstYear',
      'maxFirstYear',
      'raisePct',
      'maxYears',
      'qoAmount',
      'birdRightsType',
      'canSignToMax',
    ]);
    expect(guardrails).toEqual({
      source: 'Taxpayer MLE',
      minFirstYear: 3_000_000,
      maxFirstYear: capSettings.taxpayerMLE ?? capSettings.fullMLE ?? null,
      raisePct: 0.05,
      maxYears: 2,
      qoAmount: 3_000_000,
      birdRightsType: 'Early Bird',
      canSignToMax: false,
    });
  });

  it('preserves the return-object key order and exact memoization boundaries', () => {
    const player = createPlayer();
    const teamCapSheet = {
      players: [player],
    };
    const rulesProfile = {
      minimumSalary: 1_000_000,
      birdRights: {
        type: 'None',
        signingAbilities: {
          maxFirstYearSalary: 20_000_000,
          raisePercentage: 0.05,
          maxYears: 4,
          canSignToMax: false,
        },
      },
      maxSalary: {
        maxSalary: 20_000_000,
        maxSalaryBird: 20_000_000,
      },
      restrictedFreeAgency: {
        isRFA: false,
      },
    };
    const contractData = {
      base: 5_000_000,
    };
    const { result, rerender } = renderHook(
      ({ hookContractData }: { hookContractData: typeof contractData }) =>
        useCapValidation({
          player,
          action: 'signNew',
          contractData: hookContractData,
          teamCapSheet,
          currentYear: 2026,
          rulesProfile,
        }),
      {
        initialProps: {
          hookContractData: contractData,
        },
      }
    );

    expect(Object.keys(result.current)).toEqual([
      'warnings',
      'errors',
      'isValid',
      'incomplete',
    ]);

    const firstResult = result.current;

    rerender({
      hookContractData: contractData,
    });

    expect(result.current).toBe(firstResult);

    rerender({
      hookContractData: {
        base: 5_000_000,
      },
    });

    expect(result.current).not.toBe(firstResult);
  });

  it('preserves incomplete extension validation when rulesProfile is missing', () => {
    const player = createPlayer();
    const { result } = renderHook(() =>
      useCapValidation({
        player,
        action: 'extend',
        contractData: {},
        teamCapSheet: {
          players: [player],
        },
        currentYear: 2026,
      })
    );

    expect(result.current).toEqual({
      warnings: [
        {
          severity: 'info',
          message: 'Extension validation skipped: rulesProfile not provided',
        },
      ],
      errors: [],
      isValid: true,
      incomplete: true,
    });
  });

  it('preserves extension error and warning assembly with rulesProfile terms', () => {
    const player = createPlayer();
    const { result } = renderHook(() =>
      useCapValidation({
        player,
        action: 'extend',
        contractData: {
          years: 4,
          salaries: [9_000_000],
        },
        teamCapSheet: {
          players: [player],
        },
        currentYear: 2026,
        rulesProfile: {
          extensionEligibility: {
            isEligible: true,
            reason: 'Eligible',
          },
          extensionTerms: {
            minFirstYearSalary: 10_000_000,
            maxFirstYearSalary: 15_000_000,
            maxYears: 3,
            extensionType: 'Veteran Extension',
          },
        },
      })
    );

    expect(result.current.errors).toEqual([
      {
        severity: 'error',
        message: 'Below minimum first year ($10.00M)',
      },
      {
        severity: 'error',
        message: 'Exceeds max years (3 years)',
      },
    ]);
    expect(result.current.warnings).toEqual([
      {
        severity: 'info',
        message: 'Veteran Extension: Max 3yr @ $15.0M',
      },
    ]);
    expect(result.current.isValid).toBe(false);
    expect(result.current.incomplete).toBe(false);
  });

  it('preserves option timing and second-apron warning assembly', () => {
    const capSettings = requireCapSettings(2027);
    const player = createPlayer({
      salariesByYear: [createSalaryRow(2027, capSettings.secondApron + 1_000_000)],
    });
    const { result } = renderHook(() =>
      useCapValidation({
        player,
        action: 'accept',
        contractData: {},
        teamCapSheet: {
          players: [player],
        },
        currentYear: 2026,
        targetYear: 2027,
      })
    );

    expect(result.current.errors).toEqual([]);
    expect(result.current.warnings).toEqual([
      {
        severity: 'warning',
        message: `Team is over Second Apron in 2026-27 (${formatMillions(
          capSettings.secondApron + 1_000_000,
          1
        )} / ${formatMillions(capSettings.secondApron, 1)})`,
      },
    ]);
  });

  it('preserves future option timing blocks', () => {
    const player = createPlayer();
    const { result } = renderHook(() =>
      useCapValidation({
        player,
        action: 'decline',
        contractData: {},
        teamCapSheet: {
          players: [player],
        },
        currentYear: 2026,
        targetYear: 2028,
      })
    );

    expect(result.current.errors).toEqual([
      {
        severity: 'error',
        message:
          'Cannot act on this option yet. It can be decided during the 2026-27 offseason.',
      },
    ]);
  });

  it('preserves signing warning order for RFA, over-cap, hard-cap, and apron messaging', () => {
    const capSettings = requireCapSettings(2026);
    const proposedSalary = capSettings.fullMLE + 5_000_000;
    const teamSalary = capSettings.firstApron - 5_000_000;
    const player = createPlayer({
      birdRights: 'None',
      salariesByYear: [createSalaryRow(2026, teamSalary)],
    });
    const { result } = renderHook(() =>
      useCapValidation({
        player,
        action: 'signNew',
        contractData: {
          base: proposedSalary,
          years: 2,
          salaries: [proposedSalary, Math.floor(proposedSalary * 1.05)],
        },
        teamCapSheet: {
          players: [player],
        },
        currentYear: 2026,
        rulesProfile: {
          minimumSalary: 1_000_000,
          birdRights: {
            type: 'None',
            signingAbilities: {
              maxFirstYearSalary: proposedSalary + 10_000_000,
              raisePercentage: 0.05,
              maxYears: 4,
              canSignToMax: false,
            },
          },
          maxSalary: {
            maxSalary: proposedSalary + 10_000_000,
            maxSalaryBird: proposedSalary + 10_000_000,
          },
          restrictedFreeAgency: {
            isRFA: true,
            qualifyingOfferAmount: 8_000_000,
            reason: 'Qualifying offer required',
          },
        },
      })
    );

    expect(result.current.errors).toEqual([]);
    expect(result.current.warnings).toEqual([
      {
        severity: 'info',
        message: 'Qualifying offer required',
      },
      {
        severity: 'warning',
        message: `Exceeds Full MLE ($${(capSettings.fullMLE / 1000000).toFixed(1)}M) - need exception or Bird Rights`,
      },
      {
        severity: 'warning',
        message: 'This signing may hard-cap the team at First Apron',
      },
      {
        severity: 'warning',
        message: 'Signing puts team over Second Apron - limited flexibility',
      },
    ]);
    expect(result.current.isValid).toBe(true);
  });

  it('preserves waive-stretch warning assembly', () => {
    const player = createPlayer({
      salariesByYear: [
        createSalaryRow(2026, 9_000_000),
        createSalaryRow(2027, 6_000_000),
      ],
    });
    const { result } = renderHook(() =>
      useCapValidation({
        player,
        action: 'waiveStretch',
        contractData: {},
        teamCapSheet: {
          players: [player],
        },
        currentYear: 2026,
      })
    );

    expect(result.current.warnings).toEqual([
      {
        severity: 'info',
        message: 'Dead cap: $15.0M remaining guaranteed',
      },
      {
        severity: 'info',
        message: 'Stretched over ~3 years',
      },
    ]);
    expect(result.current.errors).toEqual([]);
  });

  it('interprets legal SAT preflight warnings synchronously', () => {
    const player = createPlayer();
    const { result } = renderHook(() =>
      useCapValidation({
        player,
        action: 'signAndTrade',
        contractData: {},
        teamCapSheet: {
          players: [player],
        },
        currentYear: 2026,
        signAndTradePreflight: {
          status: 'legal',
          reasons: [],
          warnings: ['Sign-and-trade will hard cap receiving team at First Apron'],
          source: 'authoritative-preflight',
        },
      })
    );

    expect(result.current.warnings).toEqual([
      {
        severity: 'warning',
        message: 'Sign-and-trade will hard cap receiving team at First Apron',
      },
    ]);
    expect(result.current.errors).toEqual([]);
    expect(result.current.isValid).toBe(true);
    expect(result.current.incomplete).toBe(false);
  });

  it('blocks SAT from authoritative blocked preflight reasons instead of local apron guesses', () => {
    const capSettings = requireCapSettings(2026);
    const player = createPlayer({
      salariesByYear: [createSalaryRow(2026, capSettings.firstApron - 10_000_000)],
    });
    const { result } = renderHook(() =>
      useCapValidation({
        player,
        action: 'signAndTrade',
        contractData: {},
        teamCapSheet: {
          players: [player],
        },
        currentYear: 2026,
        signAndTradePreflight: {
          status: 'blocked',
          reasons: ['Receiver would exceed First Apron after sign-and-trade.'],
          warnings: [],
          source: 'authoritative-preflight',
        },
      })
    );

    expect(result.current.warnings).toEqual([]);
    expect(result.current.errors).toEqual([
      {
        severity: 'error',
        message: 'Receiver would exceed First Apron after sign-and-trade.',
      },
    ]);
    expect(result.current.isValid).toBe(false);
    expect(result.current.incomplete).toBe(false);
  });

  it('treats incomplete SAT preflight as non-confirmable without reviving the old local branch', () => {
    const capSettings = requireCapSettings(2026);
    const player = createPlayer({
      salariesByYear: [createSalaryRow(2026, capSettings.firstApron + 1_000_000)],
    });
    const { result } = renderHook(() =>
      useCapValidation({
        player,
        action: 'signAndTrade',
        contractData: {},
        teamCapSheet: {
          players: [player],
        },
        currentYear: 2026,
        signAndTradePreflight: {
          status: 'incomplete',
          reasons: [
            'Cannot validate sign-and-trade hard cap: firstApron not available for season',
          ],
          warnings: [],
          source: 'authoritative-preflight',
        },
      })
    );

    expect(result.current.warnings).toEqual([
      {
        severity: 'warning',
        message:
          'Cannot validate sign-and-trade hard cap: firstApron not available for season',
      },
    ]);
    expect(result.current.errors).toEqual([]);
    expect(result.current.isValid).toBe(true);
    expect(result.current.incomplete).toBe(true);
  });
});
