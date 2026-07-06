/**
 * FILE: src/features/architect/history/TeamHistoryTab/worldEventsShare.ts
 * PURPOSE: Minimal external store that shares the WorldEventsTimeline's
 *          loaded committed events with sibling panels (BZE-218).
 * OWNERSHIP: Feature: architect/history
 *
 * Why not lift the events into TeamHistoryTab state: a parent setState on
 * report would re-render WorldEventsTimeline and re-invoke its
 * useWorldTeamEvents hook — the source-selection guardrails pin that hook to
 * exactly one invocation per world-mode render pass. With this store only
 * subscribing panels re-render when events arrive.
 */

import type { WorldEventRecord } from '@/features/architect/history/hooks/useWorldTeamEvents';

type Listener = () => void;

export type SharedWorldEventsStore = {
  get: () => WorldEventRecord[];
  set: (next: WorldEventRecord[]) => void;
  subscribe: (listener: Listener) => () => void;
};

export const createSharedWorldEventsStore = (): SharedWorldEventsStore => {
  let events: WorldEventRecord[] = [];
  const listeners = new Set<Listener>();

  return {
    get: () => events,
    set: (next: WorldEventRecord[]) => {
      events = Array.isArray(next) ? next : [];
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
