/** Local simulation input, never a deployed source release or draft capability. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

type SimulationPackage = {
  classification: 'SIMULATION';
  asOf: string;
  seasonId: string;
  teams: Record<string, Record<string, unknown>>;
};
export function loadSimulationFinancialBaseline(): SimulationPackage | null {
  const file = process.env.SCOUTZERO_SIMULATION_FINANCIAL_FILE;
  if (!file) return null;
  if (
    process.env.FUNCTIONS_EMULATOR !== 'true' ||
    !(process.env.GCLOUD_PROJECT ?? '').startsWith('demo-') ||
    !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
  )
    throw new Error(
      'Simulation financial inputs require the local demo emulator.'
    );
  const bytes = readFileSync(file);
  if (
    createHash('sha256').update(bytes).digest('hex') !==
    process.env.SCOUTZERO_SIMULATION_FINANCIAL_SHA256
  )
    throw new Error('Simulation financial input digest mismatch.');
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
