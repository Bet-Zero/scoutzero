/**
 * FILE: src/tests/architect/supportBarrelBatch.e130.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E130 support-barrel retirement batch.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: E130 - Retired support-layer index.js wrappers in favor of TS barrel authorities.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const architectUtilsRoot = path.resolve(__dirname, '../../features/architect/utils');

const deletedBatchPaths = [
  'capTotals/index.js',
  'persistenceContracts/index.js',
  'exceptions/index.js',
  'playerRulesProfile/index.js',
  'playerRulesProfile/index.d.ts',
  'tradeContext/index.js',
] as const;

describe('E130 support-barrel retirement batch guardrails', () => {
  it('tracks the exact 6-file deletion batch', () => {
    expect(deletedBatchPaths).toHaveLength(6);
  });

  it('confirms every deleted support-barrel wrapper path is absent', () => {
    const existingPaths = deletedBatchPaths.filter((relativePath) =>
      fs.existsSync(path.join(architectUtilsRoot, relativePath))
    );

    expect(existingPaths).toEqual([]);
  });

  it('keeps capTotals extensionless barrel exports aligned with computeTeamCapTotals.ts', async () => {
    const barrel = await import('@/features/architect/utils/capTotals');
    const authoritySpecifier =
      '../../features/architect/utils/capTotals/computeTeamCapTotals.ts';
    const authority = await import(authoritySpecifier);

    expect(barrel.computeTeamCapTotals).toBe(authority.computeTeamCapTotals);
    expect(barrel.warnOnTotalsDivergence).toBe(authority.warnOnTotalsDivergence);
    expect(barrel.resetWarnedKeys).toBe(authority.resetWarnedKeys);
    expect(barrel.canUseRoomException).toBe(authority.canUseRoomException);
    expect(barrel.default).toBe(authority.default);
  });

  it('keeps persistenceContracts extensionless barrel exports aligned with their authorities', async () => {
    const barrel = await import('@/features/architect/utils/persistenceContracts');
    const contractsSpecifier =
      '../../features/architect/utils/persistenceContracts/contracts.ts';
    const validationSpecifier =
      '../../features/architect/utils/persistenceContracts/validatePersistableShape.ts';
    const enforcementSpecifier =
      '../../features/architect/utils/persistenceContracts/enforcement.ts';
    const normalizeSpecifier =
      '../../features/architect/utils/persistenceContracts/normalizeTeamTpe.ts';
    const contracts = await import(contractsSpecifier);
    const validation = await import(validationSpecifier);
    const enforcement = await import(enforcementSpecifier);
    const normalize = await import(normalizeSpecifier);

    expect(barrel.PERSISTENCE_CONTRACTS).toBe(contracts.PERSISTENCE_CONTRACTS);
    expect(barrel.TEAM_DEEP_RULES).toBe(contracts.TEAM_DEEP_RULES);
    expect(barrel.validatePersistableShape).toBe(
      validation.validatePersistableShape
    );
    expect(barrel.formatViolationMessage).toBe(validation.formatViolationMessage);
    expect(barrel.assertPersistableOrThrow).toBe(
      enforcement.assertPersistableOrThrow
    );
    expect(barrel.checkPersistableContract).toBe(
      enforcement.checkPersistableContract
    );
    expect(barrel.normalizeTeamTpeSchema).toBe(normalize.normalizeTeamTpeSchema);
    expect(barrel.getTeamTpeList).toBe(normalize.getTeamTpeList);
  });

  it('keeps exceptions extensionless barrel exports aligned with exceptionLifecycle.ts', async () => {
    const barrel = await import('@/features/architect/utils/exceptions');
    const authoritySpecifier =
      '../../features/architect/utils/exceptions/exceptionLifecycle.ts';
    const authority = await import(authoritySpecifier);

    expect(barrel.resetTeamNonTpeExceptionsForNewSeason).toBe(
      authority.resetTeamNonTpeExceptionsForNewSeason
    );
    expect(barrel.validateNonTpeExceptionsForYear).toBe(
      authority.validateNonTpeExceptionsForYear
    );
    expect(barrel.NON_TPE_EXCEPTION_TYPES).toBe(authority.NON_TPE_EXCEPTION_TYPES);
  });

  it('keeps playerRulesProfile extensionless barrel exports aligned with their authorities', async () => {
    const barrel = await import('@/features/architect/utils/playerRulesProfile');
    const computeProfileSpecifier =
      '../../features/architect/utils/playerRulesProfile/computeProfile.ts';
    const extensionRulesSpecifier =
      '../../features/architect/utils/playerRulesProfile/extensionRules.ts';
    const birdRightsRulesSpecifier =
      '../../features/architect/utils/playerRulesProfile/birdRightsRules.ts';
    const minimumSalaryRulesSpecifier =
      '../../features/architect/utils/playerRulesProfile/minimumSalaryRules.ts';
    const rfaRulesSpecifier =
      '../../features/architect/utils/playerRulesProfile/rfaRules.ts';
    const maxSalaryRulesSpecifier =
      '../../features/architect/utils/playerRulesProfile/maxSalaryRules.ts';
    const computeProfile = await import(computeProfileSpecifier);
    const extensionRules = await import(extensionRulesSpecifier);
    const birdRightsRules = await import(birdRightsRulesSpecifier);
    const minimumSalaryRules = await import(minimumSalaryRulesSpecifier);
    const rfaRules = await import(rfaRulesSpecifier);
    const maxSalaryRules = await import(maxSalaryRulesSpecifier);

    expect(barrel.computePlayerRulesProfile).toBe(
      computeProfile.computePlayerRulesProfile
    );
    expect(barrel.computeExtensionEligibility).toBe(
      extensionRules.computeExtensionEligibility
    );
    expect(barrel.computeBirdRights).toBe(birdRightsRules.computeBirdRights);
    expect(barrel.computeMinimumSalary).toBe(
      minimumSalaryRules.computeMinimumSalary
    );
    expect(barrel.computeRFAStatus).toBe(rfaRules.computeRFAStatus);
    expect(barrel.computeMaxSalary).toBe(maxSalaryRules.computeMaxSalary);
  });

  it('keeps tradeContext extensionless barrel exports aligned with their authorities', async () => {
    const barrel = await import('@/features/architect/utils/tradeContext');
    const tradeContextSpecifier =
      '../../features/architect/utils/tradeContext/tradeContext.ts';
    const assertionsSpecifier =
      '../../features/architect/utils/tradeContext/assertions.ts';
    const legacySpecifier =
      '../../features/architect/utils/tradeContext/legacy/index.ts';
    const tradeContext = await import(tradeContextSpecifier);
    const assertions = await import(assertionsSpecifier);
    const legacy = await import(legacySpecifier);

    expect(barrel.buildPostTradeTeamsSnapshot).toBe(
      tradeContext.buildPostTradeTeamsSnapshot
    );
    expect(barrel.validatePostTradeSnapshotForContext).toBe(
      tradeContext.validatePostTradeSnapshotForContext
    );
    expect(barrel.assertPostTradeSnapshot).toBe(assertions.assertPostTradeSnapshot);
    expect(barrel.assertValidatedTradeContext).toBe(
      assertions.assertValidatedTradeContext
    );
    expect(barrel.assertTradeComputeInputs).toBe(
      assertions.assertTradeComputeInputs
    );
    expect(barrel.legacy_validateTradeForContext).toBe(
      legacy.legacy_validateTradeForContext
    );
    expect(barrel.validateTradeForContext).toBe(legacy.validateTradeForContext);
  });
});
