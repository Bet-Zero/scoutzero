import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import ValidationStateHeader, * as ValidationStateHeaderModule from '@/features/architect/tradeMachine/ValidationStateHeader';
import ValidationDetailsPanel from '@/features/architect/tradeMachine/ValidationDetailsPanel';
import TradeSummaryPanel from '@/features/architect/tradeMachine/TradeSummaryPanel';
import DataWarningsSection from '@/features/architect/tradeMachine/DataWarningsSection';
import TradeLegalChecker from '@/features/architect/tradeMachine/TradeLegalChecker';
import TradeExceptionDashboard from '@/features/architect/tradeMachine/TradeExceptionDashboard';
import FaExceptionTracker from '@/features/architect/tradeMachine/FaExceptionTracker';
import TradeSalaryCalculator from '@/features/architect/tradeMachine/TradeSalaryCalculator';
import { TradeReceiptPanel } from '@/features/architect/tradeMachine/TradeReceiptPanel';

describe('E97 Trade Machine validation presentation compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const retainedShimExpectations = [
    [
      'tradeMachine/ValidationStateHeader.jsx',
      "export { default, MODE_TAGS, ModeTag } from './ValidationStateHeader.tsx';",
    ],
  ] as const;
  const deletedBatchCases = [
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

  retainedShimExpectations.forEach(([relativePath, expectedSource]) => {
    it(`${relativePath} remains a pure compatibility shim`, () => {
      const shimPath = path.join(srcRoot, relativePath);
      const source = fs.readFileSync(shimPath, 'utf-8').trim();

      expect(source).toBe(expectedSource);
    });
  });

  deletedBatchCases.forEach(([relativePath]) => {
    it(`${relativePath} is absent after the E113 shim deletion batch`, () => {
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

  it('ValidationStateHeader explicit .jsx import matches extensionless imports', async () => {
    const explicitJsxModule = await import(
      '../../features/architect/tradeMachine/ValidationStateHeader.jsx'
    );

    expect(Object.keys(explicitJsxModule).sort()).toEqual([
      'MODE_TAGS',
      'ModeTag',
      'default',
    ]);
    expect(explicitJsxModule.default).toBe(ValidationStateHeader);
    expect(explicitJsxModule.MODE_TAGS).toBe(ValidationStateHeaderModule.MODE_TAGS);
    expect(explicitJsxModule.ModeTag).toBe(ValidationStateHeaderModule.ModeTag);
  });
});
