import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRankerPool } from '@/features/ranker/hooks/useRankerPool';
import type { RosterManagerPlayer } from '@/features/roster/hooks/useRosterManager';

const player = (id: string) => ({ id, name: id.toUpperCase() }) as RosterManagerPlayer;
const ids = (pool: RosterManagerPlayer[]) => pool.map((p) => p.id);

const setup = () => {
  const hook = renderHook(() => useRankerPool({}, []));
  act(() => hook.result.current.addPlayersToPool(['a', 'b', 'c', 'd'].map(player)));
  return hook;
};

describe('useRankerPool undo', () => {
  it('brings a removed player back where they were', () => {
    const { result } = setup();
    act(() => result.current.removePlayer('b'));
    expect(ids(result.current.pool)).toEqual(['a', 'c', 'd']);
    expect(ids(result.current.lastRemoval ?? [])).toEqual(['b']);
    act(() => result.current.undoRemoval());
    expect(ids(result.current.pool)).toEqual(['a', 'b', 'c', 'd']);
    expect(result.current.lastRemoval).toBeNull();
  });

  it('undoes Clear all, keeping players added since', () => {
    const { result } = setup();
    act(() => result.current.clearPool());
    expect(result.current.pool).toEqual([]);
    act(() => result.current.addPlayersToPool([player('e')]));
    act(() => result.current.undoRemoval());
    expect(ids(result.current.pool).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('undoes removals newest first', () => {
    const { result } = setup();
    act(() => result.current.removePlayer('a'));
    act(() => result.current.removePlayer('d'));
    act(() => result.current.undoRemoval());
    expect(ids(result.current.pool)).toEqual(['b', 'c', 'd']);
    act(() => result.current.undoRemoval());
    expect(ids(result.current.pool)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('keeps the Top-N score a pulled player came with', () => {
    const { result } = renderHook(() => useRankerPool({}, []));
    act(() =>
      result.current.addPlayersToPool([player('a'), player('b')], new Map([['a', 21.5]]))
    );
    expect(result.current.scores.get('a')).toBe(21.5);
    expect(result.current.scores.has('b')).toBe(false);
  });
});
