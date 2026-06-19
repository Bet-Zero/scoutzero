// @vitest-environment jsdom
import React, { useMemo, useState } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { usePlayerNavigation } from '@/features/profile/hooks/usePlayerNavigation';
import { TeamPlayerDropdowns } from '@/features/profile/TeamPlayerDropdowns';
import { BreakdownModal } from '@/features/profile/BreakdownModal';
import { PlayerHeader } from '@/features/profile/PlayerDetails/PlayerHeader';
import { PlayerStatsTable } from '@/features/profile/PlayerDetails/PlayerStatsTable';
import PlayerProfileView from '@/pages/PlayerProfileView';
import { enrichPlayerData } from '@/features/roster/utils/enrichPlayerData';
import {
  setBlurbForKey,
  setVideoExamplesForKey,
} from '@/features/profile/utils/profileHelpers';
import type { ProfileDetailKey } from '@/features/profile/utils/profileHelpers';
import type { ModalSavePayload } from '@/features/profile/hooks/usePlayerProfileState';
import { createEmptyVideoExamples } from '@/shared/utils/videoExamples';
import { useSimplePlayerData } from '@/shared/hooks/useSimplePlayerData';
import { usePlayerDetail } from '@/shared/hooks/usePlayerDetail';
import { useAuth } from '@/shared/hooks/useAuth';

vi.mock('@/shared/hooks/useSimplePlayerData', () => {
  const useSimplePlayerData = vi.fn();
  return { default: useSimplePlayerData, useSimplePlayerData };
});

vi.mock('@/shared/hooks/usePlayerDetail', () => {
  const usePlayerDetail = vi.fn();
  return { default: usePlayerDetail, usePlayerDetail };
});

vi.mock('@/shared/hooks/useAuth', () => {
  const useAuth = vi.fn();
  return { useAuth };
});

const mockedUseSimplePlayerData = vi.mocked(useSimplePlayerData);
const mockedUsePlayerDetail = vi.mocked(usePlayerDetail);
const mockedUseAuth = vi.mocked(useAuth);

const PLAYER_FIXTURES = [
  {
    id: 'lebron_doc',
    name: 'LeBron James',
    bio: {
      displayName: 'LeBron James',
      playerId: 'lebron_james',
      position: 'Forward',
      height: 81,
      display: {
        team: 'Los Angeles Lakers',
      },
    },
  },
  {
    id: 'reaves_doc',
    name: 'Austin Reaves',
    bio: {
      displayName: 'Austin Reaves',
      playerId: 'austin_reaves',
      position: 'Guard',
      height: 77,
      display: {
        team: 'Los Angeles Lakers',
      },
    },
  },
  {
    id: 'green_doc_1',
    name: 'AJ Green',
    bio: {
      displayName: 'AJ Green',
      playerId: 'aj_green_one',
      position: 'Guard',
      height: 76,
      display: {
        team: 'Milwaukee Bucks',
      },
    },
  },
  {
    id: 'green_doc_2',
    name: 'AJ Green',
    bio: {
      displayName: 'AJ Green',
      playerId: 'aj_green_two',
      position: 'Guard',
      height: 76,
      display: {
        team: 'Dallas Mavericks',
      },
    },
  },
];

function NavigationHarness() {
  const nav = usePlayerNavigation(null);
  const location = useLocation();

  return (
    <div>
      <div data-testid="selected-player">{nav.selectedPlayer || 'none'}</div>
      <div data-testid="location">{`${location.pathname}${location.search}`}</div>
      <input aria-label="keyboard-guard-input" />
      <button
        type="button"
        onClick={() =>
          nav.handleSearchSelect('reaves_doc', 'Los Angeles Lakers')
        }
      >
        Search Austin
      </button>
      <button
        type="button"
        onClick={() =>
          nav.handleSearchSelect('lebron_doc', 'Los Angeles Lakers')
        }
      >
        Search LeBron
      </button>
      <button type="button" onClick={nav.handleNextPlayer}>
        Next Player
      </button>
      <TeamPlayerDropdowns
        teams={nav.teams}
        playersData={nav.playersData}
        selectedTeam={nav.selectedTeam}
        setSelectedTeam={nav.setSelectedTeam}
        selectedPlayer={nav.selectedPlayer}
        setSelectedPlayer={nav.setSelectedPlayer}
        filteredKeys={nav.filteredKeys}
        setFilteredKeys={nav.setFilteredKeys}
      />
    </div>
  );
}

function renderNavigation(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/profiles" element={<NavigationHarness />} />
        <Route path="/profiles/:slug" element={<NavigationHarness />} />
      </Routes>
    </MemoryRouter>
  );
}

function BreakdownModalHarness({
  onSaveNow = vi.fn().mockResolvedValue(undefined),
}: {
  onSaveNow?: ReturnType<typeof vi.fn>;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [blurbs, setBlurbs] = useState({
    traits: {},
    roles: {},
    subroles: {},
    shootingProfile: '',
    twoWayMeter: '',
    overall: 'Original blurb',
  });
  const [videoExamples, setVideoExamples] = useState(createEmptyVideoExamples());
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  );

  const wrappedSaveNow = useMemo(
    () =>
      vi.fn(async (payload) => {
        setSaveState('saving');
        await onSaveNow(payload);
        setSaveState('saved');
      }),
    [onSaveNow]
  );

  const handleBuildSavePayload = (
    key: ProfileDetailKey,
    value: string,
    list: ModalSavePayload['videoExamples']['overall']
  ): ModalSavePayload => ({
    blurbs: setBlurbForKey(blurbs, key ?? 'overall', value),
    videoExamples: setVideoExamplesForKey(videoExamples, key ?? 'overall', list),
    hasChanges: true,
  });

  const handleCommitSavedDraft = (
    payload: Partial<ModalSavePayload> | null | undefined
  ) => {
    if (payload?.blurbs) setBlurbs(payload.blurbs);
    if (payload?.videoExamples) setVideoExamples(payload.videoExamples);
  };

  return (
    <div>
      <div data-testid="saved-overall">{blurbs.overall}</div>
      {isOpen ? (
        <BreakdownModal
          modalKey="overall"
          blurbs={blurbs}
          videoExamples={videoExamples}
          onClose={() => setIsOpen(false)}
          onBuildSavePayload={handleBuildSavePayload}
          onCommitSavedDraft={handleCommitSavedDraft}
          onSaveNow={wrappedSaveNow}
          saveState={saveState}
          saveError={null}
        />
      ) : null}
    </div>
  );
}

beforeEach(() => {
  mockedUseAuth.mockReturnValue({
    user: null,
    userId: 'test_user',
    loading: false,
  });
  mockedUseSimplePlayerData.mockReturnValue({
    players: PLAYER_FIXTURES,
    loading: false,
    error: null,
  });
  mockedUsePlayerDetail.mockImplementation((playerId) => ({
    player: playerId ? { id: playerId } : null,
    loading: false,
    error: null,
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('Player profile route + interaction behavior', () => {
  it('resolves legacy player query params and canonicalizes to slug + pid', async () => {
    renderNavigation('/profiles?player=lebron_james');

    await waitFor(() => {
      expect(screen.getByTestId('selected-player')).toHaveTextContent(
        'lebron_doc'
      );
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/profiles/lebron-james?pid=lebron_doc'
      );
    });
  });

  it('resolves unique slug-only routes and leaves ambiguous slugs unselected', async () => {
    const { unmount } = renderNavigation('/profiles/austin-reaves');

    await waitFor(() => {
      expect(screen.getByTestId('selected-player')).toHaveTextContent(
        'reaves_doc'
      );
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/profiles/austin-reaves?pid=reaves_doc'
      );
    });

    unmount();

    renderNavigation('/profiles/aj-green');

    await waitFor(() => {
      expect(screen.getByTestId('selected-player')).toHaveTextContent('none');
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/profiles/aj-green'
      );
    });
  });

  it('keeps the URL canonical during search, team dropdown, and prev/next navigation', async () => {
    renderNavigation('/profiles');

    const [teamSelect] = screen.getAllByRole('combobox');
    fireEvent.change(teamSelect, { target: { value: 'Los Angeles Lakers' } });

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/profiles/lebron-james?pid=lebron_doc'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Search Austin' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/profiles/austin-reaves?pid=reaves_doc'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Search LeBron' }));

    await waitFor(() => {
      expect(screen.getByTestId('selected-player')).toHaveTextContent(
        'lebron_doc'
      );
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/profiles/lebron-james?pid=lebron_doc'
      );
    });

    const [, playerSelect] = screen.getAllByRole('combobox');
    fireEvent.change(playerSelect, { target: { value: 'reaves_doc' } });

    await waitFor(() => {
      expect(screen.getByTestId('selected-player')).toHaveTextContent(
        'reaves_doc'
      );
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/profiles/austin-reaves?pid=reaves_doc'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next Player' }));

    await waitFor(() => {
      expect(screen.getByTestId('selected-player')).toHaveTextContent(
        'reaves_doc'
      );
    });
  });

  it('ignores arrow-key navigation while typing in editable inputs', async () => {
    renderNavigation('/profiles/lebron-james?pid=lebron_doc');

    await waitFor(() => {
      expect(screen.getByTestId('selected-player')).toHaveTextContent(
        'lebron_doc'
      );
    });

    fireEvent.keyDown(screen.getByLabelText('keyboard-guard-input'), {
      key: 'ArrowRight',
    });

    expect(screen.getByTestId('selected-player')).toHaveTextContent(
      'lebron_doc'
    );

    fireEvent.keyDown(document.body, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByTestId('selected-player')).toHaveTextContent(
        'reaves_doc'
      );
    });
  });
});

describe('BreakdownModal draft behavior', () => {
  it('keeps edits local until Save and discards them cleanly', async () => {
    const saveNow = vi.fn().mockResolvedValue(undefined);

    render(<BreakdownModalHarness onSaveNow={saveNow} />);

    fireEvent.change(screen.getByPlaceholderText('Write your breakdown here...'), {
      target: { value: 'Discard me' },
    });

    expect(screen.getByTestId('saved-overall')).toHaveTextContent(
      'Original blurb'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Write your breakdown here...')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('saved-overall')).toHaveTextContent(
      'Original blurb'
    );
    expect(saveNow).not.toHaveBeenCalled();
  });

  it('commits modal drafts only after a successful explicit save', async () => {
    const saveNow = vi.fn().mockResolvedValue(undefined);

    render(<BreakdownModalHarness onSaveNow={saveNow} />);

    fireEvent.change(screen.getByPlaceholderText('Write your breakdown here...'), {
      target: { value: 'Saved blurb' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(saveNow).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('saved-overall')).toHaveTextContent(
        'Saved blurb'
      );
    });

    expect(saveNow.mock.calls[0][0].blurbs.overall).toBe('Saved blurb');
  });
});

describe('PlayerProfileView error states', () => {
  it('keeps the empty profile route as a selector state without player navigation', async () => {
    render(
      <MemoryRouter initialEntries={['/profiles']}>
        <Routes>
          <Route path="/profiles" element={<PlayerProfileView />} />
          <Route path="/profiles/:slug" element={<PlayerProfileView />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Select a player to view their profile.')
      ).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('Search players...')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(
      screen.queryByRole('navigation', { name: 'Player navigation' })
    ).not.toBeInTheDocument();
  });

  it('renders invalid profile routes as a missing-player state with recovery controls', async () => {
    render(
      <MemoryRouter
        initialEntries={['/profiles/not-a-real-player?pid=not-a-real-player']}
      >
        <Routes>
          <Route path="/profiles" element={<PlayerProfileView />} />
          <Route path="/profiles/:slug" element={<PlayerProfileView />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Player profile not found')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Search or choose a player to continue.')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Select a player to view their profile.')
    ).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search players...')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    expect(
      screen.queryByRole('navigation', { name: 'Player navigation' })
    ).not.toBeInTheDocument();
  });

  it('renders explicit detail errors instead of a false loading state', async () => {
    mockedUsePlayerDetail.mockImplementation((playerId) => ({
      player: null,
      loading: false,
      error: playerId ? 'Player detail failed to load' : null,
    }));

    render(
      <MemoryRouter initialEntries={['/profiles/lebron-james?pid=lebron_doc']}>
        <Routes>
          <Route path="/profiles" element={<PlayerProfileView />} />
          <Route path="/profiles/:slug" element={<PlayerProfileView />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Unable to load player profile')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Player detail failed to load')
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByText('Loading player data...')
    ).not.toBeInTheDocument();
  });
});

describe('PlayerHeader normalized display values', () => {
  it('renders normalized age and derived contract summary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-06T12:00:00Z'));

    const player = enrichPlayerData({
      id: 'test_player_doc',
      bio: {
        displayName: 'Test Player',
        playerId: 'test_player',
        position: 'Forward',
        height: 80,
        weight: 225,
        dob: '2000-01-15',
        display: {
          team: 'Los Angeles Lakers',
          yearsPro: 4,
          freeAgentYear: 2027,
          freeAgentType: 'UFA',
        },
      },
      currentContractView: {
        currentSalary: 20_000_000,
        yearsRemaining: 2,
        freeAgentYear: 2027,
        freeAgentType: 'UFA',
      },
    });

    expect(player).not.toBeNull();
    if (!player) throw new Error('Expected enriched player');
    render(<PlayerHeader player={player} selectedPlayer="test_player_doc" />);

    expect(
      screen.getByText((_, element) => element?.textContent === 'AGE: 26')
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === 'YEARS PRO: 4')
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.textContent === 'CONTRACT: $20.0M / 2 yrs'
      )
    ).toHaveTextContent(
      'CONTRACT: $20.0M / 2 yrs'
    );
  });

  it('guards stale years-pro source values with draft-year provenance', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-06T12:00:00Z'));

    const player = enrichPlayerData({
      id: 'lebron_james',
      name: 'LeBron James',
      bio: {
        displayName: 'LeBron James',
        playerId: 'lebron_james',
        position: 'Forward',
        height: 81,
        weight: 250,
        dob: '1984-12-30',
        draft: {
          year: 2003,
          round: 1,
          pick: 1,
        },
        display: {
          team: 'Los Angeles Lakers',
          yearsPro: 2,
        },
      },
    });

    expect(player).not.toBeNull();
    if (!player) throw new Error('Expected enriched player');
    render(<PlayerHeader player={player} selectedPlayer="lebron_james" />);

    expect(
      screen.getByText((_, element) => element?.textContent === 'YEARS PRO: 22')
    ).toBeInTheDocument();
  });

  it('keeps plausible recent-player years-pro source values', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-06T12:00:00Z'));

    const player = enrichPlayerData({
      id: 'recent_player',
      name: 'Recent Player',
      bio: {
        displayName: 'Recent Player',
        playerId: 'recent_player',
        position: 'Guard',
        height: 76,
        weight: 190,
        draft: {
          year: 2025,
          round: 1,
          pick: 12,
        },
        display: {
          team: 'Portland Trail Blazers',
          yearsPro: 0,
        },
      },
    });

    expect(player).not.toBeNull();
    if (!player) throw new Error('Expected enriched player');
    render(<PlayerHeader player={player} selectedPlayer="recent_player" />);

    expect(
      screen.getByText((_, element) => element?.textContent === 'YEARS PRO: 0')
    ).toBeInTheDocument();
  });

  it('formats low contract salaries without rounding to zero millions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-06T12:00:00Z'));

    const player = enrichPlayerData({
      id: 'nick_smith_jr',
      name: 'Nick Smith Jr.',
      bio: {
        displayName: 'Nick Smith Jr.',
        playerId: 'nick_smith_jr',
        position: 'Guard',
        height: 74,
        weight: 185,
        display: {
          team: 'Charlotte Hornets',
          yearsPro: 2,
        },
      },
      currentContractView: {
        currentSalary: 13_197,
        yearsRemaining: 2,
      },
    });

    expect(player).not.toBeNull();
    if (!player) throw new Error('Expected enriched player');
    render(<PlayerHeader player={player} selectedPlayer="nick_smith_jr" />);

    expect(
      screen.getByText((_, element) =>
        element?.textContent === 'CONTRACT: $13.2K / 2 yrs'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('$0.0M / 2 yrs')).not.toBeInTheDocument();
  });
});

describe('PlayerStatsTable season label provenance', () => {
  it('uses source season metadata for denormalized current stats', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));

    const player = enrichPlayerData({
      id: 'test_stats_player',
      bio: {
        displayName: 'Test Stats Player',
        playerId: 'test_stats_player',
      },
      currentSeasonStats: {
        GP: 70,
        MIN: 32.1,
        PTS: 25.2,
        REB: 7.8,
        AST: 8.1,
        'FG%': 0.525,
        '3PT%': 0.378,
        'FT%': 0.771,
        'eFG%': 0.587,
      },
      seasons: {
        '2025-26': {
          stats: {
            PTS: 25.2,
          },
          meta: {
            statsSeasonTag: '2025-26',
          },
        },
      },
    });

    expect(player).not.toBeNull();
    if (!player) throw new Error('Expected enriched player');
    render(<PlayerStatsTable player={player} />);

    expect(screen.getByText('2025-26')).toBeInTheDocument();
    expect(screen.queryByText('2026-27')).not.toBeInTheDocument();
  });
});
