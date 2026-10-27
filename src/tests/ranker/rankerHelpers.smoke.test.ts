import { beforeEach, describe, expect, it } from 'vitest';
import {
  createRankerSession,
  deleteRankerSession,
  getRankerSession,
  queryAllRankerSessions,
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
      seedCount: 0,
      finishedAt: null,
    });

    const fetched = await getRankerSession(sessionId, 'owner-1');
    expect(fetched).toMatchObject({
      id: sessionId,
      ownerUid: 'owner-1',
      name: 'Draft Board',
      playerPoolIds: ['p1', 'p2', 'p3'],
    });

    const beforeFinish = await queryAllRankerSessions('owner-1', 10);
    expect(beforeFinish).toHaveLength(1);
    expect(beforeFinish[0]).toMatchObject({
      id: sessionId,
      isFinished: false,
      seedCount: 0,
    });

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

    await deleteRankerSession(sessionId, 'owner-1');
    expect(getMockData(storedPath)).toBeUndefined();
  });

  it('lists the readable sessions when one saved session is unreadable, keeping field steps', async () => {
    const field = {
      topN: 2,
      stage: 'cut' as const,
      locks: [],
      round: 1,
      cutLine: 'p3',
      bubble: ['p1', 'p2', 'p3'],
      roundStart: 0,
      inIds: [],
      cutIds: [],
      playoff: null,
      fieldIds: null,
      order: ['p1', 'p2', 'p3'],
    };
    const sessionId = await createRankerSession({
      userId: 'owner-1',
      name: 'My Top 2',
      playerPoolIds: ['p1', 'p2', 'p3'],
      setupData: {
        field,
        steps: [
          {
            setupData: { field: { ...field, stage: 'locks', round: 0, cutLine: null, bubble: [] } },
            results: 0,
            seedCount: 0,
            anchorDone: false,
          },
        ],
      },
    });
    seedMockData('rankerSessions/broken', {
      ownerUid: 'owner-1',
      playerPoolIds: ['p1'],
    });

    const sessions = await queryAllRankerSessions('owner-1', 10);
    expect(sessions.map((s) => s.id)).toEqual([sessionId]);
    expect(sessions[0].setupData?.field?.order).toEqual(['p1', 'p2', 'p3']);
    expect(sessions[0].setupData?.steps?.[0].setupData?.field?.stage).toBe('locks');
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
