import { useEffect, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, isSyntheticDraftReviewEnvironment } from '@/firebaseConfig';
import { ARCHITECT_WORLDS_COLLECTION } from '@/constants/collections';
import {
  DRAFT_SIMULATION_KIND,
  describeSimulationReason,
} from '@/features/architect/utils/draftReview/simulationInventory';
import type { previewRetainedDraftSimulation } from '@/features/architect/utils/draftReview/simulationPreview';
import { mutationSnapshotText } from '@/features/architect/utils/mutationPipeline.snapshotDigest';
import { resolveTeamCode } from '@/features/architect/utils/worldTeamData';
import type { useTradeMachine } from '@/features/architect/hooks/useTradeMachine';
import type { ArchitectMutationPayload } from '@/features/architect/utils/mutationPipeline';

type Result = Awaited<ReturnType<typeof previewRetainedDraftSimulation>>;
export function useDraftSimulation(args: {
  teams: unknown;
  worldId: string | null;
  userId: string | null;
  asOfDate: string | null;
  yearKey: number;
  exportTrade: ReturnType<typeof useTradeMachine>['exportCurrentTrade'];
}) {
  const [enabledWorld, setEnabledWorld] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{
    key: string;
    epoch: number;
    result?: Result;
    error?: string;
    operationId: string;
  } | null>(null);
  const key = mutationSnapshotText({
    teams: args.teams,
    world: args.worldId,
    user: args.userId,
    date: args.asOfDate,
    yearKey: args.yearKey,
  });
  const identity = useRef({ key, epoch: 0 });
  if (identity.current.key !== key)
    identity.current = { key, epoch: identity.current.epoch + 1 };
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setEnabledWorld(null);
    setState(null);
    if (!isSyntheticDraftReviewEnvironment() || !args.worldId || !args.userId)
      return;
    let cancelled = false;
    void getDoc(doc(db, ARCHITECT_WORLDS_COLLECTION, args.worldId))
      .then((snapshot) => {
        if (
          !cancelled &&
          snapshot.data()?.draftSimulationKind === DRAFT_SIMULATION_KIND
        )
          setEnabledWorld(args.worldId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [args.worldId, args.userId]);
  const enabled = !!args.worldId && enabledWorld === args.worldId;
  const current =
    enabled && state?.key === key && state.epoch === identity.current.epoch
      ? state
      : null;
  async function validate() {
    if (!enabled || !args.worldId || !args.userId || busy) return;
    const operationId = `draft_sim_${crypto.randomUUID()}`;
    const requestKey = key;
    const epoch = identity.current.epoch;
    setBusy(true);
    setState(null);
    try {
      const data = args.exportTrade();
      // Exact pick-only action-layer handoff, including all listed consideration.
      // Any player selection is rejected, never silently dropped.
      if (data.some((t) => (Reflect.get(t, 'outgoingPlayers') ?? []).length))
        throw new Error('This simulation supports pick-only exchanges.');
      const payload: ArchitectMutationPayload = {
        teams: data.map((t) => ({
          teamCode:
            resolveTeamCode(String(t.teamId ?? '')) || String(t.teamId ?? ''),
          sends: [],
          picksOut: [],
          outgoingEntitlements: t.outgoingEntitlements ?? [],
          entitlementsOut: t.outgoingEntitlements ?? [],
          salaryMatchingElection: t.salaryMatchingElection ?? null,
          cashSent: t.cashSent ?? 0,
          cashToTeamId: t.cashToTeamId
            ? resolveTeamCode(t.cashToTeamId) || t.cashToTeamId
            : null,
        })),
        ...(args.asOfDate ? { asOfDate: args.asOfDate } : {}),
        tradeCtx: {
          source: 'tradeMachine',
          worldId: args.worldId,
          yearKey: args.yearKey,
          ...(args.asOfDate ? { asOfDate: args.asOfDate } : {}),
        },
      };
      const { previewRetainedDraftSimulation } = await import(
        '@/features/architect/utils/draftReview/simulationPreview'
      );
      const result = await previewRetainedDraftSimulation({
        userId: args.userId,
        worldId: args.worldId,
        seasonId: `${args.yearKey - 1}-${String(args.yearKey).slice(-2)}`,
        mutationType: 'executeTrade',
        operationId,
        payload,
      });
      if (
        alive.current &&
        identity.current.key === requestKey &&
        identity.current.epoch === epoch
      )
        setState({ key: requestKey, epoch, result, operationId });
    } catch (error) {
      if (
        alive.current &&
        identity.current.key === requestKey &&
        identity.current.epoch === epoch
      )
        setState({
          key: requestKey,
          epoch,
          operationId,
          error:
            error instanceof Error
              ? error.message
              : 'Simulation review unavailable.',
        });
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const prepared =
    current?.result?.status === 'prepared' ? current.result : null;
  const reason =
    current?.error ??
    (current?.result?.status === 'blocked'
      ? current.result.reasons.map(describeSimulationReason).join(' ')
      : null);
  return {
    enabled,
    busy,
    validate,
    current: !!current,
    preview:
      prepared?.preview ??
      (reason
        ? {
            legal: false,
            reason,
            violations: [],
            warnings: [],
            omittedStages: [],
          }
        : null),
    details: prepared?.details ?? null,
    reasons: reason,
    reviews: current?.result?.reviews ?? [],
    handoff:
      prepared && prepared.preview.legal && current
        ? { authority: prepared.authority, operationId: current.operationId }
        : undefined,
  };
}
