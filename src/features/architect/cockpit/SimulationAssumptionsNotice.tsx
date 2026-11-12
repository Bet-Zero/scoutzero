/**
 * Visible SIMULATION label with every named assumption the world rests on
 * (V1 item D4). Renders nothing for worlds that are not SIMULATION.
 */
import { useEffect, useId, useState } from 'react';
import { getDoc } from 'firebase/firestore';
import { worldMetadataRef } from '@/features/architect/utils/architectFirestorePaths';
import {
  simulationAssumptionsForWorld,
  type SimulationAssumption,
  type SimulationAssumptionArea,
  type SimulationWorldMarkers,
} from '@/features/architect/utils/simulationAssumptions';

const AREAS: readonly SimulationAssumptionArea[] = [
  'Money',
  'Trades',
  'Draft picks',
];

/** Reads the world's SIMULATION markers once per world. */
export function useSimulationAssumptions(
  worldId: string | null
): readonly SimulationAssumption[] {
  const [state, setState] = useState<{
    worldId: string;
    assumptions: readonly SimulationAssumption[];
  } | null>(null);
  useEffect(() => {
    if (!worldId) return;
    let cancelled = false;
    // Resolve the reference inside the chain so any failure (no Firestore
    // available) just shows no label rather than breaking the page.
    Promise.resolve()
      .then(() => getDoc(worldMetadataRef(worldId)))
      .then((snapshot) => {
        if (cancelled) return;
        setState({
          worldId,
          assumptions: simulationAssumptionsForWorld(
            snapshot.data() as SimulationWorldMarkers | undefined
          ),
        });
      })
      .catch(() => {
        if (!cancelled) setState({ worldId, assumptions: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [worldId]);
  return worldId && state?.worldId === worldId ? state.assumptions : [];
}

export function SimulationAssumptionsList({
  assumptions,
}: {
  assumptions: readonly SimulationAssumption[];
}) {
  return (
    <div className="space-y-2" data-testid="simulation-assumptions-list">
      <p className="text-[10px] leading-4 text-cockpit-text-secondary">
        Built from public data. NBA rules are applied exactly; where data is
        missing, these named assumptions fill the gap. This is not certified
        historical compliance.
      </p>
      {AREAS.map((area) => {
        const rows = assumptions.filter((a) => a.area === area);
        if (!rows.length) return null;
        return (
          <section key={area} aria-label={`${area} assumptions`}>
            <h4 className="text-[9px] font-semibold uppercase tracking-wider text-cockpit-text-muted">
              {area}
            </h4>
            <ul className="mt-1 space-y-1.5">
              {rows.map((a) => (
                <li
                  key={a.id}
                  data-assumption-id={a.id}
                  className="text-[10px] leading-4 text-cockpit-text-secondary"
                >
                  <span className="font-semibold text-cockpit-text-primary">
                    {a.title}.
                  </span>{' '}
                  {a.statement}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function SimulationAssumptionsNotice({
  worldId,
}: {
  worldId: string | null;
}) {
  const assumptions = useSimulationAssumptions(worldId);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (!assumptions.length) return null;
  return (
    <div className="mt-1.5" data-testid="simulation-assumptions">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="rounded border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-amber-200 hover:bg-amber-500/20"
        data-testid="simulation-assumptions-toggle"
      >
        SIMULATION · {assumptions.length} named assumptions{' '}
        <span aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open ? (
        <div id={panelId} className="mt-2">
          <SimulationAssumptionsList assumptions={assumptions} />
        </div>
      ) : null}
    </div>
  );
}
