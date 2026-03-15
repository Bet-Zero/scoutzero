// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import TradeEditor from '@/features/architect/tradeMachine/TradeEditor';
import TradeTeamCard from '@/features/architect/tradeMachine/TradeTeamCard';

describe('E105 TradeEditor + TradeTeamCard compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect/tradeMachine');
  const readAuthoritySource = (relativePath: string) =>
    fs.readFileSync(path.join(srcRoot, relativePath), 'utf-8');
  const shimExpectations = [
    ['TradeEditor.jsx', "export { default } from './TradeEditor.tsx';"],
    ['TradeTeamCard.jsx', "export { default } from './TradeTeamCard.tsx';"],
  ] as const;

  shimExpectations.forEach(([relativePath, expectedSource]) => {
    it(`${relativePath} remains a pure compatibility shim`, () => {
      const shimPath = path.join(srcRoot, relativePath);
      const source = fs.readFileSync(shimPath, 'utf-8').trim();

      expect(source).toBe(expectedSource);
    });
  });

  it('TradeEditor explicit .jsx import matches extensionless default import', async () => {
    const explicitJsxModule = await import(
      '../../features/architect/tradeMachine/TradeEditor.jsx'
    );

    expect(Object.keys(explicitJsxModule)).toEqual(['default']);
    expect('default' in explicitJsxModule).toBe(true);
    expect(explicitJsxModule.default).toBe(TradeEditor);
  });

  it('TradeTeamCard explicit .jsx import matches extensionless default import', async () => {
    const explicitJsxModule = await import(
      '../../features/architect/tradeMachine/TradeTeamCard.jsx'
    );

    expect(Object.keys(explicitJsxModule)).toEqual(['default']);
    expect('default' in explicitJsxModule).toBe(true);
    expect(explicitJsxModule.default).toBe(TradeTeamCard);
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
