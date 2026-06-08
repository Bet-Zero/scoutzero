/**
 * FILE: src/tests/architect/useArchitectDeskNavigation.test.ts
 * PURPOSE: URL slug mapping for GM desk navigation.
 */
import { describe, expect, it } from 'vitest';
import {
  DESK_ROOM_SLUGS,
  readRoomFromUrl,
} from '@/features/architect/GMDashboard/hooks/useArchitectDeskNavigation';

describe('useArchitectDeskNavigation', () => {
  it('maps all active tabs to URL slugs', () => {
    expect(DESK_ROOM_SLUGS.cap).toBe('cap');
    expect(DESK_ROOM_SLUGS.trade).toBe('trade');
    expect(Object.keys(DESK_ROOM_SLUGS)).toHaveLength(9);
  });

  it('readRoomFromUrl returns null without window', () => {
    expect(readRoomFromUrl()).toBeNull();
  });

  // The cockpit default desk is `capfull` (see useArchitectState). That default
  // is only applied when readRoomFromUrl() returns null, so a `?room=` slug must
  // still win — this keeps League handoff deep links (e.g. ?room=roster) intact.
  it('readRoomFromUrl honors an explicit room slug so the capfull default is overridable', () => {
    const original = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      location: { search: '?room=roster' },
    };
    try {
      expect(readRoomFromUrl()).toBe('roster');
    } finally {
      if (original === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = original;
      }
    }
  });
});
