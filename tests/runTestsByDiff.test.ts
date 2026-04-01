import { describe, expect, it } from 'vitest';

import { selectTestPlan } from '../scripts/run-tests-by-diff.mjs';

const AVAILABLE_TEST_FILES = [
  'src/tests/architect/useArchitectActions.freeAgency.test.tsx',
  'src/tests/architect/freeAgency_closure.gate.test.ts',
  'src/tests/architect/offerSheets_closure.gate.test.ts',
  'src/tests/architect/OfferSheetList.freeAgency.test.jsx',
  'src/tests/architect/freeAgentPool.surface.e86.behavior.test.tsx',
  'src/tests/architect/freeAgentPool.offerSheetInitiation.behavior.test.jsx',
  'src/tests/architect/dashboardWorldBoundary.e109.test.tsx',
  'src/tests/architect/capSheet_closure.gate.test.ts',
  'src/tests/architect/architectHardeningE4.polish.test.ts',
  'src/tests/architect/GMDashboard.smoke.test.tsx',
  'src/tests/smoke/architect.uiSmoke.e1.test.tsx',
];

function getPlan(changedFiles: string[]) {
  return selectTestPlan(changedFiles, {
    availableTestFiles: AVAILABLE_TEST_FILES,
  });
}

describe('run-tests-by-diff', () => {
  it('falls back to fast tests for support-file changes only', () => {
    const plan = getPlan([
      'docs/_working/architect/free-agency/ARCHITECT_FREE_AGENCY_ACTION_BREAKDOWN.md',
      'return_packages/architect/ARCHITECT_FREE_AGENCY_7A_7B_EXECUTION_RETURN_PACKAGE.md',
    ]);

    expect(plan.tier).toBe('fast');
    expect(plan.commands).toEqual([{ script: 'test:fast', fileArgs: [] }]);
  });

  it('runs full validation for shared tooling changes', () => {
    const plan = getPlan(['scripts/run-tests-by-diff.mjs']);

    expect(plan.tier).toBe('full');
    expect(plan.commands).toEqual([{ script: 'test:full', fileArgs: [] }]);
  });

  it('keeps explicit cap sheet boundary slices narrow', () => {
    const plan = getPlan([
      'src/shared/components/EditContractModal.tsx',
      'src/tests/architect/capSheet_closure.gate.test.ts',
    ]);

    expect(plan.tier).toBe('capSheetBoundary');
    expect(plan.commands).toEqual([
      {
        script: 'test:node',
        fileArgs: [
          'src/tests/architect/capSheet_closure.gate.test.ts',
          'src/tests/architect/architectHardeningE4.polish.test.ts',
        ],
      },
      {
        script: 'test:ui',
        fileArgs: [
          'src/tests/architect/GMDashboard.smoke.test.tsx',
          'src/tests/architect/dashboardWorldBoundary.e109.test.tsx',
          'src/tests/smoke/architect.uiSmoke.e1.test.tsx',
        ],
      },
    ]);
  });

  it('infers targeted free-agency tests instead of broad architect fallback', () => {
    const plan = getPlan([
      'src/features/architect/GMDashboard/hooks/useArchitectActions.ts',
      'src/features/architect/GMDashboard/sections/FreeAgencySection.tsx',
      'src/features/architect/freeAgency/FreeAgentPool/FreeAgentPool.tsx',
    ]);

    expect(plan.tier).toBe('freeAgencyBoundary');
    expect(plan.commands).toEqual([
      {
        script: 'test:node',
        fileArgs: [
          'src/tests/architect/freeAgency_closure.gate.test.ts',
          'src/tests/architect/offerSheets_closure.gate.test.ts',
        ],
      },
      {
        script: 'test:ui',
        fileArgs: [
          'src/tests/architect/OfferSheetList.freeAgency.test.jsx',
          'src/tests/architect/freeAgentPool.offerSheetInitiation.behavior.test.jsx',
          'src/tests/architect/freeAgentPool.surface.e86.behavior.test.tsx',
          'src/tests/architect/useArchitectActions.freeAgency.test.tsx',
          'src/tests/architect/dashboardWorldBoundary.e109.test.tsx',
        ],
      },
    ]);
  });

  it('falls back to architect when inference is weak', () => {
    const plan = getPlan([
      'src/features/architect/offseason/DraftPickTracker/UnknownSurface.tsx',
    ]);

    expect(plan.tier).toBe('architect');
    expect(plan.commands).toEqual([{ script: 'test:architect', fileArgs: [] }]);
  });
});
