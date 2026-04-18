import { act, renderHook } from '@testing-library/react';
import type { Dispatch, SetStateAction } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useAutoSavePlayer from '@/features/profile/hooks/useAutoSavePlayer';
import type { AutoSavePlayerInput } from '@/features/profile/hooks/useAutoSavePlayer';
import type { EnrichedPlayerData } from '@/features/roster/utils/enrichPlayerData';
import { getMockData } from '../../../tests/__mocks__/firebase.js';

const createInput = (
  setHasChanges: Dispatch<SetStateAction<boolean>>
): AutoSavePlayerInput => ({
  playerId: 'test_player_doc',
  player: {
    id: 'test_player_doc',
    name: 'Test Player',
  } as EnrichedPlayerData,
  traits: {
    Shooting: 82,
  },
  roles: {
    offense1: 'Primary Creator',
    offense2: '',
    defense1: 'Point of Attack',
    defense2: '',
  },
  twoWay: 64,
  subRoles: {
    offense: ['Advantage Creator'],
    defense: ['Screen Navigator'],
  },
  badges: ['Touch Finisher'],
  shootingProfile: 'Movement Shooter',
  overallGrade: 78,
  blurbs: {
    traits: {},
    roles: {},
    subroles: {},
    shootingProfile: '',
    twoWayMeter: '',
    overall: 'Existing overall',
  },
  videoExamples: {
    traits: {},
    roles: {},
    subroles: {},
    shootingProfile: [],
    twoWayMeter: [],
    overall: [
      {
        url: 'https://youtu.be/original',
        label: 'Original clip',
        createdAt: 1,
      },
    ],
  },
  hasChanges: false,
  setHasChanges,
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useAutoSavePlayer', () => {
  it('saveNow writes the evaluation and denormalized profile views', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T12:00:00Z'));
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const setHasChanges: Dispatch<SetStateAction<boolean>> = vi.fn();
    const { result } = renderHook(() =>
      useAutoSavePlayer(createInput(setHasChanges))
    );

    await act(async () => {
      await result.current.saveNow();
    });

    expect(
      getMockData('players_v2/test_player_doc/evaluations/current')
    ).toMatchObject({
      traits: { Shooting: 82 },
      roles: {
        offense1: 'Primary Creator',
        offense2: '',
        defense1: 'Point of Attack',
        defense2: '',
      },
      subRoles: {
        offense: ['Advantage Creator'],
        defense: ['Screen Navigator'],
      },
      badges: ['Touch Finisher'],
      shootingProfile: 'Movement Shooter',
      overallGrade: 78,
      twoWay: 64,
      blurbs: {
        overall: 'Existing overall',
      },
      videoExamples: {
        overall: [
          {
            url: 'https://youtu.be/original',
            label: 'Original clip',
            createdAt: 1,
          },
        ],
      },
      meta: {
        updatedBy: 'user',
        version: '1.0',
      },
    });

    expect(
      getMockData('players_v2/test_player_doc/seasons/2025-26')
    ).toMatchObject({
      evaluationView: {
        overallGrade: 78,
        roles: {
          offense1: 'Primary Creator',
          offense2: null,
          defense1: 'Point of Attack',
          defense2: null,
        },
        shootingProfile: 'Movement Shooter',
        twoWay: 64,
        badges: ['Touch Finisher'],
      },
    });

    expect(getMockData('players_v2/test_player_doc')).toMatchObject({
      currentEvaluationView: {
        overallGrade: 78,
        subRoles: {
          offense: ['Advantage Creator'],
          defense: ['Screen Navigator'],
        },
        traits: { Shooting: 82 },
        blurbs: {
          overall: 'Existing overall',
        },
        videoExamples: {
          overall: [
            {
              url: 'https://youtu.be/original',
              label: 'Original clip',
              createdAt: 1,
            },
          ],
        },
      },
    });

    expect(setHasChanges).toHaveBeenCalledWith(false);
    expect(result.current.saveState).toBe('saved');
    expect(result.current.saveError).toBeNull();
  });
});
