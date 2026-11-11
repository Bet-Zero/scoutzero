/** SIMULATION financial input: local file, or a pinned live object when switched on. */
import {
  readSimulationPackageBytes,
  type ReadStorageObject,
} from './simulationPackageSource';

type SimulationPackage = {
  classification: 'SIMULATION';
  asOf: string;
  seasonId: string;
  teams: Record<string, Record<string, unknown>>;
};
export async function loadSimulationFinancialBaseline(
  readObject?: ReadStorageObject
): Promise<SimulationPackage | null> {
  const bytes = await readSimulationPackageBytes('financial', readObject);
  if (!bytes) return null;
  const value = JSON.parse(bytes.toString()) as SimulationPackage;
  if (
    value.classification !== 'SIMULATION' ||
    !value.teams ||
    Object.keys(value.teams).length !== 30 ||
    Object.entries(value.teams).some(
      ([code, team]) => !/^[A-Z]{3}$/.test(code) || team.teamCode !== code
    )
  )
    throw new Error('Expected the prepared thirty-team SIMULATION baseline.');
  return value;
}
