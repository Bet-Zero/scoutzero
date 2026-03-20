/**
 * FILE: src/tests/architect/runtimeBackedUtilsConstantsBatch.e117.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E117 runtime-backed tradeMachine utils/constants shim deletion batch.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: E117 - Added exact deletion-batch absence checks plus representative extensionless/authority parity.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const tradeMachineRoot = path.resolve(
  __dirname,
  '../../features/architect/utils/tradeMachine'
);

const deletedBatchPaths = [
  'constants/cbaConstants.js',
  'constants/secondApronMessages.js',
  'utils/capUtils.js',
  'utils/conveyanceResolution.js',
  'utils/dataValidation.js',
  'utils/matchingValues.js',
  'utils/pickIdUtils.js',
  'utils/salaryMargin.js',
  'utils/salaryMatchingRules.js',
  'utils/salaryUtils.js',
  'utils/seasonUtils.js',
  'utils/stepienEntitlementUtils.js',
  'utils/swapResolution.js',
  'utils/tpeValidation.js',
  'utils/tradeTimingWindows.js',
  'utils/tradeUtilityMisc.js',
  'utils/validationIssueText.js',
] as const;

const capUtilsAuthoritySpecifier =
  '../../features/architect/utils/tradeMachine/utils/capUtils.ts';
const secondApronMessagesAuthoritySpecifier =
  '../../features/architect/utils/tradeMachine/constants/secondApronMessages.ts';
const validationIssueTextAuthoritySpecifier =
  '../../features/architect/utils/tradeMachine/utils/validationIssueText.ts';
const pickIdUtilsAuthoritySpecifier =
  '../../features/architect/utils/tradeMachine/utils/pickIdUtils.ts';

describe('E117 runtime-backed utils/constants deletion batch guardrails', () => {
  it('tracks the exact 17-file deletion batch', () => {
    expect(deletedBatchPaths).toHaveLength(17);
  });

  it('confirms every deleted-batch shim path is absent', () => {
    const existingPaths = deletedBatchPaths.filter((relativePath) =>
      fs.existsSync(path.join(tradeMachineRoot, relativePath))
    );

    expect(existingPaths).toEqual([]);
  });

  it('keeps representative extensionless imports aligned with TS authorities', async () => {
    const capUtils = await import(
      '@/features/architect/utils/tradeMachine/utils/capUtils'
    );
    const capUtilsAuthority = await import(capUtilsAuthoritySpecifier);
    expect(capUtils.toNum).toBe(capUtilsAuthority.toNum);
    expect(capUtils.getTeamApronStatus).toBe(capUtilsAuthority.getTeamApronStatus);
    expect(Object.keys(capUtilsAuthority)).toEqual(
      expect.arrayContaining([
        'getTeamApronStatus',
        'isFirstApronTeam',
        'isSecondApronTeam',
        'normalizeCaps',
        'resolvePayroll',
        'toNum',
      ])
    );

    const secondApronMessages = await import(
      '@/features/architect/utils/tradeMachine/constants/secondApronMessages'
    );
    const secondApronMessagesAuthority = await import(
      secondApronMessagesAuthoritySpecifier
    );
    expect(secondApronMessages.SECOND_APRON_TPE_BLOCKED).toBe(
      secondApronMessagesAuthority.SECOND_APRON_TPE_BLOCKED
    );
    expect(secondApronMessages.SECOND_APRON_HARD_CAP_EXCEEDED).toBe(
      secondApronMessagesAuthority.SECOND_APRON_HARD_CAP_EXCEEDED
    );
    expect(Object.keys(secondApronMessagesAuthority)).toEqual(
      expect.arrayContaining([
        'SECOND_APRON_AGGREGATION_UP_BLOCKED',
        'SECOND_APRON_CASH_BLOCKED',
        'SECOND_APRON_HARD_CAP_EXCEEDED',
        'SECOND_APRON_PRIOR_YEAR_TPE_BLOCKED',
        'SECOND_APRON_SALARY_MISMATCH',
        'SECOND_APRON_TPE_BLOCKED',
      ])
    );

    const validationIssueText = await import(
      '@/features/architect/utils/tradeMachine/utils/validationIssueText'
    );
    const validationIssueTextAuthority = await import(
      validationIssueTextAuthoritySpecifier
    );
    expect(validationIssueText.createValidationIssue).toBe(
      validationIssueTextAuthority.createValidationIssue
    );
    expect(validationIssueText.getValidationIssueText).toBe(
      validationIssueTextAuthority.getValidationIssueText
    );
    expect(validationIssueText.summarizeValidationIssues).toBe(
      validationIssueTextAuthority.summarizeValidationIssues
    );

    const pickIdUtils = await import(
      '@/features/architect/utils/tradeMachine/utils/pickIdUtils'
    );
    const pickIdUtilsAuthority = await import(pickIdUtilsAuthoritySpecifier);
    expect(pickIdUtils.generatePickId).toBe(pickIdUtilsAuthority.generatePickId);
    expect(pickIdUtils.ensurePickId).toBe(pickIdUtilsAuthority.ensurePickId);
    expect(pickIdUtils.areSamePickById).toBe(
      pickIdUtilsAuthority.areSamePickById
    );
  });
});
