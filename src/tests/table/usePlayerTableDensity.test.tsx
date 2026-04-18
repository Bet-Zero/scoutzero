// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import usePlayerTableDensity, {
  DENSITY_MODES,
  DENSITY_SCALES,
} from '@/features/table/PlayerTable/hooks/usePlayerTableDensity';

describe('usePlayerTableDensity', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('defaults to comfortable mode', () => {
    const { result } = renderHook(() => usePlayerTableDensity());

    expect(result.current.mode).toBe(DENSITY_MODES.COMFORTABLE);
    expect(result.current.scale).toBe(DENSITY_SCALES.comfortable);
    expect(result.current.isCompact).toBe(false);
  });

  it('restores compact mode from localStorage', () => {
    localStorage.setItem('players_density_mode', DENSITY_MODES.COMPACT);

    const { result } = renderHook(() => usePlayerTableDensity());

    expect(result.current.mode).toBe(DENSITY_MODES.COMPACT);
    expect(result.current.scale).toBe(DENSITY_SCALES.compact);
    expect(result.current.isCompact).toBe(true);
  });

  it('persists valid mode changes', () => {
    const { result } = renderHook(() => usePlayerTableDensity());

    act(() => {
      result.current.setMode(DENSITY_MODES.COMPACT);
    });

    expect(result.current.mode).toBe(DENSITY_MODES.COMPACT);
    expect(localStorage.getItem('players_density_mode')).toBe(
      DENSITY_MODES.COMPACT
    );
  });

  it('rejects invalid mode changes', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => usePlayerTableDensity());

    act(() => {
      result.current.setMode('dense');
    });

    expect(result.current.mode).toBe(DENSITY_MODES.COMFORTABLE);
    expect(localStorage.getItem('players_density_mode')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith('Invalid density mode: dense');
  });
});
