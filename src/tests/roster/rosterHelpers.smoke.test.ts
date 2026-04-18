import { beforeEach, describe, expect, it } from 'vitest';
import {
  createRosterProject,
  deleteRosterProject,
  fetchAllRosterProjects,
  loadRosterProject,
  renameRosterProject,
  updateRosterProject,
} from '@/firebase/rosterHelpers';
import {
  getMockData,
  resetMockDataStore,
  seedMockData,
} from '../../../tests/__mocks__/firebase.js';

describe('rosterHelpers', () => {
  beforeEach(() => {
    resetMockDataStore();
  });

  it('round-trips a roster project through create, read, update, rename, and delete', async () => {
    const created = await createRosterProject(
      'Baseline Roster',
      ['player-1', null],
      ['player-2'],
      [],
      'lakers'
    );

    const storedPath = `rosterProjects/${created.id}`;
    expect(getMockData(storedPath)).toMatchObject({
      name: 'Baseline Roster',
      starters: ['player-1', null],
      rotation: ['player-2'],
      bench: [],
      team: 'lakers',
    });

    const allRosters = await fetchAllRosterProjects();
    expect(allRosters).toHaveLength(1);
    expect(allRosters[0]).toMatchObject({
      id: created.id,
      name: 'Baseline Roster',
      starters: ['player-1', null],
      rotation: ['player-2'],
      bench: [],
      team: 'lakers',
    });

    const loaded = await loadRosterProject(created.id);
    expect(loaded).toMatchObject({
      id: created.id,
      name: 'Baseline Roster',
      starters: ['player-1', null],
      rotation: ['player-2'],
      bench: [],
      team: 'lakers',
    });

    await updateRosterProject(created.id, {
      name: 'Updated Roster',
      rotation: ['player-2', 'player-3'],
    });

    expect(getMockData(storedPath)).toMatchObject({
      name: 'Updated Roster',
      starters: ['player-1', null],
      rotation: ['player-2', 'player-3'],
      bench: [],
      team: 'lakers',
    });

    await renameRosterProject(created.id, 'Renamed Roster');
    expect(getMockData(storedPath)?.name).toBe('Renamed Roster');

    await deleteRosterProject(created.id);
    expect(getMockData(storedPath)).toBeUndefined();
  });

  it('rejects malformed roster documents during reads', async () => {
    seedMockData('rosterProjects/bad-roster', {
      name: 'Broken Roster',
      team: 'lakers',
      starters: 'not-an-array',
      rotation: [],
      bench: [],
    });

    await expect(fetchAllRosterProjects()).rejects.toThrow(
      /Invalid roster project bad-roster/i
    );
  });
});
