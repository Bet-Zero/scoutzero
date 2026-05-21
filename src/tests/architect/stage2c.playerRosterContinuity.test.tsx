/**
 * FILE: src/tests/architect/stage2c.playerRosterContinuity.test.tsx
 * PURPOSE: Targeted tests for Stage 2C player/roster continuity:
 *          roster click → contract modal, focused-player highlight on
 *          Roster, Cap Sheet, and Full Cap Table, and the receipt-driven
 *          lifetime of that highlight.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Stage 1, 2A, and 2B tests live in their own files; this file only
 * covers Stage 2C surface area. All highlight behavior is visual-only —
 * no mutation, no Firestore reads/writes.
 */

import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import {
  collectPlayerFocusKeys,
  playerMatchesFocus,
} from '@/features/architect/GMDashboard/postActionHandoff/playerFocus';
import { RosterSection as LegacyRosterSection } from '@/features/roster/RosterSection';
import { RosterSection } from '@/features/architect/GMDashboard/sections/RosterSection';
import { CapSheet } from '@/features/architect/capSheet/CapSheet';
import { CapSheetFull } from '@/features/architect/capSheet/CapSheetFull';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// playerMatchesFocus — pure derivation
// ---------------------------------------------------------------------------

describe('Stage 2C — playerMatchesFocus', () => {
  it('matches on id', () => {
    expect(
      playerMatchesFocus({ id: 'player_42', name: 'Jane Doe' }, 'player_42')
    ).toBe(true);
  });

  it('matches on player_id', () => {
    expect(
      playerMatchesFocus(
        { player_id: 'player_42', name: 'Jane Doe' },
        'player_42'
      )
    ).toBe(true);
  });

  it('matches on bio.playerId', () => {
    expect(
      playerMatchesFocus(
        { bio: { playerId: 'player_42', displayName: 'Jane Doe' } },
        'player_42'
      )
    ).toBe(true);
  });

  it('matches on a normalized name fallback', () => {
    expect(
      playerMatchesFocus({ name: 'Jané Doe' }, 'jane_doe')
    ).toBe(true);
  });

  it('does not match a different player', () => {
    expect(
      playerMatchesFocus({ id: 'player_42', name: 'Jane Doe' }, 'player_99')
    ).toBe(false);
  });

  it('returns false for a null focus id', () => {
    expect(
      playerMatchesFocus({ id: 'player_42', name: 'Jane Doe' }, null)
    ).toBe(false);
  });

  it('returns false for a null player', () => {
    expect(playerMatchesFocus(null, 'player_42')).toBe(false);
  });

  it('treats empty-string and whitespace focus ids as no-match', () => {
    expect(
      playerMatchesFocus({ id: 'player_42', name: 'Jane Doe' }, '')
    ).toBe(false);
    expect(
      playerMatchesFocus({ id: 'player_42', name: 'Jane Doe' }, '   ')
    ).toBe(false);
  });

  it('does not substring-match short tokens against longer names', () => {
    // 'doe' should not match 'janedoe' — equality on normalized keys only.
    expect(
      playerMatchesFocus({ name: 'Jane Doe' }, 'doe')
    ).toBe(false);
    expect(
      playerMatchesFocus({ name: 'Jane Doe' }, 'jane')
    ).toBe(false);
  });

  it('matches numeric ids against string focus tokens', () => {
    expect(
      playerMatchesFocus({ id: 42 }, '42')
    ).toBe(true);
  });

  it('does not match a player without any identifying fields', () => {
    expect(playerMatchesFocus({}, 'player_42')).toBe(false);
  });

  it('collectPlayerFocusKeys gathers id + name variants', () => {
    const keys = collectPlayerFocusKeys({
      id: 'player_42',
      name: 'Jané Doe',
      bio: { playerId: 'player_42', displayName: 'Jane Doe' },
    });
    expect(keys).toContain('player_42');
    expect(keys).toContain('Jané Doe');
    expect(keys).toContain('Jane Doe');
    // Normalized name fallback should also be present (lowercase, no marks).
    expect(keys).toContain('janedoe');
  });
});

// ---------------------------------------------------------------------------
// Legacy roster RosterSection — onSelectPlayer + isPlayerHighlighted
// ---------------------------------------------------------------------------

describe('Stage 2C — legacy roster RosterSection', () => {
  const STARTER = {
    id: 'player_42',
    name: 'Jane Doe',
    displayName: 'Jane Doe',
    headshot: '/assets/headshots/player_42.png',
    bio: { playerId: 'player_42', displayName: 'Jane Doe', position: 'G' },
  } as const;

  it('calls onSelectPlayer when a card is clicked', () => {
    const onSelectPlayer = vi.fn();
    render(
      <LegacyRosterSection
        players={[STARTER, null, null, null, null]}
        section="starters"
        isExport
        onSelectPlayer={onSelectPlayer}
      />
    );
    fireEvent.click(screen.getByTestId('roster-card-starter'));
    expect(onSelectPlayer).toHaveBeenCalledTimes(1);
    expect(onSelectPlayer).toHaveBeenCalledWith(STARTER);
  });

  it('does not throw when onSelectPlayer is absent', () => {
    expect(() =>
      render(
        <LegacyRosterSection
          players={[STARTER, null, null, null, null]}
          section="starters"
          isExport
        />
      )
    ).not.toThrow();
    // No click handler attached, so clicking is a no-op
    fireEvent.click(screen.getByTestId('roster-card-starter'));
  });

  it('renders the highlight outline only on matching cards', () => {
    const MATCH = {
      id: 'player_42',
      name: 'Jane Doe',
      displayName: 'Jane Doe',
      headshot: '/assets/headshots/player_42.png',
      bio: { playerId: 'player_42', displayName: 'Jane Doe', position: 'G' },
    };
    const OTHER = {
      id: 'player_99',
      name: 'John Q',
      displayName: 'John Q',
      headshot: '/assets/headshots/player_99.png',
      bio: { playerId: 'player_99', displayName: 'John Q', position: 'F' },
    };
    render(
      <LegacyRosterSection
        players={[MATCH, OTHER, null, null, null]}
        section="starters"
        isExport
        isPlayerHighlighted={(p) => p?.id === 'player_42'}
      />
    );
    const cards = screen.getAllByTestId('roster-card-starter');
    expect(cards[0]).toHaveAttribute('data-roster-card-highlighted', 'true');
    expect(cards[1]).not.toHaveAttribute('data-roster-card-highlighted');
  });

  it('does not re-enable legacy add/remove controls when onSelectPlayer is provided', () => {
    // Even with onSelectPlayer + isExport, the legacy onRemove/onAdd
    // mutation controls remain suppressed (showRemove is gated by !isExport).
    render(
      <LegacyRosterSection
        players={[STARTER, null, null, null, null]}
        section="starters"
        isExport
        onRemove={vi.fn()}
        onAdd={vi.fn()}
        onSelectPlayer={vi.fn()}
      />
    );
    // The remove "✕" button should not be present in export mode.
    expect(screen.queryByText('✕')).toBeNull();
  });

  it('activates onSelectPlayer via Enter and Space keys', () => {
    const onSelectPlayer = vi.fn();
    render(
      <LegacyRosterSection
        players={[STARTER, null, null, null, null]}
        section="starters"
        isExport
        onSelectPlayer={onSelectPlayer}
      />
    );
    const card = screen.getByTestId('roster-card-starter');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onSelectPlayer).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(card, { key: ' ' });
    expect(onSelectPlayer).toHaveBeenCalledTimes(2);
  });

  it('ignores unrelated keys (no Tab/Shift/Escape activation)', () => {
    const onSelectPlayer = vi.fn();
    render(
      <LegacyRosterSection
        players={[STARTER, null, null, null, null]}
        section="starters"
        isExport
        onSelectPlayer={onSelectPlayer}
      />
    );
    const card = screen.getByTestId('roster-card-starter');
    fireEvent.keyDown(card, { key: 'Tab' });
    fireEvent.keyDown(card, { key: 'Escape' });
    fireEvent.keyDown(card, { key: 'a' });
    expect(onSelectPlayer).not.toHaveBeenCalled();
  });

  it('renders interactive cards with role=button and tabIndex=0', () => {
    render(
      <LegacyRosterSection
        players={[STARTER, null, null, null, null]}
        section="starters"
        isExport
        onSelectPlayer={vi.fn()}
      />
    );
    const card = screen.getByTestId('roster-card-starter');
    expect(card).toHaveAttribute('role', 'button');
    expect(card).toHaveAttribute('tabIndex', '0');
  });

  it('renders non-interactive cards without role=button or tabIndex', () => {
    render(
      <LegacyRosterSection
        players={[STARTER, null, null, null, null]}
        section="starters"
        isExport
      />
    );
    const card = screen.getByTestId('roster-card-starter');
    expect(card).not.toHaveAttribute('role');
    expect(card).not.toHaveAttribute('tabIndex');
  });
});

// ---------------------------------------------------------------------------
// Dashboard RosterSection wrapper — forwards Stage 2C props into RosterVisual
// ---------------------------------------------------------------------------

describe('Stage 2C — dashboard RosterSection wrapper', () => {
  const teamCapSheet = {
    teamId: 'LAL',
    teamName: 'Lakers',
    players: [
      {
        id: 'player_42',
        name: 'Jane Doe',
        bio: {
          playerId: 'player_42',
          displayName: 'Jane Doe',
          position: 'G',
        },
        MIN: 30,
      },
      {
        id: 'player_99',
        name: 'John Q',
        bio: {
          playerId: 'player_99',
          displayName: 'John Q',
          position: 'F',
        },
        MIN: 20,
      },
    ],
  };

  it('opens the contract modal when a roster card is clicked', () => {
    const onOpenPlayerContractModal = vi.fn();
    render(
      <MemoryRouter>
        <RosterSection
          teamCapSheet={teamCapSheet}
          teamId="LAL"
          onOpenPlayerContractModal={onOpenPlayerContractModal}
        />
      </MemoryRouter>
    );
    const starters = screen.getAllByTestId('roster-card-starter');
    expect(starters.length).toBeGreaterThan(0);
    fireEvent.click(starters[0]);
    expect(onOpenPlayerContractModal).toHaveBeenCalledTimes(1);
    const arg = onOpenPlayerContractModal.mock.calls[0][0] as {
      id?: string;
      name?: string;
    };
    expect(['player_42', 'player_99']).toContain(arg.id);
  });

  it('does not throw when onOpenPlayerContractModal is omitted', () => {
    expect(() =>
      render(
        <MemoryRouter>
          <RosterSection teamCapSheet={teamCapSheet} teamId="LAL" />
        </MemoryRouter>
      )
    ).not.toThrow();
  });

  it('highlights only the focused player card', () => {
    render(
      <MemoryRouter>
        <RosterSection
          teamCapSheet={teamCapSheet}
          teamId="LAL"
          highlightPlayerId="player_42"
        />
      </MemoryRouter>
    );
    const highlighted = screen
      .getAllByTestId('roster-card-starter')
      .filter((el) => el.getAttribute('data-roster-card-highlighted') === 'true');
    expect(highlighted.length).toBe(1);
  });

  it('clears the highlight when highlightPlayerId is null (receipt dismissed)', () => {
    render(
      <MemoryRouter>
        <RosterSection
          teamCapSheet={teamCapSheet}
          teamId="LAL"
          highlightPlayerId={null}
        />
      </MemoryRouter>
    );
    const highlighted = screen
      .getAllByTestId('roster-card-starter')
      .filter((el) => el.getAttribute('data-roster-card-highlighted') === 'true');
    expect(highlighted.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CapSheet — focused player row highlight
// ---------------------------------------------------------------------------

describe('Stage 2C — CapSheet row highlight', () => {
  const teamCapSheet = {
    teamId: 'LAL',
    teamCode: 'LAL',
    players: [
      {
        id: 'player_42',
        name: 'Jane Doe',
        displayName: 'Jane Doe',
        bio: { playerId: 'player_42', displayName: 'Jane Doe' },
        contract: {
          salariesByYear: [
            { year: 2026, season: '2025-26', salary: 30_000_000, capHit: 30_000_000 },
          ],
        },
      },
      {
        id: 'player_99',
        name: 'John Q',
        displayName: 'John Q',
        bio: { playerId: 'player_99', displayName: 'John Q' },
        contract: {
          salariesByYear: [
            { year: 2026, season: '2025-26', salary: 5_000_000, capHit: 5_000_000 },
          ],
        },
      },
    ],
  } as never;

  it('renders the highlighted row only for the matching player', () => {
    render(
      <CapSheet
        teamCapSheet={teamCapSheet}
        currentYear={2026}
        highlightPlayerId="player_42"
      />
    );
    const highlighted = screen.queryAllByTestId(
      'cap-sheet-player-row-highlighted'
    );
    expect(highlighted.length).toBe(1);
  });

  it('renders no highlight when highlightPlayerId is null', () => {
    render(
      <CapSheet
        teamCapSheet={teamCapSheet}
        currentYear={2026}
        highlightPlayerId={null}
      />
    );
    expect(
      screen.queryAllByTestId('cap-sheet-player-row-highlighted').length
    ).toBe(0);
  });

  it('renders no highlight when no row matches the focus id', () => {
    render(
      <CapSheet
        teamCapSheet={teamCapSheet}
        currentYear={2026}
        highlightPlayerId="player_does_not_exist"
      />
    );
    expect(
      screen.queryAllByTestId('cap-sheet-player-row-highlighted').length
    ).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// CapSheetFull — focused player row highlight
// ---------------------------------------------------------------------------

describe('Stage 2C — CapSheetFull row highlight', () => {
  const teamCapSheet = {
    teamId: 'LAL',
    teamCode: 'LAL',
    players: [
      {
        id: 'player_42',
        name: 'Jane Doe',
        displayName: 'Jane Doe',
        bio: { playerId: 'player_42', displayName: 'Jane Doe' },
        contract: {
          salariesByYear: [
            { year: 2026, season: '2025-26', salary: 30_000_000, capHit: 30_000_000 },
            { year: 2027, season: '2026-27', salary: 32_000_000, capHit: 32_000_000 },
          ],
        },
      },
      {
        id: 'player_99',
        name: 'John Q',
        displayName: 'John Q',
        bio: { playerId: 'player_99', displayName: 'John Q' },
        contract: {
          salariesByYear: [
            { year: 2026, season: '2025-26', salary: 5_000_000, capHit: 5_000_000 },
          ],
        },
      },
    ],
  } as never;

  it('renders the highlighted row only for the matching player', () => {
    render(
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={2026}
        highlightPlayerId="player_42"
      />
    );
    expect(
      screen.queryAllByTestId('cap-sheet-full-player-row-highlighted').length
    ).toBe(1);
  });

  it('renders no highlight when highlightPlayerId is null', () => {
    render(
      <CapSheetFull
        teamCapSheet={teamCapSheet}
        currentYear={2026}
        highlightPlayerId={null}
      />
    );
    expect(
      screen.queryAllByTestId('cap-sheet-full-player-row-highlighted').length
    ).toBe(0);
  });
});
