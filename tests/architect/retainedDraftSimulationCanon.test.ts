/** Make the actual pinned authority readable to the read-only exact-head checker. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  lookupAcceptedCanonLeaf,
  formatCanonLookup,
} from '../../scripts/architect/lookupAcceptedCanon';

describe('retained simulation review authority', () => {
  it('retains the exact pinned lookup output, not an author paraphrase or working-tree Canon', () => {
    const actual = [
      'CBA2-A12.1',
      'CBA2-A12.2',
      'CBA2-A12.3',
      'CBA2-L09.6',
      'CBA2-A12.4',
      'CBA2-A12.5',
      'CBA2-A12.7',
      'CBA2-L08.7',
      'CBA2-L08.8',
    ]
      .map((leaf) => formatCanonLookup(lookupAcceptedCanonLeaf(leaf)))
      .join('\n');
    expect(
      readFileSync(
        'tests/architect/fixtures/retainedDraftSimulationCanon.txt',
        'utf8'
      )
    ).toBe(actual);
  });
});
