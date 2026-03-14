// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import TradePreviewModal from '@/features/architect/tradeMachine/TradePreviewModal';
import TradeExportCapture from '@/features/architect/tradeMachine/TradeExportCapture';

vi.mock('@/shared/hooks/useImageDownload', () => ({
  default: () => vi.fn(),
}));

describe('E99 Trade Machine preview/export compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const shimExpectations = [
    [
      'tradeMachine/TradePreviewModal.jsx',
      "export { default } from './TradePreviewModal.tsx';",
    ],
    [
      'tradeMachine/TradeExportCapture.jsx',
      "export { default } from './TradeExportCapture.tsx';",
    ],
  ] as const;

  shimExpectations.forEach(([relativePath, expectedSource]) => {
    it(`${relativePath} remains a pure compatibility shim`, () => {
      const shimPath = path.join(srcRoot, relativePath);
      const source = fs.readFileSync(shimPath, 'utf-8').trim();

      expect(source).toBe(expectedSource);
    });
  });

  it('TradePreviewModal explicit .jsx import matches extensionless imports', async () => {
    const explicitJsxModule = await import(
      '../../features/architect/tradeMachine/TradePreviewModal.jsx'
    );

    expect(Object.keys(explicitJsxModule)).toEqual(['default']);
    expect('default' in explicitJsxModule).toBe(true);
    expect(explicitJsxModule.default).toBe(TradePreviewModal);
  });

  it('TradeExportCapture explicit .jsx import matches extensionless imports', async () => {
    const explicitJsxModule = await import(
      '../../features/architect/tradeMachine/TradeExportCapture.jsx'
    );

    expect(Object.keys(explicitJsxModule)).toEqual(['default']);
    expect('default' in explicitJsxModule).toBe(true);
    expect(explicitJsxModule.default).toBe(TradeExportCapture);
  });
});
