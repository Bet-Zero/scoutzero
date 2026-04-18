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
  const USER_ID = 'user-1';

  beforeEach(() => {
    resetMockDataStore();
  });

  it('round-trips an owned roster project through create, read, update, rename, and delete', async () => {
    const created = await createRosterProject(
      'Baseline Roster',
      USER_ID,
      ['player-1', null],
      ['player-2'],
      [],
      'lakers'
    );

    const storedPath = `rosterProjects/${created.id}`;
    expect(getMockData(storedPath)).toMatchObject({
      name: 'Baseline Roster',
      ownerUid: USER_ID,
      starters: ['player-1', null],
      rotation: ['player-2'],
      bench: [],
      team: 'lakers',
    });

    const allRosters = await fetchAllRosterProjects(USER_ID);
    expect(allRosters).toHaveLength(1);
    expect(allRosters[0]).toMatchObject({
      id: created.id,
      name: 'Baseline Roster',
      ownerUid: USER_ID,
      starters: ['player-1', null],
      rotation: ['player-2'],
      bench: [],
      team: 'lakers',
    });

    const loaded = await loadRosterProject(created.id, USER_ID);
    expect(loaded).toMatchObject({
      id: created.id,
      name: 'Baseline Roster',
      ownerUid: USER_ID,
      ownershipValid: true,
      starters: ['player-1', null],
      rotation: ['player-2'],
      bench: [],
      team: 'lakers',
    });

    await updateRosterProject(created.id, USER_ID, {
      name: 'Updated Roster',
      rotation: ['player-2', 'player-3'],
    });

    expect(getMockData(storedPath)).toMatchObject({
      name: 'Updated Roster',
      ownerUid: USER_ID,
      starters: ['player-1', null],
      rotation: ['player-2', 'player-3'],
      bench: [],
      team: 'lakers',
    });

    await renameRosterProject(created.id, 'Renamed Roster', USER_ID);
    expect(getMockData(storedPath)?.name).toBe('Renamed Roster');

    await deleteRosterProject(created.id, USER_ID);
    expect(getMockData(storedPath)).toBeUndefined();
  });

  it('auto-claims legacy ownerless rosters and hides foreign-owned rosters', async () => {
    seedMockData('rosterProjects/legacy-roster', {
      name: 'Legacy Roster',
      team: 'lakers',
      starters: ['player-1'],
      rotation: [],
      bench: [],
    });
    seedMockData('rosterProjects/foreign-roster', {
      name: 'Foreign Roster',
      team: 'celtics',
      starters: ['player-9'],
      rotation: [],
      bench: [],
      ownerUid: 'user-2',
    });

    const rosters = await fetchAllRosterProjects(USER_ID);

    expect(rosters).toHaveLength(1);
    expect(rosters[0]).toMatchObject({
      id: 'legacy-roster',
      name: 'Legacy Roster',
      ownerUid: USER_ID,
    });
    expect(getMockData('rosterProjects/legacy-roster')).toMatchObject({
      ownerUid: USER_ID,
    });
    await expect(loadRosterProject('foreign-roster', USER_ID)).resolves.toBeNull();
    await expect(
      renameRosterProject('foreign-roster', 'Stolen Name', USER_ID)
    ).rejects.toThrow(/do not own this roster project/i);
  });

  it('rejects malformed roster documents during owned reads', async () => {
    seedMockData('rosterProjects/bad-roster', {
      name: 'Broken Roster',
      team: 'lakers',
      starters: 'not-an-array',
      rotation: [],
      bench: [],
    });

    await expect(fetchAllRosterProjects(USER_ID)).rejects.toThrow(
      /Invalid roster project bad-roster/i
    );
  });
});
