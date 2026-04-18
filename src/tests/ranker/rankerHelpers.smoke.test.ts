import { beforeEach, describe, expect, it } from 'vitest';
import {
  createRankerSession,
  deleteRankerSession,
  getRankerSession,
  queryAllRankerSessions,
  queryIncompleteRankerSessions,
  updateRankerSession,
} from '@/firebase/rankerHelpers';
import {
  getMockData,
  resetMockDataStore,
  seedMockData,
} from '../../../tests/__mocks__/firebase.js';

describe('rankerHelpers', () => {
  beforeEach(() => {
    resetMockDataStore();
  });

  it('round-trips a ranker session through create, read, update, query, and delete', async () => {
    const sessionId = await createRankerSession({
      userId: 'owner-1',
      name: 'Draft Board',
      playerPoolIds: ['p1', 'p2', 'p3'],
      setupData: {
        topTier: ['p1'],
        bottomTier: ['p3'],
        anchor: 'p2',
        firstPlace: null,
        lastPlace: null,
      },
      results: [{ winner: 'p1', loser: 'p2' }],
      skippedPairs: ['p1<>p3'],
    });

    const storedPath = `rankerSessions/${sessionId}`;
    expect(getMockData(storedPath)).toMatchObject({
      ownerUid: 'owner-1',
      schemaVersion: 1,
      name: 'Draft Board',
      playerPoolIds: ['p1', 'p2', 'p3'],
      setupData: {
        topTier: ['p1'],
        bottomTier: ['p3'],
        anchor: 'p2',
        firstPlace: null,
        lastPlace: null,
      },
      results: [{ winner: 'p1', loser: 'p2' }],
      skippedPairs: ['p1<>p3'],
      anchorDone: false,
      isFinished: false,
      adjustments: null,
    });

    const fetched = await getRankerSession(sessionId, 'owner-1');
    expect(fetched).toMatchObject({
      id: sessionId,
      ownerUid: 'owner-1',
      name: 'Draft Board',
      playerPoolIds: ['p1', 'p2', 'p3'],
    });

    const incomplete = await queryIncompleteRankerSessions('owner-1', 10);
    expect(incomplete).toHaveLength(1);
    expect(incomplete[0]?.id).toBe(sessionId);

    await updateRankerSession(sessionId, 'owner-1', {
      isFinished: true,
      adjustments: ['p1', 'p2', 'p3'],
      savedListId: 'list-9',
    });

    expect(getMockData(storedPath)).toMatchObject({
      isFinished: true,
      adjustments: ['p1', 'p2', 'p3'],
      savedListId: 'list-9',
    });

    const allSessions = await queryAllRankerSessions('owner-1', 10);
    expect(allSessions).toHaveLength(1);
    expect(allSessions[0]).toMatchObject({
      id: sessionId,
      isFinished: true,
      savedListId: 'list-9',
    });

    const nowComplete = await queryIncompleteRankerSessions('owner-1', 10);
    expect(nowComplete).toEqual([]);

    await deleteRankerSession(sessionId, 'owner-1');
    expect(getMockData(storedPath)).toBeUndefined();
  });

  it('rejects malformed or foreign ranker sessions during reads and writes', async () => {
    seedMockData('rankerSessions/orphaned', {
      name: 'Broken Session',
      playerPoolIds: ['p1', 'p2'],
      setupData: null,
      results: [],
      skippedPairs: [],
      anchorDone: false,
      isFinished: false,
    });

    seedMockData('rankerSessions/foreign', {
      ownerUid: 'owner-2',
      name: 'Foreign Session',
      playerPoolIds: ['p1', 'p2'],
      setupData: null,
      results: [],
      skippedPairs: [],
      anchorDone: false,
      isFinished: false,
    });

    await expect(getRankerSession('orphaned', 'owner-1')).rejects.toThrow(
      /Invalid ranker session orphaned/i
    );
    await expect(
      updateRankerSession('foreign', 'owner-1', { name: 'Nope' })
    ).rejects.toThrow(/do not own this document/i);
  });
});
