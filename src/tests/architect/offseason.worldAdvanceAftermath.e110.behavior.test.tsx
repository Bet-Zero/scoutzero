/**
 * FILE: src/tests/architect/offseason.worldAdvanceAftermath.e110.behavior.test.tsx
 * PURPOSE: Focused UI coverage for OffseasonSection world-advance aftermath handling.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * @vitest-environment jsdom
 */

import React from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  DEV_OFFSEASON_PREVIEW_FLAG,
  OffseasonSection,
} from '@/features/architect/GMDashboard/sections/OffseasonSection';
import { NON_AUTHORITATIVE_OFFSEASON_PREVIEW_AUTHORITY } from '@/features/architect/offseason/OffseasonTab/types';

const {
  mockGetDraftPositions,
  mockSaveDraftPositions,
  mockClearDraftPositions,
  mockValidateDraftPositionsMap,
  mockDraftPositionsInput,
  mockOffseasonTab,
  mockCaptureWorldAdvanceCallback,
} = vi.hoisted(() => ({
  mockGetDraftPositions: vi.fn(),
  mockSaveDraftPositions: vi.fn(),
  mockClearDraftPositions: vi.fn(),
  mockValidateDraftPositionsMap: vi.fn(),
  mockDraftPositionsInput: vi.fn(),
  mockOffseasonTab: vi.fn(),
  mockCaptureWorldAdvanceCallback: vi.fn(),
}));

vi.mock('@/features/architect/utils/worldManager', () => ({
  getDraftPositions: (...args: unknown[]) => mockGetDraftPositions(...args),
  saveDraftPositions: (...args: unknown[]) => mockSaveDraftPositions(...args),
  clearDraftPositions: (...args: unknown[]) => mockClearDraftPositions(...args),
  validateDraftPositionsMap: (...args: unknown[]) =>
    mockValidateDraftPositionsMap(...args),
}));

vi.mock('@/features/architect/GMDashboard/components/DraftPositionsInput', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockDraftPositionsInput(props);
    return <div data-testid="mock-draft-positions-input" />;
  },
}));

vi.mock('@/features/architect/offseason/OffseasonTab', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockOffseasonTab(props);
    return <div data-testid="mock-offseason-tab" />;
  },
}));

vi.mock('@/features/architect/GMDashboard/components/SeasonAdvanceModal', () => ({
  __esModule: true,
  default: ({
    isOpen,
    onWorldAdvanceComplete,
  }: {
    isOpen?: boolean;
    onWorldAdvanceComplete?: ((result: unknown) => void) | null;
  }) => {
    if (!isOpen) {
      return null;
    }

    mockCaptureWorldAdvanceCallback(onWorldAdvanceComplete ?? null);

    return (
      <div data-testid="mock-season-advance-modal">
        <button
          type="button"
          onClick={() =>
            onWorldAdvanceComplete?.({
              success: true,
              toSeason: '2026-27',
              updatedTeams: ['LAL'],
              summary: {
                declinedOptions: [{ playerId: 'option_1', playerName: 'Option One' }],
              },
              worldAdvanceAftermath: {
                nextWorldSeason: '2026-27',
                nextViewingYear: 2027,
                committedTeamCapSheet: {
                  teamCode: 'LAL',
                  season: '2026-27',
                  players: [],
                  capHolds: [],
                },
                offseasonSummary: {
                  declinedOptions: ['Option One'],
                  expiredContracts: [],
                  expiredTPEs: [],
                  exercisedOptions: [],
                  stepienUpdates: [],
                },
              },
            })
          }
        >
          Emit successful advance
        </button>
        <button
          type="button"
          onClick={() =>
            onWorldAdvanceComplete?.({
              success: false,
              error: 'Advance rejected',
            })
          }
        >
          Emit failed advance
        </button>
        <button
          type="button"
          onClick={() =>
            onWorldAdvanceComplete?.({
              success: true,
              toSeason: '2026-27',
              updatedTeams: ['LAL'],
              worldAdvanceAftermath: {
                nextWorldSeason: '2026-27',
                nextViewingYear: 2027,
              },
            })
          }
        >
          Emit malformed success
        </button>
      </div>
    );
  },
}));

function buildOffseasonSectionProps() {
  return {
    teamCapSheet: { players: [], capHolds: [] },
    setTeamCapSheet: vi.fn(),
    currentYear: 2026,
    setCurrentYear: vi.fn(),
    capProjections: {},
    setOffseasonRun: vi.fn(),
    setOffseasonSummary: vi.fn(),
    setShowOffseasonModal: vi.fn(),
    playersMap: {},
    worldId: 'world_alpha',
    activeWorldIdentityToken: 1,
    teamCode: 'LAL',
    worldSeason: '2025-26',
    worldSeasonLoading: false,
    onReloadWorldData: vi.fn(async () => null),
  };
}

function buildSuccessfulAdvanceResult() {
  return {
    success: true as const,
    toSeason: '2026-27',
    updatedTeams: ['LAL'],
    summary: {
      declinedOptions: [{ playerId: 'option_1', playerName: 'Option One' }],
    },
    worldAdvanceAftermath: {
      nextWorldSeason: '2026-27',
      nextViewingYear: 2027,
      committedTeamCapSheet: {
        teamCode: 'LAL',
        season: '2026-27',
        players: [],
        capHolds: [],
      },
      offseasonSummary: {
        declinedOptions: ['Option One'],
        expiredContracts: [],
        expiredTPEs: [],
        exercisedOptions: [],
        stepienUpdates: [],
      },
    },
  };
}

function expectCommittedTeamCapSheetUpdate(
  setTeamCapSheet: { mock: { calls: unknown[][] } },
  expectedCommittedTeamCapSheet: Record<string, unknown>
) {
  const update = setTeamCapSheet.mock.calls.at(-1)?.[0];

  expect(typeof update).toBe('function');
  expect(
    (update as (previousTeamCapSheet: Record<string, unknown>) => Record<string, unknown>)({
      id: 'LAL',
      teamCode: 'LAL',
      season: '2025-26',
      players: [{ id: 'stale_player' }],
      capHolds: [{ amount: 1 }],
    })
  ).toEqual(expect.objectContaining(expectedCommittedTeamCapSheet));
}

async function renderOffseasonSectionWithGate({
  isDevEnvironment = true,
  previewFlagValue,
  props: propOverrides = {},
}: {
  isDevEnvironment?: boolean;
  previewFlagValue?: string | null;
  props?: Record<string, unknown>;
} = {}) {
  vi.stubEnv('DEV', isDevEnvironment);
  window.localStorage.clear();

  if (previewFlagValue != null) {
    window.localStorage.setItem(
      DEV_OFFSEASON_PREVIEW_FLAG,
      previewFlagValue
    );
  }

  const props = {
    ...buildOffseasonSectionProps(),
    ...propOverrides,
  };
  let currentProps = props;
  const renderResult = render(<OffseasonSection {...currentProps} />);

  return {
    ...props,
    rerenderWithProps(nextOverrides: Record<string, unknown>) {
      currentProps = {
        ...currentProps,
        ...nextOverrides,
      };
      renderResult.rerender(<OffseasonSection {...currentProps} />);
      return currentProps;
    },
  };
}

describe('OffseasonSection world-advance aftermath behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    vi.stubEnv('DEV', true);
    window.localStorage.clear();
    mockGetDraftPositions.mockResolvedValue({
      positionsMap: { ATL: 1, BOS: 2 },
      method: 'manual',
      updatedAtIso: '2026-03-10T08:30:00.000Z',
    });
    mockSaveDraftPositions.mockResolvedValue({ success: true });
    mockClearDraftPositions.mockResolvedValue({ success: true });
    mockValidateDraftPositionsMap.mockReturnValue({
      valid: true,
      errors: [],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('renders preview only when DEV mode and explicit local preview intent are both present', async () => {
    await renderOffseasonSectionWithGate({
      isDevEnvironment: true,
      previewFlagValue: 'true',
    });

    expect(screen.getByTestId('offseason-world-surface')).toBeInTheDocument();
    expect(screen.getByTestId('offseason-preview-surface')).toBeInTheDocument();
    expect(screen.getByTestId('mock-offseason-tab')).toBeInTheDocument();
    expect(screen.getByTestId('offseason-preview-banner')).toHaveTextContent(
      'Preview only — does not persist. Changes will be lost on refresh.'
    );
    expect(mockOffseasonTab.mock.lastCall?.[0]).toMatchObject({
      previewAuthority: NON_AUTHORITATIVE_OFFSEASON_PREVIEW_AUTHORITY,
    });
  });

  it('keeps preview hidden when local preview intent is absent in DEV', async () => {
    await renderOffseasonSectionWithGate({
      isDevEnvironment: true,
    });

    expect(screen.getByTestId('offseason-world-surface')).toBeInTheDocument();
    expect(
      screen.queryByTestId('offseason-preview-surface')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-offseason-tab')).not.toBeInTheDocument();
  });

  it('keeps preview hidden when the preview flag is not true in DEV', async () => {
    await renderOffseasonSectionWithGate({
      isDevEnvironment: true,
      previewFlagValue: 'false',
    });

    expect(screen.getByTestId('offseason-world-surface')).toBeInTheDocument();
    expect(
      screen.queryByTestId('offseason-preview-surface')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-offseason-tab')).not.toBeInTheDocument();
  });

  it('keeps preview hidden outside DEV even when the preview flag is true', async () => {
    await renderOffseasonSectionWithGate({
      isDevEnvironment: false,
      previewFlagValue: 'true',
    });

    expect(screen.getByTestId('offseason-world-surface')).toBeInTheDocument();
    expect(
      screen.queryByTestId('offseason-preview-surface')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-offseason-tab')).not.toBeInTheDocument();
  });

  it('keeps sandbox offseason capability limits explicit without opening world-only execution surfaces', async () => {
    await renderOffseasonSectionWithGate({
      props: {
        worldId: null,
        worldSeason: null,
        onReloadWorldData: null,
      },
    });

    expect(screen.getByTestId('offseason-world-surface')).toBeInTheDocument();
    expect(screen.getByText('World-only')).toBeInTheDocument();
    expect(
      screen.getByText('Select a world to unlock season advance.')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Advance Season' })
    ).toBeDisabled();

    const draftPositionsInputProps = mockDraftPositionsInput.mock.lastCall?.[0] as {
      worldId: string | null;
    };
    expect(draftPositionsInputProps.worldId).toBeNull();
    expect(
      screen.queryByTestId('mock-season-advance-modal')
    ).not.toBeInTheDocument();
  });

  it('passes one world-backed draft positions authority seam and separate validation callback', async () => {
    const props = await renderOffseasonSectionWithGate();
    expect(mockDraftPositionsInput).toHaveBeenCalled();

    const draftPositionsInputProps = mockDraftPositionsInput.mock.lastCall?.[0] as {
      persistenceAuthority: {
        loadCommittedDraftPositions: (draftYear: number) => Promise<unknown>;
        saveCommittedDraftPositions: (
          draftYear: number,
          positionsMap: Record<string, number>
        ) => Promise<unknown>;
        clearCommittedDraftPositions: (draftYear: number) => Promise<void>;
      };
      validateDraftPositionsMap: (
        positionsMap: Record<string, unknown>
      ) => { valid: boolean; errors: string[] };
      seasonAdvanceDraftContext: {
        authoritativeSeason: string;
        nextUsedDraftYear: number;
        nextSeason: string;
      } | null;
      worldId: string;
    };

    expect(draftPositionsInputProps.worldId).toBe('world_alpha');
    expect(draftPositionsInputProps.seasonAdvanceDraftContext).toEqual({
      authoritativeSeason: '2025-26',
      nextUsedDraftYear: 2026,
      nextSeason: '2026-27',
    });

    await expect(
      draftPositionsInputProps.persistenceAuthority.loadCommittedDraftPositions(
        2026
      )
    ).resolves.toEqual({
      positionsMap: { ATL: 1, BOS: 2 },
      method: 'manual',
      updatedAtIso: '2026-03-10T08:30:00.000Z',
    });
    expect(mockGetDraftPositions).toHaveBeenCalledWith('world_alpha', 2026);

    mockGetDraftPositions.mockResolvedValueOnce({
      positionsMap: { ATL: 7, BOS: 8 },
      method: 'manual',
      updatedAtIso: '2026-03-11T09:00:00.000Z',
    });
    await expect(
      draftPositionsInputProps.persistenceAuthority.saveCommittedDraftPositions(
        2026,
        { ATL: 7, BOS: 8 }
      )
    ).resolves.toEqual({
      positionsMap: { ATL: 7, BOS: 8 },
      method: 'manual',
      updatedAtIso: '2026-03-11T09:00:00.000Z',
    });
    expect(mockSaveDraftPositions).toHaveBeenCalledWith(
      'world_alpha',
      2026,
      { ATL: 7, BOS: 8 },
      { method: 'manual' }
    );

    await expect(
      draftPositionsInputProps.persistenceAuthority.clearCommittedDraftPositions(
        2026
      )
    ).resolves.toBeUndefined();
    expect(mockClearDraftPositions).toHaveBeenCalledWith('world_alpha', 2026);

    expect(
      draftPositionsInputProps.validateDraftPositionsMap({ PHI: 5 })
    ).toEqual({
      valid: true,
      errors: [],
    });
    expect(mockValidateDraftPositionsMap).toHaveBeenCalledWith({ PHI: 5 });
  });

  it('applies wrapper aftermath only from the normalized success result payload', async () => {
    const props = await renderOffseasonSectionWithGate();
    fireEvent.click(screen.getByRole('button', { name: 'Advance Season' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Emit successful advance' })
    );

    await waitFor(() => {
      expect(props.setCurrentYear).toHaveBeenCalledWith(2027);
    });
    expectCommittedTeamCapSheetUpdate(props.setTeamCapSheet, {
      teamCode: 'LAL',
      season: '2026-27',
      players: [],
      capHolds: [],
    });
    expect(props.setOffseasonRun).toHaveBeenCalledWith(true);
    expect(props.setOffseasonSummary).toHaveBeenCalledWith({
      declinedOptions: ['Option One'],
      expiredContracts: [],
      expiredTPEs: [],
      exercisedOptions: [],
      stepienUpdates: [],
    });
    expect(props.setShowOffseasonModal).toHaveBeenCalledWith(true);
    expect(props.onReloadWorldData).toHaveBeenCalledTimes(1);
    expect(props.onReloadWorldData).toHaveBeenCalledWith({
      committedTeamSnapshot: {
        teamCode: 'LAL',
        season: '2026-27',
        players: [],
        capHolds: [],
      },
      committedWorldMetadata: {
        currentSeason: '2026-27',
      },
    });
    expect(
      props.setTeamCapSheet.mock.invocationCallOrder[0]
    ).toBeLessThan(props.onReloadWorldData.mock.invocationCallOrder[0]);
  });

  it('keeps immediate aftermath reconciliation even when no broader world reload handler is supplied', async () => {
    const props = await renderOffseasonSectionWithGate({
      props: {
        onReloadWorldData: null,
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Advance Season' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Emit successful advance' })
    );

    await waitFor(() => {
      expect(props.setCurrentYear).toHaveBeenCalledWith(2027);
    });
    expectCommittedTeamCapSheetUpdate(props.setTeamCapSheet, {
      teamCode: 'LAL',
      season: '2026-27',
      players: [],
      capHolds: [],
    });
    expect(props.setOffseasonRun).toHaveBeenCalledWith(true);
    expect(props.setOffseasonSummary).toHaveBeenCalledWith({
      declinedOptions: ['Option One'],
      expiredContracts: [],
      expiredTPEs: [],
      exercisedOptions: [],
      stepienUpdates: [],
    });
    expect(props.setShowOffseasonModal).toHaveBeenCalledWith(true);
    expect(
      screen.queryByText(/Season advanced, but the world reload could not finish:/)
    ).not.toBeInTheDocument();
  });

  it('drops stale season-advance callbacks after the active world identity changes', async () => {
    const props = await renderOffseasonSectionWithGate({
      props: {
        activeWorldIdentityToken: 4,
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Advance Season' }));

    const staleWorldAdvanceCallback = mockCaptureWorldAdvanceCallback.mock
      .lastCall?.[0] as ((result: unknown) => Promise<void> | void) | null;

    expect(typeof staleWorldAdvanceCallback).toBe('function');

    props.rerenderWithProps({
      worldId: null,
      activeWorldIdentityToken: 5,
      worldSeason: null,
      onReloadWorldData: null,
    });

    await act(async () => {
      await staleWorldAdvanceCallback?.(buildSuccessfulAdvanceResult());
    });

    expect(props.setCurrentYear).not.toHaveBeenCalled();
    expect(props.setTeamCapSheet).not.toHaveBeenCalled();
    expect(props.setOffseasonRun).not.toHaveBeenCalled();
    expect(props.setOffseasonSummary).not.toHaveBeenCalled();
    expect(props.setShowOffseasonModal).not.toHaveBeenCalled();
    expect(props.onReloadWorldData).not.toHaveBeenCalled();
  });

  it('ignores failure and malformed success callbacks that lack normalized aftermath truth', async () => {
    const props = await renderOffseasonSectionWithGate();
    fireEvent.click(screen.getByRole('button', { name: 'Advance Season' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Emit failed advance' })
    );

    expect(props.setCurrentYear).not.toHaveBeenCalled();
    expect(props.setTeamCapSheet).not.toHaveBeenCalled();
    expect(props.setOffseasonRun).not.toHaveBeenCalled();
    expect(props.setOffseasonSummary).not.toHaveBeenCalled();
    expect(props.setShowOffseasonModal).not.toHaveBeenCalled();
    expect(props.onReloadWorldData).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Emit malformed success' }));

    expect(props.setCurrentYear).not.toHaveBeenCalled();
    expect(props.setTeamCapSheet).not.toHaveBeenCalled();
    expect(props.setOffseasonRun).not.toHaveBeenCalled();
    expect(props.setOffseasonSummary).not.toHaveBeenCalled();
    expect(props.setShowOffseasonModal).not.toHaveBeenCalled();
    expect(props.onReloadWorldData).not.toHaveBeenCalled();
  });

  it('keeps committed aftermath visible and surfaces reload failure when world refresh cannot finish', async () => {
    const reloadError = new Error('metadata unavailable');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const props = await renderOffseasonSectionWithGate({
      props: {
        onReloadWorldData: vi.fn(async () => {
          throw reloadError;
        }),
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Advance Season' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Emit successful advance' })
    );

    await waitFor(() => {
      expect(props.setCurrentYear).toHaveBeenCalledWith(2027);
    });
    expectCommittedTeamCapSheetUpdate(props.setTeamCapSheet, {
      teamCode: 'LAL',
      season: '2026-27',
      players: [],
      capHolds: [],
    });
    expect(props.onReloadWorldData).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(
        'Season advanced, but the world reload could not finish: metadata unavailable'
      )
    ).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to reload world data after season advance:',
      reloadError
    );
    consoleErrorSpy.mockRestore();
  });

  it('does not synthesize a draft context fallback when world season is unavailable', async () => {
    const props = {
      ...buildOffseasonSectionProps(),
      worldSeason: null,
    };
    render(<OffseasonSection {...props} />);

    await screen.findByText(
      'World season unavailable. Season advance stays disabled until metadata loads.'
    );

    const draftPositionsInputProps = mockDraftPositionsInput.mock.lastCall?.[0] as {
      seasonAdvanceDraftContext: null;
    };

    expect(draftPositionsInputProps.seasonAdvanceDraftContext).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Advance Season' })
    ).toBeDisabled();
  });
});
