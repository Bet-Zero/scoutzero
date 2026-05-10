import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ValidationStateHeader } from '@/features/architect/tradeMachine/ValidationStateHeader';
import * as ValidationStateHeaderModule from '@/features/architect/tradeMachine/ValidationStateHeader';
import { ValidationDetailsPanel } from '@/features/architect/tradeMachine/ValidationDetailsPanel';
import { TradeSummaryPanel } from '@/features/architect/tradeMachine/TradeSummaryPanel';
import { DataWarningsSection } from '@/features/architect/tradeMachine/DataWarningsSection';
import { TradeLegalChecker } from '@/features/architect/tradeMachine/TradeLegalChecker';
import { TradeExceptionDashboard } from '@/features/architect/tradeMachine/TradeExceptionDashboard';
import { FaExceptionTracker } from '@/features/architect/tradeMachine/FaExceptionTracker';
import { TradeSalaryCalculator } from '@/features/architect/tradeMachine/TradeSalaryCalculator';
import { TradeReceiptPanel } from '@/features/architect/tradeMachine/TradeReceiptPanel';

describe('E97 Trade Machine validation presentation compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const validationStateHeaderAuthoritySpecifier =
    '../../features/architect/tradeMachine/ValidationStateHeader.tsx';
  const deletedBatchCases = [
    [
      'tradeMachine/ValidationStateHeader.jsx',
      'tradeMachine/ValidationStateHeader.tsx',
      ValidationStateHeader,
    ],
    [
      'tradeMachine/ValidationDetailsPanel.jsx',
      'tradeMachine/ValidationDetailsPanel.tsx',
      ValidationDetailsPanel,
    ],
    [
      'tradeMachine/TradeSummaryPanel.jsx',
      'tradeMachine/TradeSummaryPanel.tsx',
      TradeSummaryPanel,
    ],
    [
      'tradeMachine/DataWarningsSection.jsx',
      'tradeMachine/DataWarningsSection.tsx',
      DataWarningsSection,
    ],
    [
      'tradeMachine/TradeLegalChecker.jsx',
      'tradeMachine/TradeLegalChecker.tsx',
      TradeLegalChecker,
    ],
    [
      'tradeMachine/TradeExceptionDashboard.jsx',
      'tradeMachine/TradeExceptionDashboard.tsx',
      TradeExceptionDashboard,
    ],
    [
      'tradeMachine/FaExceptionTracker.jsx',
      'tradeMachine/FaExceptionTracker.tsx',
      FaExceptionTracker,
    ],
    [
      'tradeMachine/TradeSalaryCalculator.jsx',
      'tradeMachine/TradeSalaryCalculator.tsx',
      TradeSalaryCalculator,
    ],
    [
      'tradeMachine/TradeReceiptPanel.jsx',
      'tradeMachine/TradeReceiptPanel.tsx',
      TradeReceiptPanel,
    ],
  ] as const;

  deletedBatchCases.forEach(([relativePath]) => {
    it(`${relativePath} is absent after the shim retirement batches`, () => {
      const deletedPath = path.join(srcRoot, relativePath);
      expect(fs.existsSync(deletedPath)).toBe(false);
    });
  });

  deletedBatchCases.forEach(([, authorityPath, importedValue]) => {
    it(`${authorityPath} remains the surviving authority export`, () => {
      const authoritySource = fs.readFileSync(
        path.join(srcRoot, authorityPath),
        'utf-8'
      );

      expect(authoritySource.length).toBeGreaterThan(0);
      expect(importedValue).toBeDefined();
    });
  });

  it('ValidationStateHeader extensionless import matches the TSX authority', async () => {
    const authorityModule = await import(validationStateHeaderAuthoritySpecifier);

    expect(Object.keys(authorityModule).sort()).toEqual([
      'MODE_TAGS',
      'ModeTag',
      'default',
    ]);
    expect(authorityModule.default).toBe(ValidationStateHeader);
    expect(authorityModule.MODE_TAGS).toBe(ValidationStateHeaderModule.MODE_TAGS);
    expect(authorityModule.ModeTag).toBe(ValidationStateHeaderModule.ModeTag);
  });
});
