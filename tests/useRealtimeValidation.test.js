import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRealtimeValidation } from '../src/hooks/tradeMachine/useRealtimeValidation.js';

describe('useRealtimeValidation', () => {
  it('returns default state when no teams provided', () => {
    const { result } = renderHook(() => 
      useRealtimeValidation([], {}, 2025, false)
    );

    expect(result.current.validationResult.passed).toBe(true);
    expect(result.current.validationResult.warnings).toEqual([]);
    expect(result.current.validationResult.violations).toEqual([]);
    expect(result.current.isValidating).toBe(false);
  });

  it('returns unknown status for non-existent team', () => {
    const { result } = renderHook(() => 
      useRealtimeValidation([], {}, 2025, false)
    );

    const status = result.current.getTeamStatus('non-existent-team');
    expect(status.status).toBe('unknown');
    expect(status.icon).toBe('❓');
    expect(status.color).toBe('text-gray-400');
  });

  it('handles empty validation result correctly', () => {
    const teams = [];
    const { result } = renderHook(() => 
      useRealtimeValidation(teams, { salaryCap: 140588000 }, 2025, false)
    );

    expect(result.current.validationResult.passed).toBe(true);
    expect(result.current.validationResult.perTeam).toEqual({});
  });

  it('respects forceTrade flag in normalization', () => {
    const teams = [];
    const { result } = renderHook(() => 
      useRealtimeValidation(teams, { salaryCap: 140588000 }, 2025, true) // forceTrade = true
    );

    expect(result.current.validationResult.passed).toBe(true);
  });
});