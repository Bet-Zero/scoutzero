/** Private preparation. Does not publish sources, mutate worlds or activate trading. */
import { z } from 'zod';
import { TeamSalaryBookInputsZ } from '@/schemas/salaryBooks';
import { resolveSimulationApronInputs } from './capTotals/simulationFinancialAssumptions';
import {
  canonicalStringify,
  sha256Digest,
} from './contractSource/deterministicDigest';
import { TeamListFull } from '@/constants/teamList';
import { ContractSourceReleaseZ } from '@/schemas/contractSourceRelease';
import { verifyContractSourceRelease } from './contractSource/contractSourceRelease';

const InputZ = z
  .object({
    asOf: z.string().datetime({ offset: true }),
    seasonId: z.string().regex(/^\d{4}-\d{2}$/),
    teams: z.record(z.string(), z.record(z.string(), z.json())),
    // Only teams with reviewed reconciled books opt in. Others keep their gaps.
    financialInputs: z.record(z.string(), TeamSalaryBookInputsZ),
    contractRelease: ContractSourceReleaseZ.optional(),
  })
  .strict();

export async function prepareSimulationFinancialBaseline(input: unknown) {
  const parsed = InputZ.parse(input);
  let contractRelease;
  if (parsed.contractRelease) {
    const release = await verifyContractSourceRelease(
      parsed.contractRelease,
      parsed.contractRelease
    );
    if (
      release.effectiveAt !== parsed.asOf ||
      `${release.salaryCapYear - 1}-${String(release.salaryCapYear).slice(-2)}` !==
        parsed.seasonId
    )
      throw new Error('Simulation and Contract baseline dates differ.');
    const artifact = canonicalStringify(release);
    contractRelease = {
      artifact,
      descriptor: {
        releaseId: release.releaseId,
        releaseVersion: release.releaseVersion,
        releaseDigest: release.releaseDigest,
        artifactSha256: await sha256Digest(artifact),
        filename: 'private-simulation-contract-release.json',
      },
    };
  }
  const codes = TeamListFull.map((t) => t.code).sort();
  if (
    canonicalStringify(Object.keys(parsed.teams).sort()) !==
    canonicalStringify(codes)
  )
    throw new Error(
      'Simulation preparation requires all thirty retained teams.'
    );
  const teams = structuredClone(parsed.teams);
  for (const [code, inputs] of Object.entries(parsed.financialInputs)) {
    if (
      !teams[code] ||
      teams[code].teamCode !== code ||
      inputs.salaryCapYear !== Number(parsed.seasonId.slice(0, 4)) + 1
    )
      throw new Error('Simulation team or season mismatch.');
    const policy = inputs.simulationAssumptions;
    if (!policy || policy.asOfDate !== parsed.asOf.slice(0, 10))
      throw new Error('An explicit dated SIMULATION assumption is required.');
    const original = { ...inputs };
    delete original.simulationAssumptions;
    if (
      (await sha256Digest(canonicalStringify(original))).slice(7) !==
      policy.reconciledInputSha256
    )
      throw new Error('Reconciled financial input digest mismatch.');
    const resolved = resolveSimulationApronInputs(inputs, code, parsed.asOf);
    if (resolved?.status !== 'ready')
      throw new Error(
        'Simulation assumption is blocked by unresolved inputs or signals.'
      );
    // Do not rewrite source rows, Contracts, rights, hard caps, or other team fields.
    teams[code].salaryBookInputs = JSON.parse(JSON.stringify(inputs));
  }
  return {
    classification: 'SIMULATION' as const,
    asOf: parsed.asOf,
    seasonId: parsed.seasonId,
    teams,
    ...(contractRelease ? { contractRelease } : {}),
  };
}
