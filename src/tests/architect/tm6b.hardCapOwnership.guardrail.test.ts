import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { validatePostStateCapLegality } from '@/features/architect/utils/capLegality/postStateCapValidator';
import { validateHardCap } from '@/features/architect/utils/tradeMachine/rules/hardCapValidation';
import {
  HARD_CAP_TYPES,
  resolveHardCapCeiling,
} from '@/features/architect/utils/tradeMachine/utils/hardCapStatus';

const repoRoot = process.cwd();

function readRepoFile(relativePath: string) {
  return fs.readFileSync(path.resolve(repoRoot, relativePath), 'utf8');
}

function makeTotals(overrides: Record<string, unknown> = {}) {
  return {
    yearKey: 2026,
    playersTotal: 120_000_000,
    deadMoneyTotal: 5_000_000,
    capHoldsTotal: 2_000_000,
    incompleteChargesTotal: 1_000_000,
    totalCapAllocations: 128_000_000,
    salaryCap: 140_000_000,
    luxuryTax: 170_000_000,
    firstApron: 180_000_000,
    secondApron: 190_000_000,
    ...overrides,
  };
}

function makePostStateInput(overrides: Record<string, unknown> = {}) {
  return {
    operationId: 'op_tm6b_guardrail',
    mutationType: 'executeTrade',
    worldId: 'world_tm6b_guardrail',
    year: 2026,
    beforeTeamsByCode: {
      BOS: { teamCode: 'BOS' },
    },
    afterTeamsByCode: {
      BOS: { teamCode: 'BOS' },
    },
    beforeTotalsByTeam: {
      BOS: makeTotals(),
    },
    afterTotalsByTeam: {
      BOS: makeTotals(),
    },
    rulesContext: {
      capSettings: {
        firstApron: 180_000_000,
        secondApron: 190_000_000,
      },
      minimumTeamSalary: 120_000_000,
    },
    ...overrides,
  };
}

describe('TM-6B hard-cap ownership guardrails', () => {
  it('keeps projection-time and final-state hard-cap seams explicit in source', () => {
    const projectionSource = readRepoFile(
      'src/features/architect/utils/tradeMachine/rules/hardCapValidation.ts'
    );
    const statusSource = readRepoFile(
      'src/features/architect/utils/tradeMachine/utils/hardCapStatus.ts'
    );
    const postStateSource = readRepoFile(
      'src/features/architect/utils/capLegality/postStateCapValidator.ts'
    );

    expect(projectionSource).toContain('Canonical projected hard-cap legality owner.');
    expect(projectionSource).toContain('hardCapStatus.hardCapCeiling');
    expect(statusSource).toContain(
      'resolveHardCapCeiling() owns the shared hard-cap ceiling/fallback policy'
    );
    expect(postStateSource).toContain('function getFinalStateHardCapRecheckStatus');
    expect(postStateSource).toContain('function runFinalStateHardCapRecheck');
    expect(postStateSource).toContain(
      'Earlier projected legality remains owned by hardCapValidation.ts'
    );
  });

  it('keeps projection-time and final-state fallback ceilings aligned through the shared resolver', () => {
    const sharedCeiling = resolveHardCapCeiling(HARD_CAP_TYPES.SECOND_APRON, {
      firstApron: 180_000_000,
      secondApron: 0,
    });

    expect(sharedCeiling.hardCapCeiling).toBe(180_000_000);
    expect(sharedCeiling.hardCapCeilingLabel).toBe('1st Apron (fallback)');

    const projectionTeam = {
      team: {
        totalSalary: 179_000_000,
        hardCapLevel: 'secondApron',
      },
      projectedSalary: 181_000_000,
    } as Parameters<typeof validateHardCap>[0];

    const projectionResult = validateHardCap(
      projectionTeam,
      {
        capSettings: {
          firstApron: 180_000_000,
          secondApron: 0,
        },
      }
    );

    expect(projectionResult.hardCapStatus?.hardCapCeiling).toBe(
      sharedCeiling.hardCapCeiling
    );
    expect(String(projectionResult.violations[0])).toContain('1st Apron (fallback)');

    const finalStateResult = validatePostStateCapLegality(
      makePostStateInput({
        afterTeamsByCode: {
          BOS: {
            teamCode: 'BOS',
            hardCapLevel: 'secondApron',
            hardCapped: true,
          },
        },
        afterTotalsByTeam: {
          BOS: makeTotals({
            totalCapAllocations: 181_000_000,
            firstApron: 180_000_000,
            secondApron: 0,
          }),
        },
        rulesContext: {
          capSettings: {
            firstApron: 180_000_000,
            secondApron: 0,
          },
          minimumTeamSalary: 120_000_000,
        },
      })
    );

    const hardCapViolation = finalStateResult.violations.find(
      (issue) => issue.code === 'HARD_CAP_EXCEEDED'
    );
    expect(hardCapViolation?.expected).toBe(sharedCeiling.hardCapCeiling);
    expect(hardCapViolation?.actual).toBe(181_000_000);
  });
});
