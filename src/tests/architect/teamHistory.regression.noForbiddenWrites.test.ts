import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ACTIONS_PATH =
  'src/features/architect/GMDashboard/hooks/useArchitectActions.ts';
const HISTORY_TAB_PATH =
  'src/features/architect/history/TeamHistoryTab/TeamHistoryTab.jsx';
const HISTORY_DETAIL_MODAL_PATH =
  'src/features/architect/history/TeamHistoryTab/HistoryDetailModal.jsx';
const HISTORY_NORMALIZER_PATH =
  'src/features/architect/history/utils/normalizeWorldEventsForTeamHistory.ts';
const FIXTURES_PATH =
  'src/features/architect/history/devTeamHistoryFixtures.ts';

const forbiddenWritePatterns = [
  /\bwriteBatch\b/,
  /\bsetDoc\b/,
  /\bupdateDoc\b/,
  /\baddDoc\b/,
  /\bdeleteDoc\b/,
  /\bbatch\.commit\b/,
];

const forbiddenPathPatterns = [
  /architect_base[a-zA-Z]*/,
  /['"`]teams['"`]/,
  /\/teams\//,
];

function readSource(pathValue: string): string {
  return readFileSync(resolve(process.cwd(), pathValue), 'utf-8');
}

function readRegion(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  expect(startIndex).toBeGreaterThan(-1);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('Team History forbidden writes regression guardrail', () => {
  it('keeps Team History fixture handlers local-only with no Firestore write calls', () => {
    const source = readSource(ACTIONS_PATH);
    const region = readRegion(
      source,
      'const hasInjectedTeamHistoryFixtures = useMemo(',
      'const handleEditContract = useCallback('
    );

    for (const pattern of forbiddenWritePatterns) {
      expect(region).not.toMatch(pattern);
    }
  });

  it('keeps Team History UI + fixture module free from forbidden write paths', () => {
    const historySource = readSource(HISTORY_TAB_PATH);
    const modalSource = readSource(HISTORY_DETAIL_MODAL_PATH);
    const normalizerSource = readSource(HISTORY_NORMALIZER_PATH);
    const fixtureSource = readSource(FIXTURES_PATH);

    for (const pattern of forbiddenWritePatterns) {
      expect(historySource).not.toMatch(pattern);
      expect(modalSource).not.toMatch(pattern);
      expect(normalizerSource).not.toMatch(pattern);
      expect(fixtureSource).not.toMatch(pattern);
    }

    for (const pattern of forbiddenPathPatterns) {
      expect(historySource).not.toMatch(pattern);
      expect(modalSource).not.toMatch(pattern);
      expect(normalizerSource).not.toMatch(pattern);
      expect(fixtureSource).not.toMatch(pattern);
    }
  });
});
