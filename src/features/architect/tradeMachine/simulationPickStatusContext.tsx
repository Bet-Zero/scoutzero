/**
 * Per-pick trade status for SIMULATION worlds (V1 item E1), shared with the
 * pick rows of every team card. Empty for any other world, so rows keep their
 * ordinary labels and menus.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import {
  simulationPickStatuses,
  type SimulationPickStatus,
} from '@/features/architect/utils/simulationPickStatus';

type Statuses = Readonly<Record<string, SimulationPickStatus>>;
const EMPTY: Statuses = Object.freeze({});

export const SimulationPickStatusContext = createContext<Statuses>(EMPTY);

export function useSimulationPickStatus(
  entitlementId: string | number | null | undefined
): SimulationPickStatus | null {
  const statuses = useContext(SimulationPickStatusContext);
  return entitlementId == null
    ? null
    : (statuses[String(entitlementId)] ?? null);
}

/** Reads the world's governed draft baseline once per world. */
export function useSimulationPickStatuses(worldId: string | null): Statuses {
  const [state, setState] = useState<{
    worldId: string;
    statuses: Statuses;
  } | null>(null);
  useEffect(() => {
    if (!worldId) return;
    let cancelled = false;
    // Loaded lazily so worlds without a draft baseline never pull it in; any
    // failure leaves the ordinary rows unchanged.
    import('@/features/architect/utils/governedDraftWorld.load')
      .then(({ loadGovernedDraftWorld }) => loadGovernedDraftWorld(worldId))
      .then((loaded) => {
        if (!cancelled)
          setState({
            worldId,
            statuses: loaded ? simulationPickStatuses(loaded.baseline) : EMPTY,
          });
      })
      .catch(() => {
        if (!cancelled) setState({ worldId, statuses: EMPTY });
      });
    return () => {
      cancelled = true;
    };
  }, [worldId]);
  return worldId && state?.worldId === worldId ? state.statuses : EMPTY;
}
