/**
 * FILE: src/tests/routing/playerRouteUtils.test.ts
 * PURPOSE: Direct unit coverage for the player profile route resolver — the single
 *          source of truth for profile URL generation and incoming-URL resolution.
 * RELATIONS: BZE-77 (Player Discovery and Entry Flow Audit), finding F1 from BZE-69.
 */

import { describe, it, expect } from 'vitest';
import {
  toPlayerSlug,
  getPlayerRouteId,
  getPlayerDisplayName,
  resolvePlayerProfileTarget,
  getPlayerProfileUrl,
} from '@/shared/utils/routing/playerRouteUtils';

describe('toPlayerSlug', () => {
  it('lowercases and hyphenates a display name', () => {
    expect(toPlayerSlug('LeBron James')).toBe('lebron-james');
  });

  it('strips accents/diacritics', () => {
    expect(toPlayerSlug('Kristaps Porziņģis')).toBe('kristaps-porzingis');
    expect(toPlayerSlug('Nikola Jokić')).toBe('nikola-jokic');
  });

  it('collapses punctuation and repeated whitespace', () => {
    expect(toPlayerSlug("De'Aaron  Fox")).toBe('de-aaron-fox');
    expect(toPlayerSlug('  Jaren   Jackson Jr.  ')).toBe('jaren-jackson-jr');
  });

  it('returns empty string for empty/non-string input', () => {
    expect(toPlayerSlug('')).toBe('');
    expect(toPlayerSlug(null)).toBe('');
    expect(toPlayerSlug(undefined)).toBe('');
    // @ts-expect-error verifying runtime guard against non-string input
    expect(toPlayerSlug(123)).toBe('');
  });
});

describe('getPlayerRouteId', () => {
  it('prefers id, then bio.playerId, then player_id', () => {
    expect(getPlayerRouteId({ id: 'a', bio: { playerId: 'b' }, player_id: 'c' })).toBe('a');
    expect(getPlayerRouteId({ bio: { playerId: 'b' }, player_id: 'c' })).toBe('b');
    expect(getPlayerRouteId({ player_id: 'c' })).toBe('c');
  });

  it('coerces numeric ids to strings and handles missing ids', () => {
    expect(getPlayerRouteId({ id: 42 })).toBe('42');
    expect(getPlayerRouteId(null)).toBe('');
    expect(getPlayerRouteId({})).toBe('');
  });
});

describe('getPlayerDisplayName', () => {
  it('prefers bio.displayName, then bio.name, then name, then playerName', () => {
    expect(
      getPlayerDisplayName({ bio: { displayName: 'A', name: 'B' }, name: 'C', playerName: 'D' })
    ).toBe('A');
    expect(getPlayerDisplayName({ bio: { name: 'B' }, name: 'C' })).toBe('B');
    expect(getPlayerDisplayName({ name: 'C', playerName: 'D' })).toBe('C');
    expect(getPlayerDisplayName({ playerName: 'D' })).toBe('D');
    expect(getPlayerDisplayName(null)).toBe('');
  });
});

describe('resolvePlayerProfileTarget', () => {
  const players = [
    { id: '1', bio: { displayName: 'Stephen Curry' } },
    { id: '2', bio: { displayName: 'Klay Thompson' } },
    // Two players that share a display name (distinct ids).
    { id: '3', bio: { displayName: 'Jaylen Brown' } },
    { id: '4', bio: { displayName: 'Jaylen Brown' } },
  ];

  it('returns none when no identifiers are supplied', () => {
    expect(resolvePlayerProfileTarget(players, {})).toEqual({
      player: null,
      source: null,
      status: 'none',
    });
  });

  it('matches by pid and reports the pid source', () => {
    const result = resolvePlayerProfileTarget(players, { pid: '2' });
    expect(result.status).toBe('matched');
    expect(result.source).toBe('pid');
    expect(result.player?.id).toBe('2');
  });

  it('pid takes priority over legacyPlayer and slug', () => {
    const result = resolvePlayerProfileTarget(players, {
      pid: '1',
      legacyPlayer: '2',
      slug: 'klay-thompson',
    });
    expect(result.source).toBe('pid');
    expect(result.player?.id).toBe('1');
  });

  it('falls back to legacyPlayer when pid does not match', () => {
    const result = resolvePlayerProfileTarget(players, {
      pid: 'nope',
      legacyPlayer: '2',
    });
    expect(result.source).toBe('legacyPlayer');
    expect(result.player?.id).toBe('2');
  });

  it('matches a unique slug', () => {
    const result = resolvePlayerProfileTarget(players, { slug: 'stephen-curry' });
    expect(result.status).toBe('matched');
    expect(result.source).toBe('slug');
    expect(result.player?.id).toBe('1');
  });

  it('reports ambiguous for a duplicated slug', () => {
    const result = resolvePlayerProfileTarget(players, { slug: 'jaylen-brown' });
    expect(result.status).toBe('ambiguous');
    expect(result.source).toBe('slug');
    expect(result.player).toBeNull();
  });

  it('reports missing for an unknown slug', () => {
    const result = resolvePlayerProfileTarget(players, { slug: 'nobody-here' });
    expect(result.status).toBe('missing');
    expect(result.source).toBe('slug');
    expect(result.player).toBeNull();
  });

  it('handles a non-array players input safely', () => {
    expect(resolvePlayerProfileTarget(undefined, { pid: '1' })).toEqual({
      player: null,
      source: null,
      status: 'none',
    });
  });
});

describe('getPlayerProfileUrl', () => {
  it('emits slug + encoded pid when both exist', () => {
    expect(
      getPlayerProfileUrl({ id: 'abc 123', bio: { displayName: 'Stephen Curry' } })
    ).toBe('/profiles/stephen-curry?pid=abc%20123');
  });

  it('emits slug only when there is no id', () => {
    expect(getPlayerProfileUrl({ bio: { displayName: 'Stephen Curry' } })).toBe(
      '/profiles/stephen-curry'
    );
  });

  it('emits ?pid= only when there is no resolvable name', () => {
    expect(getPlayerProfileUrl({ id: '99' })).toBe('/profiles?pid=99');
  });

  it('falls back to /profiles when neither slug nor id exist', () => {
    expect(getPlayerProfileUrl({})).toBe('/profiles');
    expect(getPlayerProfileUrl(null)).toBe('/profiles');
  });
});
