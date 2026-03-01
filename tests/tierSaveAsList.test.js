// tests/tierSaveAsList.test.js
// Tests for Tiermaker/Tieramid → List bridge conversion utilities.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildListPayloadFromTierMaker,
  buildListPayloadFromTieramid,
  saveTierAsList,
  generateDefaultListName,
} from '@/features/tierMaker/utils/saveAsListBridge';

// Mock createList and saveList from listHelpers
vi.mock('@/firebase/listHelpers', () => ({
  createList: vi.fn(),
  saveList: vi.fn(),
}));

import { createList, saveList } from '@/firebase/listHelpers';

// ─── buildListPayloadFromTierMaker ────────────────────────────────────────────

describe('buildListPayloadFromTierMaker', () => {
  it('produces correct playerOrder respecting tierOrder', () => {
    const tiers = {
      S: ['p1', 'p2'],
      A: ['p3'],
      B: ['p4', 'p5', 'p6'],
      Pool: ['p7', 'p8'],
    };
    const tierOrder = ['S', 'A', 'B', 'Pool'];

    const result = buildListPayloadFromTierMaker({ tiers, tierOrder });

    expect(result.playerOrder).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
      'p7',
      'p8',
    ]);
    expect(result.playerIds).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
      'p7',
      'p8',
    ]);
  });

  it('respects within-tier ordering', () => {
    const tiers = {
      S: ['alpha', 'beta', 'gamma'],
      Pool: [],
    };
    const tierOrder = ['S', 'Pool'];

    const result = buildListPayloadFromTierMaker({ tiers, tierOrder });

    // Order within S tier should be preserved
    expect(result.playerOrder.indexOf('alpha')).toBeLessThan(
      result.playerOrder.indexOf('beta')
    );
    expect(result.playerOrder.indexOf('beta')).toBeLessThan(
      result.playerOrder.indexOf('gamma')
    );
  });

  it('appends Pool IDs last', () => {
    const tiers = {
      S: ['p1'],
      A: ['p2'],
      Pool: ['pool1', 'pool2'],
    };
    const tierOrder = ['S', 'A', 'Pool'];

    const result = buildListPayloadFromTierMaker({ tiers, tierOrder });

    // Pool items should come after all tier items
    expect(result.playerOrder.indexOf('p2')).toBeLessThan(
      result.playerOrder.indexOf('pool1')
    );
    expect(result.playerOrder[result.playerOrder.length - 2]).toBe('pool1');
    expect(result.playerOrder[result.playerOrder.length - 1]).toBe('pool2');
  });

  it('deduplicates when same ID appears in multiple tiers', () => {
    const tiers = {
      S: ['p1', 'p2'],
      A: ['p2', 'p3'], // p2 duplicated
      Pool: ['p1'], // p1 duplicated
    };
    const tierOrder = ['S', 'A', 'Pool'];

    const result = buildListPayloadFromTierMaker({ tiers, tierOrder });

    // Should dedupe - p1 and p2 appear only once
    expect(result.playerOrder).toEqual(['p1', 'p2', 'p3']);
    expect(result.playerIds).toHaveLength(3);
  });

  it('filters out falsey/invalid IDs', () => {
    const tiers = {
      S: ['p1', '', null, undefined, 'p2'],
      A: [null, 'p3', ''],
      Pool: ['', undefined],
    };
    const tierOrder = ['S', 'A', 'Pool'];

    const result = buildListPayloadFromTierMaker({ tiers, tierOrder });

    expect(result.playerOrder).toEqual(['p1', 'p2', 'p3']);
    expect(result.playerIds).not.toContain('');
    expect(result.playerIds).not.toContain(null);
    expect(result.playerIds).not.toContain(undefined);
  });

  it('handles player objects with player_id', () => {
    const tiers = {
      S: [{ player_id: 'p1', name: 'Player 1' }],
      A: [{ player_id: 'p2' }, { player_id: 'p3' }],
      Pool: [{ player_id: 'p4' }],
    };
    const tierOrder = ['S', 'A', 'Pool'];

    const result = buildListPayloadFromTierMaker({ tiers, tierOrder });

    expect(result.playerOrder).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('handles player objects with id (fallback)', () => {
    const tiers = {
      S: [{ id: 'x1' }],
      A: [{ id: 'x2' }],
      Pool: [],
    };
    const tierOrder = ['S', 'A', 'Pool'];

    const result = buildListPayloadFromTierMaker({ tiers, tierOrder });

    expect(result.playerOrder).toEqual(['x1', 'x2']);
  });

  it('handles missing Pool gracefully', () => {
    const tiers = {
      S: ['p1'],
      A: ['p2'],
    };
    const tierOrder = ['S', 'A'];

    const result = buildListPayloadFromTierMaker({ tiers, tierOrder });

    expect(result.playerOrder).toEqual(['p1', 'p2']);
  });

  it('handles empty board', () => {
    const tiers = {
      S: [],
      A: [],
      Pool: [],
    };
    const tierOrder = ['S', 'A', 'Pool'];

    const result = buildListPayloadFromTierMaker({ tiers, tierOrder });

    expect(result.playerOrder).toEqual([]);
    expect(result.playerIds).toEqual([]);
  });

  it('handles null/undefined inputs gracefully', () => {
    const result1 = buildListPayloadFromTierMaker({
      tiers: null,
      tierOrder: null,
    });
    expect(result1.playerOrder).toEqual([]);

    const result2 = buildListPayloadFromTierMaker({
      tiers: undefined,
      tierOrder: undefined,
    });
    expect(result2.playerOrder).toEqual([]);
  });
});

// ─── buildListPayloadFromTieramid ─────────────────────────────────────────────

describe('buildListPayloadFromTieramid', () => {
  it('produces correct playerOrder respecting rowOrder', () => {
    const rows = {
      Row1: ['p1'],
      Row2: ['p2', 'p3'],
      Row3: ['p4', 'p5', 'p6'],
      Pool: ['p7'],
    };
    const rowOrder = ['Row1', 'Row2', 'Row3', 'Pool'];

    const result = buildListPayloadFromTieramid({ rows, rowOrder });

    expect(result.playerOrder).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
      'p7',
    ]);
  });

  it('respects within-row ordering', () => {
    const rows = {
      Row1: ['first'],
      Row2: ['second', 'third'],
      Pool: [],
    };
    const rowOrder = ['Row1', 'Row2', 'Pool'];

    const result = buildListPayloadFromTieramid({ rows, rowOrder });

    expect(result.playerOrder.indexOf('second')).toBeLessThan(
      result.playerOrder.indexOf('third')
    );
  });

  it('appends Pool IDs last', () => {
    const rows = {
      Row1: ['p1'],
      Row2: ['p2', 'p3'],
      Pool: ['poolA', 'poolB'],
    };
    const rowOrder = ['Row1', 'Row2', 'Pool'];

    const result = buildListPayloadFromTieramid({ rows, rowOrder });

    const poolAIdx = result.playerOrder.indexOf('poolA');
    const p3Idx = result.playerOrder.indexOf('p3');
    expect(p3Idx).toBeLessThan(poolAIdx);
    expect(result.playerOrder.slice(-2)).toEqual(['poolA', 'poolB']);
  });

  it('deduplicates when same ID appears in multiple rows', () => {
    const rows = {
      Row1: ['dup'],
      Row2: ['dup', 'unique'],
      Pool: ['dup'],
    };
    const rowOrder = ['Row1', 'Row2', 'Pool'];

    const result = buildListPayloadFromTieramid({ rows, rowOrder });

    expect(result.playerOrder).toEqual(['dup', 'unique']);
    expect(result.playerIds.filter((id) => id === 'dup')).toHaveLength(1);
  });

  it('filters out falsey/invalid IDs', () => {
    const rows = {
      Row1: ['valid', null, '', undefined],
      Row2: [undefined, 'also_valid'],
      Pool: [null],
    };
    const rowOrder = ['Row1', 'Row2', 'Pool'];

    const result = buildListPayloadFromTieramid({ rows, rowOrder });

    expect(result.playerOrder).toEqual(['valid', 'also_valid']);
  });

  it('handles player objects', () => {
    const rows = {
      Row1: [{ player_id: 'obj1' }],
      Row2: [{ id: 'obj2' }, { player_id: 'obj3' }],
      Pool: [],
    };
    const rowOrder = ['Row1', 'Row2', 'Pool'];

    const result = buildListPayloadFromTieramid({ rows, rowOrder });

    expect(result.playerOrder).toEqual(['obj1', 'obj2', 'obj3']);
  });

  it('handles empty tieramid', () => {
    const rows = {
      Row1: [],
      Row2: [],
      Pool: [],
    };
    const rowOrder = ['Row1', 'Row2', 'Pool'];

    const result = buildListPayloadFromTieramid({ rows, rowOrder });

    expect(result.playerOrder).toEqual([]);
    expect(result.playerIds).toEqual([]);
  });
});

// ─── saveTierAsList ───────────────────────────────────────────────────────────

describe('saveTierAsList', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    createList.mockResolvedValue('list_123');
    saveList.mockResolvedValue(undefined);
  });

  it('calls createList with correct name and userId', async () => {
    await saveTierAsList({
      mode: 'standard',
      name: 'My Tier List',
      userId: 'user_abc',
      data: {
        tiers: { S: ['p1'], Pool: [] },
        tierOrder: ['S', 'Pool'],
      },
    });

    expect(createList).toHaveBeenCalledWith('My Tier List', 'user_abc');
  });

  it('calls saveList with correct payload for standard mode', async () => {
    await saveTierAsList({
      mode: 'standard',
      name: 'Test List',
      userId: 'user_xyz',
      data: {
        tiers: { S: ['p1', 'p2'], A: ['p3'], Pool: ['p4'] },
        tierOrder: ['S', 'A', 'Pool'],
      },
    });

    expect(saveList).toHaveBeenCalledWith(
      'list_123',
      {
        playerOrder: ['p1', 'p2', 'p3', 'p4'],
        playerIds: ['p1', 'p2', 'p3', 'p4'],
        playerNotes: {},
        description: 'Created from Tiermaker',
      },
      'user_xyz'
    );
  });

  it('calls saveList with correct payload for pyramid mode', async () => {
    await saveTierAsList({
      mode: 'pyramid',
      name: 'Pyramid Export',
      userId: 'user_xyz',
      data: {
        rows: { Row1: ['p1'], Row2: ['p2', 'p3'], Pool: [] },
        rowOrder: ['Row1', 'Row2', 'Pool'],
      },
    });

    expect(saveList).toHaveBeenCalledWith(
      'list_123',
      {
        playerOrder: ['p1', 'p2', 'p3'],
        playerIds: ['p1', 'p2', 'p3'],
        playerNotes: {},
        description: 'Created from Tieramid',
      },
      'user_xyz'
    );
  });

  it('returns the created listId', async () => {
    createList.mockResolvedValue('new_list_456');

    const result = await saveTierAsList({
      mode: 'standard',
      name: 'Return Test',
      userId: 'user_abc',
      data: {
        tiers: { S: ['p1'], Pool: [] },
        tierOrder: ['S', 'Pool'],
      },
    });

    expect(result).toEqual({ listId: 'new_list_456' });
  });

  it('throws error if no userId', async () => {
    await expect(
      saveTierAsList({
        mode: 'standard',
        name: 'No User',
        userId: null,
        data: { tiers: { S: ['p1'], Pool: [] }, tierOrder: ['S', 'Pool'] },
      })
    ).rejects.toThrow('Cannot save as list without a user session.');
  });

  it('throws error if board is empty', async () => {
    await expect(
      saveTierAsList({
        mode: 'standard',
        name: 'Empty Board',
        userId: 'user_abc',
        data: {
          tiers: { S: [], A: [], Pool: [] },
          tierOrder: ['S', 'A', 'Pool'],
        },
      })
    ).rejects.toThrow('Cannot save empty board as list.');
  });

  it('throws error for unknown mode', async () => {
    await expect(
      saveTierAsList({
        mode: 'unknown',
        name: 'Test',
        userId: 'user_abc',
        data: {},
      })
    ).rejects.toThrow('Unknown mode: unknown');
  });
});

// ─── generateDefaultListName ──────────────────────────────────────────────────

describe('generateDefaultListName', () => {
  it('generates Tiermaker prefix for standard mode', () => {
    const name = generateDefaultListName('standard');
    expect(name).toMatch(/^Tiermaker \d{4}-\d{2}-\d{2}$/);
  });

  it('generates Tieramid prefix for pyramid mode', () => {
    const name = generateDefaultListName('pyramid');
    expect(name).toMatch(/^Tieramid \d{4}-\d{2}-\d{2}$/);
  });

  it('includes current date in YYYY-MM-DD format', () => {
    const name = generateDefaultListName('standard');
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    expect(name).toContain(`${yyyy}-${mm}-${dd}`);
  });
});
