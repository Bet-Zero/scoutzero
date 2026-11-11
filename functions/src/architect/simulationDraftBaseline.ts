/** SIMULATION draft input: local file, or a pinned live object when switched on. */
import { createHash } from 'node:crypto';
import {
  readSimulationPackageBytes,
  type ReadStorageObject,
} from './simulationPackageSource';
import { canonicalStringify } from './trustedContractBaseline';

type SimulationDraftBaseline = {
  version: 1;
  releaseId: string;
  classification: 'simulation';
  assumptions: { id: string; statement: string }[];
  asOf: string;
  seasonId: string;
  identities: string[];
  retainedEntitlements: Record<string, Record<string, unknown>>;
  initialTeams: Record<string, { entitlementIds: string[] }>;
};

export async function loadSimulationDraftBaseline(
  readObject?: ReadStorageObject
) {
  const bytes = await readSimulationPackageBytes('draft', readObject);
  if (!bytes) return null;
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const baseline = JSON.parse(
    bytes.toString('utf8')
  ) as SimulationDraftBaseline;
  // The client verifies the same canonical digest before any read or review.
  if (canonicalStringify(baseline) !== bytes.toString('utf8'))
    throw new Error('Simulation draft input must be canonical JSON.');
  const teams = Object.entries(baseline.initialTeams ?? {});
  if (
    baseline.version !== 1 ||
    baseline.classification !== 'simulation' ||
    !Array.isArray(baseline.assumptions) ||
    !baseline.assumptions.length ||
    teams.length !== 30 ||
    teams.some(
      ([code, team]) =>
        !/^[A-Z]{3}$/.test(code) || !Array.isArray(team.entitlementIds)
    ) ||
    Object.keys(baseline.retainedEntitlements ?? {}).length !==
      baseline.identities?.length ||
    teams.reduce((n, [, team]) => n + team.entitlementIds.length, 0) !==
      baseline.identities.length
  )
    throw new Error(
      'Expected a complete thirty-team SIMULATION draft baseline.'
    );
  return {
    baseline,
    metadata: {
      version: 1,
      releaseId: baseline.releaseId,
      sha256,
      classification: 'simulation',
      asOf: baseline.asOf,
      seasonId: baseline.seasonId,
    },
  };
}
