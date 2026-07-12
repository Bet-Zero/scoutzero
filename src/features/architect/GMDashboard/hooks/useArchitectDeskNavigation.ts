/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectDeskNavigation.ts
 * PURPOSE: Sync GM desk room, season, and focused player with URL query params.
 * OWNERSHIP: Feature: architect/GMDashboard
 */
import { useCallback, useEffect, useRef } from 'react';
import type { ActiveTab } from './useArchitectState.types';
import { LOCAL_SEASON_KEY } from './useArchitectState.helpers';

export const LOCAL_LAST_TEAM_KEY = 'architect.lastTeamSlug';

const ROOM_PARAM = 'room';
const PLAYER_PARAM = 'player';

export const DESK_ROOM_SLUGS: Record<ActiveTab, string> = {
  roster: 'roster',
  cap: 'cap',
  capfull: 'capfull',
  trade: 'trade',
  fa: 'fa',
  offseason: 'offseason',
  history: 'history',
  compare: 'compare',
  guide: 'guide',
};

const SLUG_TO_TAB = Object.fromEntries(
  Object.entries(DESK_ROOM_SLUGS).map(([tab, slug]) => [slug, tab as ActiveTab])
) as Record<string, ActiveTab>;

// BZE-250: rooms hidden from V1 navigation. Their code is parked (not deleted),
// but a `?room=<slug>` deep link must not route into them — it falls back to the
// default home surface (Full Cap Table). Season advance moved to the World menu.
const V1_HIDDEN_ROOM_SLUGS = new Set<string>([DESK_ROOM_SLUGS.offseason]);

export function readRoomFromUrl(): ActiveTab | null {
  if (typeof window === 'undefined') return null;
  const slug = new URLSearchParams(window.location.search).get(ROOM_PARAM);
  if (!slug) return null;
  if (V1_HIDDEN_ROOM_SLUGS.has(slug)) return null;
  return SLUG_TO_TAB[slug] ?? null;
}

function readPlayerFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const player = new URLSearchParams(window.location.search).get(PLAYER_PARAM);
  return player?.trim() ? player.trim() : null;
}

export function writeLastTeamSlug(teamSlug: string) {
  if (typeof window === 'undefined' || !teamSlug.trim()) return;
  try {
    localStorage.setItem(LOCAL_LAST_TEAM_KEY, teamSlug.trim());
  } catch {
    // ignore
  }
}

export function readLastTeamSlug(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LOCAL_LAST_TEAM_KEY);
  } catch {
    return null;
  }
}

export function readPersistedViewingSeasonEndYear(): number | null {
  if (typeof window === 'undefined') return null;
  const qp = new URLSearchParams(window.location.search).get('season');
  if (qp && Number.isFinite(parseInt(qp, 10))) {
    return parseInt(qp, 10);
  }
  try {
    const saved = localStorage.getItem(LOCAL_SEASON_KEY);
    if (saved && Number.isFinite(parseInt(saved, 10))) {
      return parseInt(saved, 10);
    }
  } catch {
    // ignore
  }
  return null;
}

interface UseArchitectDeskNavigationParams {
  activeTab: ActiveTab;
  setActiveTab: React.Dispatch<React.SetStateAction<ActiveTab>>;
  /**
   * First pinned player, mirrored to the `?player=` deep-link param. The pin
   * board is multi-player, but the URL carries a single representative player
   * for shareable deep links; a `?player=` link rehydrates as a pin.
   */
  focusedPlayerId?: string | null;
  onPlayerIdFromUrl?: (playerId: string) => void;
  /**
   * The Trade Machine lives in a full-viewport overlay, not a workbench room, so
   * its URL state is tracked separately from `activeTab`. When open, the `room`
   * query param reads `trade`; a `?room=trade` deep link opens the overlay
   * instead of routing `activeTab` to a (nonexistent) trade room.
   */
  isTradeOpen?: boolean;
  onOpenTradeFromUrl?: () => void;
}

export function useArchitectDeskNavigation({
  activeTab,
  setActiveTab,
  focusedPlayerId = null,
  onPlayerIdFromUrl,
  isTradeOpen = false,
  onOpenTradeFromUrl,
}: UseArchitectDeskNavigationParams) {
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const room = readRoomFromUrl();
    if (room === 'trade') {
      onOpenTradeFromUrl?.();
    } else if (room) {
      setActiveTab(room);
    }

    const player = readPlayerFromUrl();
    if (player) {
      onPlayerIdFromUrl?.(player);
    }
  }, [setActiveTab, onPlayerIdFromUrl, onOpenTradeFromUrl]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set(
      ROOM_PARAM,
      isTradeOpen ? DESK_ROOM_SLUGS.trade : DESK_ROOM_SLUGS[activeTab]
    );
    if (focusedPlayerId) {
      url.searchParams.set(PLAYER_PARAM, focusedPlayerId);
    } else {
      url.searchParams.delete(PLAYER_PARAM);
    }
    window.history.replaceState({}, '', url);
  }, [activeTab, focusedPlayerId, isTradeOpen]);

  const setActiveTabFromDesk = useCallback(
    (tab: ActiveTab) => {
      setActiveTab(tab);
    },
    [setActiveTab]
  );

  return {
    setActiveTabFromDesk,
  };
}
