import { describe, expect, it } from 'vitest';
import { interpretSeasonAdvanceEntitlementBoundary } from '@/features/architect/utils/seasonManager.authority';

const LEGACY_BOUNDARY = {
  mode: 'preserve-or-fail-closed',
  unavailableCanonLeafId: 'CBA2-A12.3',
  governingCanonLeafIds: ['CBA2-L08.1', 'CBA2-L09.2'],
  excludedVerdicts: [
    'draft-ownership',
    'stepien',
    'second-apron-freeze',
    'conveyance',
    'swap',
  ],
} as const;

const CURRENT_BOUNDARY = {
  mode: 'preserve-or-fail-closed',
  authenticatedCanonLeafIds: ['CBA2-A12.3'],
  governingCanonLeafIds: [
    'CBA2-A12.3',
    'CBA2-L08.1',
    'CBA2-L09.2',
  ],
  missingGovernedInputs: [
    'governedDraftHistory.ownership',
    'governedDraftHistory.protection',
    'governedDraftHistory.conveyance',
    'governedDraftHistory.freeze',
    'governedDraftHistory.unfreeze',
    'governedDraftHistory.penalty',
    'governedDraftHistory.requiredTransition',
  ],
  excludedVerdicts: [
    'draft-ownership',
    'stepien',
    'second-apron-freeze',
    'conveyance',
    'swap',
  ],
} as const;

type BoundaryRecord = Record<string, unknown>;

function cloneBoundary(value: object): BoundaryRecord {
  return JSON.parse(JSON.stringify(value)) as BoundaryRecord;
}

function interpretWithoutMutation(value: unknown) {
  const before = JSON.stringify(value);
  const result = interpretSeasonAdvanceEntitlementBoundary(value);
  expect(JSON.stringify(value)).toBe(before);
  return result;
}

const VERSION_FIXTURES = [
  ['v1', LEGACY_BOUNDARY],
  ['v2', CURRENT_BOUNDARY],
] as const;

describe('interpretSeasonAdvanceEntitlementBoundary', () => {
  it.each(VERSION_FIXTURES)(
    'accepts the exact complete %s record without changing its bytes',
    (_version, fixture) => {
      const input = cloneBoundary(fixture);
      expect(interpretWithoutMutation(input)).toEqual(CURRENT_BOUNDARY);
    }
  );

  it.each([
    [
      'v1',
      {
        mode: 'preserve-or-fail-closed',
        unavailableCanonLeafId: 'CBA2-A12.3',
      },
    ],
    [
      'v2',
      {
        mode: 'preserve-or-fail-closed',
        authenticatedCanonLeafIds: ['CBA2-A12.3'],
      },
    ],
  ])('rejects a mode-plus-marker %s record', (_version, input) => {
    expect(interpretWithoutMutation(input)).toBeNull();
  });

  describe.each(VERSION_FIXTURES)(
    '%s complete-shape validation',
    (_version, fixture) => {
      const requiredKeys = Object.keys(fixture);

      it.each(requiredKeys)('rejects a missing %s field', (key) => {
        const input = cloneBoundary(fixture);
        delete input[key];
        expect(interpretWithoutMutation(input)).toBeNull();
      });

      it.each(requiredKeys)('rejects a null %s field', (key) => {
        const input = cloneBoundary(fixture);
        input[key] = null;
        expect(interpretWithoutMutation(input)).toBeNull();
      });

      it.each(requiredKeys)('rejects a malformed %s field', (key) => {
        const input = cloneBoundary(fixture);
        input[key] = Array.isArray(input[key]) ? 'not-an-array' : 42;
        expect(interpretWithoutMutation(input)).toBeNull();
      });

      it('rejects an otherwise complete record with an extra field', () => {
        const input = { ...cloneBoundary(fixture), unexpected: true };
        expect(interpretWithoutMutation(input)).toBeNull();
      });
    }
  );

  const ARRAY_FIXTURES = VERSION_FIXTURES.flatMap(([version, fixture]) =>
    Object.entries(fixture)
      .filter((entry): entry is [string, readonly string[]] =>
        Array.isArray(entry[1])
      )
      .map(([key, expected]) => ({ version, fixture, key, expected }))
  );

  it.each(ARRAY_FIXTURES)(
    'rejects a wrong $version $key array value',
    ({ fixture, key, expected }) => {
      const input = cloneBoundary(fixture);
      input[key] = expected.map((entry, index) =>
        index === 0 ? `${entry}.wrong` : entry
      );
      expect(interpretWithoutMutation(input)).toBeNull();
    }
  );

  it.each(ARRAY_FIXTURES)(
    'rejects a duplicate $version $key array value',
    ({ fixture, key, expected }) => {
      const input = cloneBoundary(fixture);
      input[key] = [...expected, expected[0]];
      expect(interpretWithoutMutation(input)).toBeNull();
    }
  );

  it.each(ARRAY_FIXTURES)(
    'rejects an extra $version $key array value',
    ({ fixture, key, expected }) => {
      const input = cloneBoundary(fixture);
      input[key] = [...expected, 'unexpected'];
      expect(interpretWithoutMutation(input)).toBeNull();
    }
  );

  it.each(ARRAY_FIXTURES)(
    'rejects an incomplete $version $key array',
    ({ fixture, key, expected }) => {
      const input = cloneBoundary(fixture);
      input[key] = expected.slice(0, -1);
      expect(interpretWithoutMutation(input)).toBeNull();
    }
  );

  it.each(ARRAY_FIXTURES)(
    'rejects a sparse $version $key array',
    ({ fixture, key, expected }) => {
      const input = cloneBoundary(fixture);
      input[key] = new Array(expected.length);
      expect(interpretWithoutMutation(input)).toBeNull();
    }
  );

  it.each(ARRAY_FIXTURES.filter(({ expected }) => expected.length > 1))(
    'rejects a reordered $version $key array',
    ({ fixture, key, expected }) => {
      const input = cloneBoundary(fixture);
      input[key] = [...expected].reverse();
      expect(interpretWithoutMutation(input)).toBeNull();
    }
  );

  it.each([
    {
      ...LEGACY_BOUNDARY,
      authenticatedCanonLeafIds: ['CBA2-A12.3'],
    },
    {
      ...CURRENT_BOUNDARY,
      unavailableCanonLeafId: 'CBA2-A12.3',
    },
  ])('rejects a hybrid legacy/current record', (input) => {
    expect(interpretWithoutMutation(input)).toBeNull();
  });

  it('leaves representative rejected input byte-identical', () => {
    const input = {
      ...cloneBoundary(CURRENT_BOUNDARY),
      governingCanonLeafIds: ['CBA2-L09.2'],
    };
    expect(interpretWithoutMutation(input)).toBeNull();
  });
});
