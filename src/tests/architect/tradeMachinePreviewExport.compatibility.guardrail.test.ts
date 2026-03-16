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
  const deletedBatchCases = [
    [
      'tradeMachine/TradePreviewModal.jsx',
      'tradeMachine/TradePreviewModal.tsx',
      'export default TradePreviewModal;',
      TradePreviewModal,
    ],
    [
      'tradeMachine/TradeExportCapture.jsx',
      'tradeMachine/TradeExportCapture.tsx',
      'export default TradeExportCapture;',
      TradeExportCapture,
    ],
  ] as const;

  deletedBatchCases.forEach(([relativePath]) => {
    it(`${relativePath} is absent after the E113 shim deletion batch`, () => {
      const deletedPath = path.join(srcRoot, relativePath);
      expect(fs.existsSync(deletedPath)).toBe(false);
    });
  });

  deletedBatchCases.forEach(
    ([, authorityPath, expectedExportSnippet, importedValue]) => {
      it(`${authorityPath} remains the surviving authority export`, () => {
        const authoritySource = fs.readFileSync(
          path.join(srcRoot, authorityPath),
          'utf-8'
        );

        expect(authoritySource).toContain(expectedExportSnippet);
        expect(importedValue).toBeDefined();
      });
    }
  );
});
