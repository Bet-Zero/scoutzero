import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePlayerDetail } from '@/shared/hooks/usePlayerDetail';
import { seedMockData } from '../../../tests/__mocks__/firebase.js';

describe('usePlayerDetail profile evaluation overlay', () => {
  it('loads immutable player source data and overlays user-owned profile edits', async () => {
    seedMockData('players_v2/test_player_doc', {
      bio: {
        displayName: 'Test Player',
        playerId: 'test_player',
      },
      currentEvaluationView: {
        roles: {
          offense1: 'Source Creator',
        },
        traits: {
          Shooting: 50,
        },
        shootingProfile: 'Source Shooter',
      },
    });
    seedMockData('players_v2/test_player_doc/evaluations/current', {
      roles: {
        defense1: 'Source Defender',
      },
      traits: {
        Passing: 55,
      },
      shootingProfile: 'Source Movement Shooter',
    });
    seedMockData(
      'playerProfileEvaluations/test_user/players/test_player_doc',
      {
        ownerUid: 'test_user',
        playerId: 'test_player_doc',
        roles: {
          offense1: 'Saved Creator',
        },
        traits: {
          Shooting: 82,
        },
        blurbs: {
          overall: 'Saved profile note',
        },
        videoExamples: {
          overall: [
            {
              url: 'https://youtu.be/saved',
              label: 'Saved clip',
              createdAt: 1,
            },
          ],
        },
      }
    );

    const { result } = renderHook(() =>
      usePlayerDetail('test_player_doc', 'test_user')
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.player?.bio?.displayName).toBe('Test Player');
    expect(result.current.player?.currentEvaluationView?.roles?.offense1)
      .toBe('Source Creator');
    expect(result.current.player?.evaluations?.current).toMatchObject({
      roles: {
        offense1: 'Saved Creator',
        defense1: 'Source Defender',
      },
      traits: {
        Shooting: 82,
        Passing: 55,
      },
      blurbs: {
        overall: 'Saved profile note',
      },
      videoExamples: {
        overall: [
          {
            url: 'https://youtu.be/saved',
            label: 'Saved clip',
            createdAt: 1,
          },
        ],
      },
    });
  });
});


describe('usePlayerDetail blocked-current transition', () => {
  it('clears the previous profile when the next current contract is malformed', async () => {
    seedMockData('players_v2/previous_valid', { bio: { displayName: 'Previous Player', playerId: 'previous_valid' } });
    seedMockData('players_v2/next_blocked', { bio: { displayName: 'Blocked Player', playerId: 'next_blocked' } });
    seedMockData('players_v2/next_blocked/contracts/current', { metadata: { isCurrent: true } });
    const { result, rerender } = renderHook(({ id }) => usePlayerDetail(id), { initialProps: { id: 'previous_valid' } });
    await waitFor(() => expect(result.current.player?.id).toBe('previous_valid'));
    rerender({ id: 'next_blocked' });
    await waitFor(() => expect(result.current.error).toContain('current failed schema validation'));
    expect(result.current.player).toBeNull();
    expect(result.current.dataWarnings).toEqual([]);
  });
});
