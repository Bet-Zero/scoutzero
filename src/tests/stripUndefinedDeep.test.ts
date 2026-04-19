/**
 * FILE: src/tests/stripUndefinedDeep.test.ts
 * PURPOSE: Test the stripUndefinedDeep utility for preventing Firestore errors
 * OWNERSHIP: Testing (hotfix validation)
 *
 * HISTORY:
 *  - 2026-01-22: Created for hotfix validation - stripUndefinedDeep utility
 *
 * LINKS:
 *  - Hotfix: docs/return_packages/scouting/SCOUTING_PLAYER_PROFILE_HOTFIX_UNDEFINED_RP.md
 */

import { describe, it, expect } from 'vitest';

// Copy the utility function for testing
const stripUndefinedDeep = (value) => {
  if (value === undefined) return undefined; // Signal removal
  if (value === null) return null; // Preserve null

  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined);
  }

  if (value instanceof Date || typeof value !== 'object') {
    return value;
  }

  // Plain object: recursively clean
  const cleaned = {};
  for (const [key, val] of Object.entries(value)) {
    const cleanedVal = stripUndefinedDeep(val);
    if (cleanedVal !== undefined) {
      cleaned[key] = cleanedVal;
    }
  }
  return cleaned;
};

describe('stripUndefinedDeep', () => {
  it('should remove undefined fields from flat objects', () => {
    const input = {
      name: 'Test',
      value: undefined,
      count: 5,
    };

    const result = stripUndefinedDeep(input);
    expect(result).toEqual({ name: 'Test', count: 5 });
    expect('value' in result).toBe(false);
  });

  it('should recursively remove undefined from nested objects', () => {
    const input = {
      user: {
        name: 'John',
        email: undefined,
        address: {
          city: 'NYC',
          zip: undefined,
        },
      },
      status: 'active',
    };

    const result = stripUndefinedDeep(input);
    expect(result).toEqual({
      user: {
        name: 'John',
        address: {
          city: 'NYC',
        },
      },
      status: 'active',
    });
  });

  it('should handle arrays with undefined elements', () => {
    const input = {
      items: [
        { id: 1, name: 'A' },
        { id: 2, name: undefined },
        { id: 3, name: 'C' },
      ],
    };

    const result = stripUndefinedDeep(input);
    expect(result.items).toHaveLength(3);
    expect(result.items[0]).toEqual({ id: 1, name: 'A' });
    expect(result.items[1]).toEqual({ id: 2 });
    expect(result.items[2]).toEqual({ id: 3, name: 'C' });
  });

  it('should preserve null values', () => {
    const input = {
      name: 'Test',
      value: null,
      count: 5,
    };

    const result = stripUndefinedDeep(input);
    expect(result).toEqual({ name: 'Test', value: null, count: 5 });
  });

  it('should handle deeply nested structures', () => {
    const input = {
      level1: {
        level2: {
          level3: {
            value: undefined,
            keep: 'me',
          },
          also: undefined,
        },
      },
    };

    const result = stripUndefinedDeep(input);
    expect(result).toEqual({
      level1: {
        level2: {
          level3: {
            keep: 'me',
          },
        },
      },
    });
  });

  it('should handle evaluation data structure', () => {
    const input = {
      traits: { playmaking: 7, shooting: undefined },
      roles: { offense1: 'Ball Handler', offense2: undefined },
      videoExamples: {
        overall: [
          { url: 'https://test.com', label: undefined, createdAt: 123456 },
        ],
      },
    };

    const result = stripUndefinedDeep(input);
    expect(result.traits).toEqual({ playmaking: 7 });
    expect(result.roles).toEqual({ offense1: 'Ball Handler' });
    expect(result.videoExamples.overall[0]).toEqual({
      url: 'https://test.com',
      createdAt: 123456,
    });
    expect('label' in result.videoExamples.overall[0]).toBe(false);
  });

  it('should preserve Date objects', () => {
    const date = new Date('2026-01-22');
    const input = {
      timestamp: date,
      name: 'Test',
    };

    const result = stripUndefinedDeep(input);
    expect(result.timestamp).toBe(date);
    expect(result.timestamp instanceof Date).toBe(true);
  });

  it('should handle empty objects after cleaning', () => {
    const input = {
      empty: { value: undefined },
      keep: 'this',
    };

    const result = stripUndefinedDeep(input);
    expect(result).toEqual({ empty: {}, keep: 'this' });
  });
});
