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
  const shimExpectations = [
    [
      'tradeMachine/ValidationStateHeader.jsx',
      "export { default, MODE_TAGS, ModeTag } from './ValidationStateHeader.tsx';",
    ],
    [
      'tradeMachine/ValidationDetailsPanel.jsx',
      "export { default } from './ValidationDetailsPanel.tsx';",
    ],
    [
      'tradeMachine/TradeSummaryPanel.jsx',
      "export { default } from './TradeSummaryPanel.tsx';",
    ],
    [
      'tradeMachine/DataWarningsSection.jsx',
      "export { default } from './DataWarningsSection.tsx';",
    ],
    [
      'tradeMachine/TradeLegalChecker.jsx',
      "export { default } from './TradeLegalChecker.tsx';",
    ],
    [
      'tradeMachine/TradeExceptionDashboard.jsx',
      "export { default } from './TradeExceptionDashboard.tsx';",
    ],
    [
      'tradeMachine/FaExceptionTracker.jsx',
      "export { default } from './FaExceptionTracker.tsx';",
    ],
    [
      'tradeMachine/TradeSalaryCalculator.jsx',
      "export { default } from './TradeSalaryCalculator.tsx';",
    ],
    [
      'tradeMachine/TradeReceiptPanel.jsx',
      "export { TradeReceiptPanel } from './TradeReceiptPanel.tsx';",
    ],
  ] as const;

  shimExpectations.forEach(([relativePath, expectedSource]) => {
    it(`${relativePath} remains a pure compatibility shim`, () => {
      const shimPath = path.join(srcRoot, relativePath);
      const source = fs.readFileSync(shimPath, 'utf-8').trim();

      expect(source).toBe(expectedSource);
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

  it('ValidationDetailsPanel explicit .jsx import matches extensionless imports', async () => {
    const explicitJsxModule = await import(
      '../../features/architect/tradeMachine/ValidationDetailsPanel.jsx'
    );

    expect(Object.keys(explicitJsxModule)).toEqual(['default']);
    expect(explicitJsxModule.default).toBe(ValidationDetailsPanel);
  });

  it('TradeSummaryPanel explicit .jsx import matches extensionless imports', async () => {
    const explicitJsxModule = await import(
      '../../features/architect/tradeMachine/TradeSummaryPanel.jsx'
    );

    expect(Object.keys(explicitJsxModule)).toEqual(['default']);
    expect(explicitJsxModule.default).toBe(TradeSummaryPanel);
  });

  it('DataWarningsSection explicit .jsx import matches extensionless imports', async () => {
    const explicitJsxModule = await import(
      '../../features/architect/tradeMachine/DataWarningsSection.jsx'
    );

    expect(Object.keys(explicitJsxModule)).toEqual(['default']);
    expect(explicitJsxModule.default).toBe(DataWarningsSection);
  });

  it('TradeLegalChecker explicit .jsx import matches extensionless imports', async () => {
    const explicitJsxModule = await import(
      '../../features/architect/tradeMachine/TradeLegalChecker.jsx'
    );

    expect(Object.keys(explicitJsxModule)).toEqual(['default']);
    expect(explicitJsxModule.default).toBe(TradeLegalChecker);
  });

  it('TradeExceptionDashboard explicit .jsx import matches extensionless imports', async () => {
    const explicitJsxModule = await import(
      '../../features/architect/tradeMachine/TradeExceptionDashboard.jsx'
    );

    expect(Object.keys(explicitJsxModule)).toEqual(['default']);
    expect(explicitJsxModule.default).toBe(TradeExceptionDashboard);
  });

  it('FaExceptionTracker explicit .jsx import matches extensionless imports', async () => {
    const explicitJsxModule = await import(
      '../../features/architect/tradeMachine/FaExceptionTracker.jsx'
    );

    expect(Object.keys(explicitJsxModule)).toEqual(['default']);
    expect(explicitJsxModule.default).toBe(FaExceptionTracker);
  });

  it('TradeSalaryCalculator explicit .jsx import matches extensionless imports', async () => {
    const explicitJsxModule = await import(
      '../../features/architect/tradeMachine/TradeSalaryCalculator.jsx'
    );

    expect(Object.keys(explicitJsxModule)).toEqual(['default']);
    expect(explicitJsxModule.default).toBe(TradeSalaryCalculator);
  });

  it('TradeReceiptPanel explicit .jsx import preserves the named-only API', async () => {
    const explicitJsxModule = await import(
      '../../features/architect/tradeMachine/TradeReceiptPanel.jsx'
    );

    expect(Object.keys(explicitJsxModule)).toEqual(['TradeReceiptPanel']);
    expect('default' in explicitJsxModule).toBe(false);
    expect(explicitJsxModule.TradeReceiptPanel).toBe(TradeReceiptPanel);
  });
});
