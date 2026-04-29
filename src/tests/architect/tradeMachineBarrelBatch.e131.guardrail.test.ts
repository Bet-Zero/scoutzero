/**
 * FILE: src/tests/architect/tradeMachineBarrelBatch.e131.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E131 Trade Machine barrel retirement batch.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: E131 - Retired Trade Machine index.js barrel wrappers in favor of TS authorities.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const tradeMachineRoot = path.resolve(
  __dirname,
  '../../features/architect/utils/tradeMachine'
);

const deletedBatchPaths = [
  'index.js',
  'rules/index.js',
  'utils/index.js',
  'validators/index.js',
  'engine/index.js',
  'cache/index.js',
] as const;

describe('E131 Trade Machine barrel retirement batch guardrails', () => {
  it('tracks the exact 6-file deletion batch', () => {
    expect(deletedBatchPaths).toHaveLength(6);
  });

  it('confirms every deleted Trade Machine barrel path is absent', () => {
    const existingPaths = deletedBatchPaths.filter((relativePath) =>
      fs.existsSync(path.join(tradeMachineRoot, relativePath))
    );

    expect(existingPaths).toEqual([]);
  });

  it('keeps the extensionless Trade Machine public barrel narrowed to the canonical validator authority', async () => {
    const tradeMachine = await import('@/features/architect/utils/tradeMachine');
    const tradeValidatorSpecifier = '../../features/architect/utils/tradeMachine/engine/tradeValidator.ts';
    const tradeValidator = await import(tradeValidatorSpecifier);

    expect(Object.keys(tradeMachine)).toEqual(['validateTrade']);
    expect(tradeMachine.validateTrade).toBe(tradeValidator.validateTrade);
  });

  it('keeps the extensionless rules barrel aligned with direct rule authorities', async () => {
    const rules = await import('@/features/architect/utils/tradeMachine/rules');
    const validateSalaryMatchingSpecifier =
      '../../features/architect/utils/tradeMachine/rules/validateSalaryMatching.ts';
    const validateRosterSpecifier =
      '../../features/architect/utils/tradeMachine/rules/validateRoster.ts';
    const validateCashSpecifier =
      '../../features/architect/utils/tradeMachine/rules/validateCash.ts';
    const validateReacquisitionSpecifier =
      '../../features/architect/utils/tradeMachine/rules/validateReacquisition.ts';
    const validateSalaryMatching = await import(validateSalaryMatchingSpecifier);
    const validateRoster = await import(validateRosterSpecifier);
    const validateCash = await import(validateCashSpecifier);
    const validateReacquisition = await import(validateReacquisitionSpecifier);

    expect(rules.validateSalaryMatching).toBe(
      validateSalaryMatching.validateSalaryMatching
    );
    expect(rules.validateRoster).toBe(validateRoster.validateRoster);
    expect(rules.enforceRosterWindow).toBe(validateRoster.enforceRosterWindow);
    expect(rules.validateCash).toBe(validateCash.validateCash);
    expect(rules.validateReacquisition).toBe(
      validateReacquisition.validateReacquisition
    );
  });

  it('keeps the extensionless utils barrel aligned with direct utility authorities', async () => {
    const utils: typeof import('@/features/architect/utils/tradeMachine/utils') =
      await import('@/features/architect/utils/tradeMachine/utils');
    const normalizeTradeInputSpecifier =
      '../../features/architect/utils/tradeMachine/utils/normalizeTradeInput.ts';
    const validateInputSpecifier =
      '../../features/architect/utils/tradeMachine/utils/validateInput.ts';
    const salaryMarginSpecifier =
      '../../features/architect/utils/tradeMachine/utils/salaryMargin.ts';
    const tpeValidationSpecifier =
      '../../features/architect/utils/tradeMachine/utils/tpeValidation.ts';
    const tradeUtilityMiscSpecifier =
      '../../features/architect/utils/tradeMachine/utils/tradeUtilityMisc.ts';
    const normalizeTradeInput = await import(normalizeTradeInputSpecifier);
    const validateInput = await import(validateInputSpecifier);
    const salaryMargin = await import(salaryMarginSpecifier);
    const tpeValidation = await import(tpeValidationSpecifier);
    const tradeUtilityMisc = await import(tradeUtilityMiscSpecifier);

    expect(utils.normalizeTradeInput).toBe(normalizeTradeInput.normalizeTradeInput);
    expect(utils.validateTradeInput).toBe(validateInput.validateTradeInput);
    expect(utils.getIncomingCeilingForTeam).toBe(
      salaryMargin.getIncomingCeilingForTeam
    );
    expect(utils.createTPE).toBe(tpeValidation.createTPE);
    expect(utils.isMeaningfulProtection).toBe(
      tradeUtilityMisc.isMeaningfulProtection
    );
  });

  it('keeps the extensionless engine and cache barrels aligned with their direct authorities', async () => {
    const engine = await import('@/features/architect/utils/tradeMachine/engine');
    const cache = await import('@/features/architect/utils/tradeMachine/cache');
    const tradeValidatorSpecifier =
      '../../features/architect/utils/tradeMachine/engine/tradeValidator.ts';
    const engineUtilsSpecifier =
      '../../features/architect/utils/tradeMachine/engine/engineUtils.ts';
    const validationCacheSpecifier =
      '../../features/architect/utils/tradeMachine/cache/validationCache.ts';
    const cacheInvalidationSpecifier =
      '../../features/architect/utils/tradeMachine/cache/cacheInvalidationManager.ts';
    const tradeValidator = await import(tradeValidatorSpecifier);
    const engineUtils = await import(engineUtilsSpecifier);
    const validationCache = await import(validationCacheSpecifier);
    const cacheInvalidation = await import(cacheInvalidationSpecifier);

    expect(engine.validateTrade).toBe(tradeValidator.validateTrade);
    expect(engine.debug).toBe(engineUtils.debug);
    expect(cache.validationCache).toBe(validationCache.validationCache);
    expect(cache.cacheInvalidationManager).toBe(
      cacheInvalidation.cacheInvalidationManager
    );
  });
});
