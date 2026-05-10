import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePlayerProfileState } from '@/features/profile/hooks/usePlayerProfileState';
import type { EnrichablePlayerData } from '@/features/roster/utils/enrichPlayerData';

const detailedPlayer: EnrichablePlayerData = {
  id: 'test_player_doc',
  bio: {
    displayName: 'Test Player',
    playerId: 'test_player',
  },
  currentEvaluationView: {
    roles: {
      offense1: 'Primary Creator',
      defense1: 'Point of Attack',
    },
    traits: {
      Shooting: 82,
    },
    subRoles: {
      offense: ['Advantage Creator'],
      defense: ['Screen Navigator'],
    },
    shootingProfile: 'Movement Shooter',
    twoWay: 64,
    badges: ['Touch Finisher'],
    overallGrade: 78,
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
};

describe('usePlayerProfileState', () => {
  it('hydrates normalized scouting state from an enriched player', async () => {
    const { result } = renderHook(() =>
      usePlayerProfileState(detailedPlayer, 'test_player_doc', null)
    );

    await waitFor(() => {
      expect(result.current.player?.name).toBe('Test Player');
    });

    expect(result.current.traits.Shooting).toBe(82);
    expect(result.current.roles.offense1).toBe('Primary Creator');
    expect(result.current.roles.defense1).toBe('Point of Attack');
    expect(result.current.twoWay).toBe(64);
    expect(result.current.subRoles.offense).toEqual(['Advantage Creator']);
    expect(result.current.badges).toEqual(['Touch Finisher']);
    expect(result.current.editedBlurbs.overall).toBe('Existing overall');
    expect(result.current.videoExamples.overall).toHaveLength(1);
    expect(result.current.hasChanges).toBe(false);
  });

  it('marks field handlers dirty and commits saved modal drafts', async () => {
    const { result } = renderHook(() =>
      usePlayerProfileState(detailedPlayer, 'test_player_doc', null)
    );

    await waitFor(() => {
      expect(result.current.player?.name).toBe('Test Player');
    });

    act(() => {
      result.current.handleRoleChange('offense2', 'Connector');
    });

    expect(result.current.roles.offense2).toBe('Connector');
    expect(result.current.hasChanges).toBe(true);

    const payload = result.current.buildModalSavePayload('overall', 'Updated', [
      {
        url: 'https://youtu.be/updated',
        label: 'Updated clip',
        createdAt: 2,
      },
    ]);

    expect(payload.hasChanges).toBe(true);
    expect(payload.blurbs.overall).toBe('Updated');
    expect(payload.videoExamples.overall).toHaveLength(1);

    act(() => {
      result.current.commitSavedModalDraft(payload);
    });

    expect(result.current.editedBlurbs.overall).toBe('Updated');
    expect(result.current.videoExamples.overall[0]?.label).toBe('Updated clip');
  });
});
