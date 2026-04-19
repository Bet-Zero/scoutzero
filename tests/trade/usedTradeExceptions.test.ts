import { describe, it, expect } from 'vitest';
import { extractUsedTpeIds } from '@/features/architect/utils/tradeMachine/utils/tradeExportUtils';

describe('extractUsedTpeIds', () => {
  it('includes tpeId when absorptionMode is TPE', () => {
    const sends = [
      { name: 'Player A', absorptionMode: 'TPE', tpeId: 'tpe_001' },
    ];
    expect(extractUsedTpeIds(sends)).toEqual(['tpe_001']);
  });

  it('excludes entries where tpeId is missing or null', () => {
    const sends = [
      { name: 'Player A', absorptionMode: 'TPE', tpeId: null },
      { name: 'Player B', absorptionMode: 'TPE' },
      { name: 'Player C', absorptionMode: 'TPE', tpeId: '' },
    ];
    expect(extractUsedTpeIds(sends)).toEqual([]);
  });

  it('deduplicates when multiple players share the same tpeId', () => {
    const sends = [
      { name: 'Player A', absorptionMode: 'TPE', tpeId: 'tpe_001' },
      { name: 'Player B', absorptionMode: 'TPE', tpeId: 'tpe_001' },
      { name: 'Player C', absorptionMode: 'TPE', tpeId: 'tpe_002' },
    ];
    const result = extractUsedTpeIds(sends);
    expect(result).toEqual(['tpe_001', 'tpe_002']);
  });

  it('preserves first-seen order through the current Set-based dedupe path', () => {
    const sends = [
      { name: 'Player A', absorptionMode: 'TPE', tpeId: 'tpe_002' },
      { name: 'Player B', absorptionMode: 'TPE', tpeId: 'tpe_001' },
      { name: 'Player C', absorptionMode: 'TPE', tpeId: 'tpe_002' },
    ];

    expect(extractUsedTpeIds(sends)).toEqual(['tpe_002', 'tpe_001']);
  });

  it('excludes non-TPE absorption modes', () => {
    const sends = [
      { name: 'Player A', absorptionMode: 'MATCH', tpeId: 'tpe_001' },
      { name: 'Player B', absorptionMode: 'FA_EXCEPTION', tpeId: 'tpe_002' },
      { name: 'Player C', tpeId: 'tpe_003' },
    ];
    expect(extractUsedTpeIds(sends)).toEqual([]);
  });

  it('returns empty array for null/undefined/empty input', () => {
    expect(extractUsedTpeIds(null)).toEqual([]);
    expect(extractUsedTpeIds(undefined)).toEqual([]);
    expect(extractUsedTpeIds([])).toEqual([]);
  });
});
