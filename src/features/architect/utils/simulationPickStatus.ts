/**
 * What the Trade Machine says about each first-round right in a SIMULATION
 * world (V1 item E1): whether it can be traded now, and why not when it
 * cannot. Pure; it restates the checks the governed trade review applies, so
 * a pick shown as tradeable is one the review can accept.
 */
import type { GovernedDraftWorldBaseline } from '@/schemas/governedDraftWorld';
import { evaluateDraftApronLifecycle } from './draftApronMechanisms';
import { apronLifecycleVerdict } from './draftReview/consumption';
import { toEndYear } from './seasonFormat';
import { reviewSimulationDraftWindow } from './draftReview/horizon';

export type SimulationPickStatus = {
  readonly tradeable: boolean;
  readonly text: string;
};

export function simulationPickStatuses(
  baseline: Pick<
    GovernedDraftWorldBaseline,
    | 'classification'
    | 'seasonId'
    | 'records'
    | 'retainedEntitlements'
    | 'unresolved'
    | 'apron'
  > &
    Partial<Pick<GovernedDraftWorldBaseline, 'stepien' | 'asOf'>>
): Record<string, SimulationPickStatus> {
  if (baseline.classification !== 'simulation') return {};
  // The legacy June baseline keeps its recorded exclusion. A reconciled
  // current window permits unselected coming-draft rights (CBA2-C02.1).
  const comingDraft = toEndYear(baseline.seasonId) ?? Number.NaN;
  const scopes = Object.values(baseline.stepien ?? {});
  const upcomingAdmitted =
    scopes.length > 0 &&
    scopes.every(
      (scope) =>
        scope.firstFutureDraftYear === comingDraft &&
        reviewSimulationDraftWindow(
          scope.finiteScope?.simulationWindow,
          baseline.asOf ?? '',
          [comingDraft]
        ).status === 'permits'
    );
  const currentLastYear = upcomingAdmitted
    ? Math.min(
        ...scopes.map((scope) => scope.finiteScope!.simulationWindow!.lastYear)
      )
    : null;
  const lastOpen = Math.max(
    ...baseline.records.map((r) => r.ownership.pick.draftYear)
  );
  const admitted = new Map(
    baseline.records.map((r) => [String(r.entitlement.id), r])
  );
  const unconfirmed = new Set(
    baseline.unresolved.flatMap((u) => u.entitlementIds)
  );
  const statuses: Record<string, SimulationPickStatus> = {};
  for (const [id, entitlement] of Object.entries(
    baseline.retainedEntitlements
  )) {
    const year = Number(entitlement.seasonYear);
    const record = admitted.get(id);
    if (entitlement.simulationRestriction === 'forfeited') {
      statuses[id] = {
        tradeable: false,
        text: 'Not tradeable: forfeited by league sanction',
      };
      continue;
    }
    if (currentLastYear !== null && year > currentLastYear) {
      statuses[id] = {
        tradeable: false,
        text: 'Not tradeable: outside the seven-draft trading window',
      };
      continue;
    }
    if (year < comingDraft || (year === comingDraft && !upcomingAdmitted)) {
      statuses[id] = {
        tradeable: false,
        text: `Not tradeable: the ${year} Draft is next, and trading its picks is not supported yet`,
      };
      continue;
    }
    if (!record) {
      statuses[id] = {
        tradeable: false,
        text: unconfirmed.has(id)
          ? "Not tradeable: its terms can't be confirmed"
          : year > lastOpen
            ? `Not tradeable until the ${comingDraft} Draft is over`
            : 'Not tradeable yet: protected, swap or pool right',
      };
      continue;
    }
    const apron = baseline.apron.find(
      (a) => a.originalPick.id === record.ownership.pick.id
    );
    const lifecycle = apron ? evaluateDraftApronLifecycle(apron) : null;
    const verdict = lifecycle
      ? apronLifecycleVerdict(lifecycle)
      : 'needs-input';
    // A triggered freeze holds until later seasons release it; the review
    // refuses the pick meanwhile, so it reads as frozen.
    const triggered =
      lifecycle?.freezeTriggered.status === 'known' &&
      lifecycle.freezeTriggered.value;
    statuses[id] =
      verdict === 'permits'
        ? { tradeable: true, text: 'Unprotected, held outright' }
        : verdict === 'component-prohibits' || triggered
          ? {
              tradeable: false,
              text: 'Not tradeable: frozen by the Second Apron rule',
            }
          : {
              tradeable: false,
              text: "Not tradeable: the team's Second Apron history is incomplete",
            };
  }
  return statuses;
}
