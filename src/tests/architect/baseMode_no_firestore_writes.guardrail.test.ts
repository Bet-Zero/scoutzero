import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SOURCE_PATH = 'src/features/architect/GMDashboard/hooks/useArchitectActions.ts';

function readSource(): string {
  return readFileSync(resolve(process.cwd(), SOURCE_PATH), 'utf-8');
}

function readRegion(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end);
  expect(startIndex).toBeGreaterThan(-1);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('base-mode Firestore write guardrail', () => {
  it('keeps base-mode cap-changing branches free of direct Firestore write calls', () => {
    const source = readSource();
    const regions = [
      readRegion(
        source,
        'const applyTradeToCapSheet = useCallback(',
        'const handleSign = useCallback('
      ),
      readRegion(
        source,
        'const handleSign = useCallback(',
        'const handleSignAndTrade = useCallback('
      ),
      readRegion(
        source,
        'const handleSetDeadCap = useCallback(',
        'const handleSetExceptions = useCallback('
      ),
      readRegion(
        source,
        'const handleSetExceptions = useCallback(',
        'const handleEditContract = useCallback('
      ),
      readRegion(
        source,
        'const confirmAndRenounceRights = useCallback(',
        'const handleCapSheetAction = useCallback('
      ),
      readRegion(
        source,
        'const handleExtendContract = useCallback(',
        'const handleWaiveContract = useCallback('
      ),
      readRegion(
        source,
        'const handleWaiveContract = useCallback(',
        'const handleOptionDecision = useCallback('
      ),
      readRegion(
        source,
        'const handleOptionDecision = useCallback(',
        'const handleRenounceRights = useCallback('
      ),
    ];

    const forbiddenPatterns = [
      /\bwriteBatch\b/,
      /\bsetDoc\b/,
      /\bupdateDoc\b/,
      /\baddDoc\b/,
      /\bdeleteDoc\b/,
      /\bbatch\.commit\b/,
    ];

    for (const region of regions) {
      for (const forbidden of forbiddenPatterns) {
        expect(region).not.toMatch(forbidden);
      }
    }
  });
});
