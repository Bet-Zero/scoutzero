// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import TierMakerView from '@/pages/TierMakerView';
import TierListsHome from '@/pages/TierListsHome';
import { useAuth } from '@/shared/hooks/useAuth';
import { useSimplePlayerData } from '@/shared/hooks/useSimplePlayerData';
import {
  deleteTierList,
  fetchAllTierLists,
  fetchTierList,
  renameTierList,
} from '@/firebase/listHelpers';

const toastMock = vi.hoisted(() => {
  const fn = vi.fn();
  fn.success = vi.fn();
  fn.error = vi.fn();
  return fn;
});

vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/shared/hooks/useSimplePlayerData', () => {
  const useSimplePlayerData = vi.fn();
  return { default: useSimplePlayerData, useSimplePlayerData };
});

vi.mock('@/firebase/listHelpers', () => ({
  fetchTierList: vi.fn(),
  fetchAllTierLists: vi.fn(),
  renameTierList: vi.fn(),
  deleteTierList: vi.fn(),
}));

vi.mock('@/features/tierMaker/TierMakerBoard', () => {
  const TierMakerBoard = () => (
    <div data-testid="tiermaker-board">Tiermaker board</div>
  );
  return { default: TierMakerBoard, TierMakerBoard };
});

vi.mock('@/features/tierMaker/TieramidBoard', () => {
  const TieramidBoard = () => (
    <div data-testid="tieramid-board">Tieramid board</div>
  );
  return { default: TieramidBoard, TieramidBoard };
});

vi.mock('@/features/tierMaker/hooks/useTierDraft', () => ({
  useTierDraft: () => ({
    draftStandard: { tiers: {}, tierOrder: [] },
    draftTieramid: { rows: {}, rowOrder: [] },
    updateStandard: vi.fn(),
    updateTieramid: vi.fn(),
    clearDraft: vi.fn(),
    restored: true,
  }),
}));

vi.mock('@/features/tierMaker/utils/draftConversion', () => ({
  standardToTieramid: vi.fn((value) => value),
  tieramidToStandard: vi.fn((value) => value),
  isStandardEmpty: vi.fn(() => true),
  isTieramidEmpty: vi.fn(() => true),
}));

vi.mock('react-hot-toast', () => ({
  toast: toastMock,
}));

vi.mock('@/features/tierMaker/CreateTierListModal', () => {
  const CreateTierListModal = () => null;
  return { default: CreateTierListModal, CreateTierListModal };
});

vi.mock('@/features/lists/ListSearchBar', () => {
  const ListSearchBar = ({ onSelect }) => (
    <button onClick={() => onSelect('pyramid-list')}>Select Search Result</button>
  );
  return { default: ListSearchBar, ListSearchBar };
});

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseSimplePlayerData = vi.mocked(useSimplePlayerData);
const mockedFetchTierList = vi.mocked(fetchTierList);
const mockedFetchAllTierLists = vi.mocked(fetchAllTierLists);
const mockedRenameTierList = vi.mocked(renameTierList);
const mockedDeleteTierList = vi.mocked(deleteTierList);

function LocationProbe() {
  const location = useLocation();

  return (
    <div data-testid="location">{`${location.pathname}${location.search}`}</div>
  );
}

function renderWithRoutes(initialEntry) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LocationProbe />
      <Routes>
        <Route path="/tier-maker/:tierListId" element={<TierMakerView />} />
        <Route path="/tier-lists" element={<TierListsHome />} />
        <Route path="*" element={<div>Unknown route</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockedUseAuth.mockReturnValue({ userId: 'user-1', loading: false });
  mockedUseSimplePlayerData.mockReturnValue({
    players: [],
    loading: false,
    error: null,
  });
  mockedFetchTierList.mockReset();
  mockedFetchAllTierLists.mockReset();
  mockedRenameTierList.mockReset();
  mockedDeleteTierList.mockReset();
  toastMock.mockClear();
  toastMock.success.mockClear();
  toastMock.error.mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Tiermaker saved routing', () => {
  it('normalizes missing saved-list mode to the resolved board mode', async () => {
    mockedFetchTierList.mockResolvedValue({
      id: 'pyramid-list',
      mode: 'pyramid',
    });

    renderWithRoutes('/tier-maker/pyramid-list');

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/tier-maker/pyramid-list?mode=tieramid'
      );
    });

    expect(screen.getByTestId('tieramid-board')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Reopen Link' })).toBeInTheDocument();
  });

  it('renders an owner-only reopen message when saved-tier-list access is denied', async () => {
    mockedFetchTierList.mockRejectedValue(
      Object.assign(new Error('denied'), { code: 'permission-denied' })
    );

    renderWithRoutes('/tier-maker/locked-list?mode=standard');

    await waitFor(() => {
      expect(
        screen.getByText(
          'This tier list belongs to a different session and can’t be opened here.'
        )
      ).toBeInTheDocument();
    });

    expect(screen.queryByTestId('tiermaker-board')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to Tier Lists' })
    ).toHaveAttribute('href', '/tier-lists');
  });
});

describe('Tier Lists Home navigation', () => {
  it('opens saved pyramid lists with tieramid mode from cards and search', async () => {
    mockedFetchAllTierLists.mockResolvedValue([
      {
        id: 'pyramid-list',
        name: 'Pyramid Board',
        mode: 'pyramid',
        tiers: {
          Row1: ['p1'],
          Pool: [],
        },
      },
    ]);
    mockedFetchTierList.mockResolvedValue({
      id: 'pyramid-list',
      mode: 'pyramid',
    });

    renderWithRoutes('/tier-lists');

    expect(await screen.findByRole('link', { name: 'Pyramid Board' })).toHaveAttribute(
      'href',
      '/tier-maker/pyramid-list?mode=tieramid'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select Search Result' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/tier-maker/pyramid-list?mode=tieramid'
      );
    });
  });
});
