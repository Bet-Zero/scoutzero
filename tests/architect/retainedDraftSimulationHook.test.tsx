import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDraftSimulation } from '@/features/architect/tradeMachine/useDraftSimulation';
const mock = vi.hoisted(() => ({
  enabled: true,
  read: vi.fn(),
  preview: vi.fn(),
}));
vi.mock('@/firebaseConfig', () => ({
  db: {},
  isSyntheticDraftReviewEnvironment: () => mock.enabled,
}));
vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => args,
  getDoc: (...args: unknown[]) => mock.read(...args),
}));
vi.mock('@/features/architect/utils/draftReview/simulationPreview', () => ({
  previewRetainedDraftSimulation: (...args: unknown[]) => mock.preview(...args),
}));
const args = {
  teams: [{ selection: 'A' }],
  worldId: 'w',
  userId: 'u',
  asOfDate: '2026-06-05',
  yearKey: 2026,
  exportTrade: () => [
    {
      teamId: 'CHI',
      outgoingPlayers: [],
      outgoingEntitlements: [],
      cashSent: 0,
      cashToTeamId: null,
      salaryMatchingElection: null,
    },
  ],
};
const prepared = () => ({
  status: 'prepared',
  authority: {},
  reviews: [],
  preview: {
    legal: true,
    reason: 'Permitted test proposal',
    violations: [],
    warnings: [],
  },
  details: {},
});
beforeEach(() => {
  mock.enabled = true;
  mock.read
    .mockReset()
    .mockResolvedValue({
      data: () => ({ draftSimulationKind: 'retained-picks-governed-test-v1' }),
    });
  mock.preview.mockReset().mockResolvedValue(prepared());
});
describe('protected draft review UI handoff', () => {
  it('discards a late response even after selection A -> B -> A', async () => {
    let finish!: (value: unknown) => void;
    mock.preview.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const { result, rerender } = renderHook((p) => useDraftSimulation(p), {
      initialProps: args,
    });
    await waitFor(() => expect(result.current.enabled).toBe(true));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.validate();
    });
    await waitFor(() => expect(mock.preview).toHaveBeenCalledTimes(1));
    rerender({ ...args, teams: [{ selection: 'B' }] });
    rerender({ ...args, teams: [{ selection: 'A' }] });
    await act(async () => {
      finish(prepared());
      await pending;
    });
    expect(result.current.current).toBe(false);
    expect(result.current.handoff).toBeUndefined();
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.preview?.legal).toBe(true);
    expect(result.current.handoff?.authority).toBeDefined();
  });
  it('invalidates a completed review on world, date, season or user changes', async () => {
    const { result, rerender } = renderHook((p) => useDraftSimulation(p), {
      initialProps: args,
    });
    await waitFor(() => expect(result.current.enabled).toBe(true));
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.handoff).toBeDefined();
    rerender({ ...args, yearKey: 2027 });
    expect(result.current.handoff).toBeUndefined();
    rerender(args);
    await act(async () => {
      await result.current.validate();
    });
    expect(result.current.handoff).toBeDefined();
    rerender({ ...args, asOfDate: '2026-06-06' });
    expect(result.current.handoff).toBeUndefined();
    rerender({ ...args, userId: 'different-user' });
    expect(result.current.handoff).toBeUndefined();
    rerender({ ...args, worldId: 'another-world' });
    expect(result.current.handoff).toBeUndefined();
  });
  it('does not read source or enable review in the default/production environment', () => {
    mock.enabled = false;
    const { result } = renderHook(() => useDraftSimulation(args));
    expect(result.current.enabled).toBe(false);
    expect(mock.read).not.toHaveBeenCalled();
    expect(mock.preview).not.toHaveBeenCalled();
  });
});
