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

    expect(tradeEditorSource).toContain('const TradeEditor = (');
    expect(tradeEditorSource).toContain('export default TradeEditor;');
    expect(tradeEditorSource).not.toContain('export const TradeEditor');

    expect(tradeTeamCardSource).toContain('const TradeTeamCard = (');
    expect(tradeTeamCardSource).toContain('export default TradeTeamCard;');
    expect(tradeTeamCardSource).not.toContain('export const TradeTeamCard');
  });
});
