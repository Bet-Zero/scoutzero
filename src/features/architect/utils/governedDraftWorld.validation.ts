/** Pure baseline validation shared by the private CLI and runtime. */
import {
  GovernedDraftWorldBaselineZ,
  type GovernedDraftWorldBaseline,
} from '@/schemas/governedDraftWorld';
import { canonicalStringify } from './contractSource/deterministicDigest';

export function validateGovernedDraftBaseline(
  input: unknown
): GovernedDraftWorldBaseline {
  const baseline = GovernedDraftWorldBaselineZ.parse(input);
  if (
    baseline.classification === 'qualified-source' &&
    Object.values(baseline.initialTeams).some(
      (team) =>
        JSON.stringify(team.salaryBookInputs ?? null).includes(
          'simulation-assumption'
        ) ||
        JSON.stringify(team.salaryBookInputs ?? null).includes(
          'simulationAssumptions'
        )
    )
  ) {
    throw new Error(
      'SIMULATION assumptions cannot certify a qualified historical source.'
    );
  }
  if (
    (baseline.classification === 'simulation') !==
    Boolean(baseline.assumptions?.length)
  )
    throw new Error(
      'Simulation baselines must name their assumptions; other classifications cannot carry any.'
    );
  if (
    baseline.classification !== 'simulation' &&
    baseline.apron.some((a) =>
      a.observations.some((o) => o.value && 'basis' in o.value)
    )
  )
    throw new Error(
      'Scoped SIMULATION Apron determinations cannot certify a qualified history.'
    );
  const ids = baseline.records.map((r) => String(r.entitlement.id));
  if (
    new Set(baseline.identities).size !== baseline.identities.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !baseline.identities.includes(id)) ||
    Object.keys(baseline.retainedEntitlements).length !==
      baseline.identities.length ||
    baseline.identities.some(
      (id) => baseline.retainedEntitlements[id]?.id !== id
    )
  )
    throw new Error('Draft baseline identity membership is inconsistent.');
  for (const id of baseline.identities) {
    const e = baseline.retainedEntitlements[id];
    const owners = Object.entries(baseline.initialTeams).filter(
      ([, team]) =>
        Array.isArray(team.entitlementIds) && team.entitlementIds.includes(id)
    );
    if (
      typeof e.holderTeam !== 'string' ||
      owners.length !== 1 ||
      owners[0][0] !== e.holderTeam
    )
      throw new Error(
        'Retained draft membership must be conserved without inferring ownership.'
      );
  }
  for (const team of Object.values(baseline.initialTeams)) {
    if (
      !Array.isArray(team.entitlementIds) ||
      new Set(team.entitlementIds).size !== team.entitlementIds.length ||
      team.entitlementIds.some(
        (id) => typeof id !== 'string' || !baseline.identities.includes(id)
      )
    )
      throw new Error(
        'Initial draft membership differs from the retained identity set.'
      );
  }
  if (
    baseline.unresolved.some((u) =>
      u.entitlementIds.some((id) => !baseline.identities.includes(id))
    ) ||
    baseline.unresolved.some((u) =>
      u.entitlementIds.some((id) => ids.includes(id))
    )
  )
    throw new Error(
      'Unresolved identities must remain retained and outside admitted trading authority.'
    );
  for (const { entitlement: e, ownership: o } of baseline.records) {
    const original =
      typeof e.underlyingPickId === 'string'
        ? /^([A-Z]{3})_(\d{4})_1st$/.exec(e.underlyingPickId)
        : null;
    if (
      canonicalStringify(e) !==
        canonicalStringify(baseline.retainedEntitlements[String(e.id)]) ||
      e.kind !== 'pick_ownership' ||
      !original ||
      o.pick.originalTeam !== original[1] ||
      o.pick.draftYear !== Number(original[2]) ||
      o.pick.round !== 1 ||
      (e.originalTeam != null && e.originalTeam !== o.pick.originalTeam) ||
      e.round !== 1 ||
      e.underlyingPickId !== o.pick.id ||
      e.seasonYear !== o.pick.draftYear ||
      o.claimCoverage !== 'complete' ||
      o.claims.length !== 1 ||
      o.claims[0].status !== 'owned-unconditionally' ||
      o.claims[0].team !== e.holderTeam ||
      o.conditionalProgram ||
      o.unresolvedDependencyIds.length ||
      !baseline.initialTeams[e.holderTeam] ||
      !baseline.stepien[e.holderTeam]
    )
      throw new Error(
        'Draft baseline requires exact admitted unconditional original identities.'
      );
    const owners = Object.entries(baseline.initialTeams).filter(
      ([, team]) =>
        Array.isArray(team.entitlementIds) &&
        team.entitlementIds.includes(e.id!)
    );
    if (owners.length !== 1 || owners[0][0] !== e.holderTeam)
      throw new Error(
        'Draft baseline team membership differs from its ownership facts.'
      );
  }
  return baseline;
}
