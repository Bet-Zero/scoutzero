import { loadProfileSeasons } from '@/shared/utils/loadProfileSeasons';
import { describe, expect, it } from 'vitest';
import sample from '../../../player-scrape/shared/schema/sample_players_v2_format.json';
import { ContractDocZ } from '@/schemas/players_v2';
import { loadProfileContracts } from '@/shared/utils/contracts/loadProfileContracts';

const current = () => ContractDocZ.parse({ ...sample.data, metadata: { ...sample.data.metadata, isCurrent: true } });
describe('retained contract qualification boundary', () => {
  it('keeps valid current data available and reports unqualified retained records without changing them', () => {
    const documents = [{ id: 'current', data: current() }, { id: 'retained', data: { isExtension: null, salariesByYear: [{ year: '2024-25', salary: 10 }] } }];
    const before = structuredClone(documents);
    const result = loadProfileContracts(documents, 'players_v2/example/contracts');
    expect(Object.keys(result.contracts)).toEqual(['current']);
    expect(result.withheldIds).toEqual(['retained']);
    expect(result.warnings).toEqual(['1 contract record needs review. Contract history may be incomplete.']);
    expect(documents).toEqual(before);
  });
  it('blocks a malformed explicitly current record even when another current record validates', () => {
    expect(() => loadProfileContracts([{ id: 'valid', data: current() }, { id: 'broken_current', data: { metadata: { isCurrent: true } } }], 'players_v2/example/contracts')).toThrow('broken_current failed schema validation');
  });
  it('does not turn malformed-only or historical-only data into a usable current profile', () => {
    expect(() => loadProfileContracts([{ id: 'unknown', data: {} }], 'contracts')).toThrow();
    expect(() => loadProfileContracts([{ id: 'past', data: { ...current(), metadata: { ...current().metadata, isCurrent: false } } }, { id: 'unknown', data: {} }], 'contracts')).toThrow();
  });
});


describe('unqualified season history', () => {
  it('preserves original null placeholders without inventing statistics or blocking other profile data', () => {
    const documents = [{ id: '2025-26', data: { age: 22, stats: { GP: 0 } } },
      { id: '2024-25', data: { stats: { PTS: null }, contractView: { salary: null } } }];
    const before = structuredClone(documents);
    const result = loadProfileSeasons(documents);
    expect(Object.keys(result.seasons)).toEqual(['2025-26']);
    expect(result.withheldIds).toEqual(['2024-25']);
    expect(result.warnings).toEqual(['1 season record needs review. Statistics history may be incomplete.']);
    expect(documents).toEqual(before);
  });
});
