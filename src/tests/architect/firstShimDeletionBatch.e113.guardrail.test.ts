/**
 * FILE: src/tests/architect/firstShimDeletionBatch.e113.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the E113 first same-path shim deletion batch.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-15: E113 - Added exact deletion-batch absence checks plus representative authority checks.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const featureRoot = path.resolve(__dirname, '../../features/architect');

const deletedBatchPaths = [
  'GMDashboard/components/OfferSheetList.jsx',
  'GMDashboard/sections/CapSheetSection.jsx',
  'GMDashboard/sections/CapTableSection.jsx',
  'GMDashboard/sections/FreeAgencySection.jsx',
  'GMDashboard/sections/HistorySection.jsx',
  'GMDashboard/sections/RosterSection.jsx',
  'GMDashboard/sections/TradeSection.jsx',
  'tradeMachine/DataWarningsSection.jsx',
  'tradeMachine/FaExceptionTracker.jsx',
  'tradeMachine/TradeEditor.jsx',
  'tradeMachine/TradeExceptionDashboard.jsx',
  'tradeMachine/TradeExportCapture.jsx',
  'tradeMachine/TradeLegalChecker.jsx',
  'tradeMachine/TradePreviewModal.jsx',
  'tradeMachine/TradeReceiptPanel.jsx',
  'tradeMachine/TradeSalaryCalculator.jsx',
  'tradeMachine/TradeSummaryPanel.jsx',
  'tradeMachine/TradeTeamCard.jsx',
  'tradeMachine/ValidationDetailsPanel.jsx',
  'tradeMachine/utils/computeTradeDraftKey.js',
  'tradeMachine/utils/devSntInjector.js',
  'tradeMachine/utils/entitlementWarnings.js',
  'tradeMachine/utils/getOfficialSalaryMatchingSnapshot.js',
  'utils/architectCore.js',
  'utils/capHoldTransitionHelpers.js',
  'utils/contractNormalization.js',
  'utils/contractSalaryUtils.js',
  'utils/entitlements/formatEntitlement.js',
  'utils/entitlements/seasonManagerProjection.js',
  'utils/exceptionHistory/historyHelpers.js',
  'utils/firebaseTeamPlanHelpers.js',
  'utils/runOffseason.js',
  'utils/salaryUtils.js',
  'utils/schemaAdapter.js',
  'utils/teamLoader.js',
  'utils/tradeContext/assertions.js',
  'utils/tradeMachine/utils/tradeExportUtils.js',
  'utils/tradeManager.js',
  'utils/worldManager.js',
] as const;

const representativeAuthorities = [
  'GMDashboard/sections/CapSheetSection.tsx',
  'tradeMachine/TradeEditor.tsx',
  'tradeMachine/utils/computeTradeDraftKey.ts',
  'utils/worldManager.ts',
  'utils/exceptionHistory/historyHelpers.ts',
  'utils/entitlements/formatEntitlement.ts',
] as const;

describe('E113 first shim deletion batch guardrails', () => {
  it('tracks the exact 39-file deletion batch', () => {
    expect(deletedBatchPaths).toHaveLength(39);
  });

  it('confirms every deleted-batch shim path is absent', () => {
    const existingPaths = deletedBatchPaths.filter((relativePath) =>
      fs.existsSync(path.join(featureRoot, relativePath))
    );

    expect(existingPaths).toEqual([]);
  });

  it('keeps representative authority files in place', () => {
    const missingAuthorities = representativeAuthorities.filter(
      (relativePath) => !fs.existsSync(path.join(featureRoot, relativePath))
    );

    expect(missingAuthorities).toEqual([]);
  });
});
