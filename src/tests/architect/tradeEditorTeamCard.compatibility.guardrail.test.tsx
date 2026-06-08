// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TradeEditor } from '@/features/architect/tradeMachine/TradeEditor';
import { TradeTeamCard } from '@/features/architect/tradeMachine/TradeTeamCard';

describe('E105 TradeEditor + TradeTeamCard compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect/tradeMachine');
  const readAuthoritySource = (relativePath: string) =>
    fs.readFileSync(path.join(srcRoot, relativePath), 'utf-8');
  const deletedShimPaths = [
    'TradeEditor.jsx',
    'TradeTeamCard.jsx',
  ] as const;

  deletedShimPaths.forEach((relativePath) => {
    it(`${relativePath} is absent after the E113 shim deletion batch`, () => {
      const deletedPath = path.join(srcRoot, relativePath);
      expect(fs.existsSync(deletedPath)).toBe(false);
    });
  });

  it('extensionless default imports still resolve the deleted-batch authorities', () => {
    expect(TradeEditor).toBeDefined();
    expect(TradeTeamCard).toBeDefined();
  });

  it('TSX authorities preserve the expected default-only export shape', () => {
    const tradeEditorSource = readAuthoritySource('TradeEditor.tsx');
    const tradeTeamCardSource = readAuthoritySource('TradeTeamCard.tsx');

    // Post default->named export conversion (10f5fed7): these authorities now
    // use named exports instead of a trailing `export default`.
    expect(tradeEditorSource).toContain('export const TradeEditor = (');
    expect(tradeEditorSource).not.toContain('export default TradeEditor;');

    expect(tradeTeamCardSource).toContain('export const TradeTeamCard = (');
    expect(tradeTeamCardSource).not.toContain('export default TradeTeamCard;');
  });
});
