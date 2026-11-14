import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  loadSimulationFinancialBaseline,
  simulationContractRelease,
} from './simulationFinancialBaseline';
import { DEFAULT_TRUSTED_CONTRACT_RELEASE } from './trustedContractBaseline';

const dir = '/tmp/scoutzero-simulation-loader-test';
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});
describe('local simulation world initialization boundary', () => {
  const current = () => {
    const pin = {
      releaseId: 'software-current',
      releaseVersion: 1,
      releaseDigest: `sha256:${'a'.repeat(64)}`,
    };
    const artifact = JSON.stringify({
      schemaVersion: 1,
      ...pin,
      supersedes: null,
      effectiveAt: '2026-11-14T09:28:06.158Z',
      salaryCapYear: 2027,
      source: { evidenceCatalog: { transformations: [], limitations: [] } },
      records: [
        {
          contractId: 'software-contract',
          playerId: 'software-player',
          teamId: 'MIA',
          sourceObservationId: 'software-observation',
          sourceContractPath: 'contract',
          resultingState: { contractId: 'software-contract' },
        },
      ],
      coverage: {
        totalSourceContracts: 1,
        completeRecordIds: ['software-contract'],
        needsInputRecordIds: [],
      },
    });
    return {
      classification: 'SIMULATION' as const,
      asOf: '2026-11-14T09:28:06.158Z',
      seasonId: '2026-27',
      teams: {},
      contractRelease: {
        artifact,
        descriptor: {
          ...pin,
          filename: 'private-contract.json',
          artifactSha256: `sha256:${createHash('sha256').update(artifact).digest('hex')}`,
        },
      },
    };
  };
  it('selects only the private package release with matching dates and exact bytes', () => {
    const value = current();
    expect(simulationContractRelease(value)).toMatchObject({
      salaryCapYear: 2027,
      releaseId: 'software-current',
    });
    expect(
      simulationContractRelease(value, value.contractRelease.descriptor)
        .releaseId
    ).toBe('software-current');
    expect(() =>
      simulationContractRelease({ ...value, seasonId: '2025-26' })
    ).toThrow('dates differ');
    expect(() =>
      simulationContractRelease({ ...value, asOf: '2026-11-15T09:28:06.158Z' })
    ).toThrow('dates differ');
    expect(() =>
      simulationContractRelease(value, {
        ...value.contractRelease.descriptor,
        releaseDigest: `sha256:${'b'.repeat(64)}`,
      })
    ).toThrow('not retained');
    value.contractRelease.artifact += ' ';
    expect(() => simulationContractRelease(value)).toThrow('digest');
  });
  it('copies a retained historical release without opening a newer missing package', async () => {
    vi.stubEnv(
      'SCOUTZERO_SIMULATION_FINANCIAL_FILE',
      '/not-present-new-package'
    );
    vi.stubEnv('FUNCTIONS_EMULATOR', 'false');
    // Exercise the built server and its actual packaged historical artifact.
    const { loadParentContractRelease } = createRequire(__filename)(
      '../../lib/architect/simulationFinancialBaseline.js'
    );
    await expect(
      loadParentContractRelease(DEFAULT_TRUSTED_CONTRACT_RELEASE)
    ).resolves.toMatchObject({ salaryCapYear: 2026 });
  });
  it('is absent by default and rejects production before reading inputs', async () => {
    vi.stubEnv('SCOUTZERO_SIMULATION_FINANCIAL_FILE', '');
    await expect(loadSimulationFinancialBaseline()).resolves.toBeNull();
    vi.stubEnv('SCOUTZERO_SIMULATION_FINANCIAL_FILE', '/not-read');
    vi.stubEnv('FUNCTIONS_EMULATOR', 'false');
    await expect(loadSimulationFinancialBaseline()).rejects.toThrow(
      'local demo emulator'
    );
  });
  it('retains all team bytes and requires exact local input identity', async () => {
    mkdirSync(dir, { recursive: true });
    const teams = Object.fromEntries(
      Array.from({ length: 30 }, (_, i) => {
        const code = `A${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`;
        return [
          code,
          {
            teamCode: code,
            salaryBookInputs: {
              simulationAssumptions: { classification: 'SIMULATION' },
            },
          },
        ];
      })
    );
    const value = {
      classification: 'SIMULATION',
      asOf: '2026-06-05T12:19:56.526Z',
      seasonId: '2025-26',
      teams,
    };
    const bytes = JSON.stringify(value);
    writeFileSync(`${dir}/input.json`, bytes);
    vi.stubEnv('SCOUTZERO_SIMULATION_FINANCIAL_FILE', `${dir}/input.json`);
    vi.stubEnv(
      'SCOUTZERO_SIMULATION_FINANCIAL_SHA256',
      createHash('sha256').update(bytes).digest('hex')
    );
    vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
    vi.stubEnv('GCLOUD_PROJECT', 'demo-architect-review');
    vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8082');
    await expect(loadSimulationFinancialBaseline()).resolves.toEqual(value);
    writeFileSync(`${dir}/input.json`, bytes + ' ');
    await expect(loadSimulationFinancialBaseline()).rejects.toThrow(
      'digest mismatch'
    );
  });
});
