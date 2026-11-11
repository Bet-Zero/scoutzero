import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadSimulationFinancialBaseline } from './simulationFinancialBaseline';

const dir = '/tmp/scoutzero-simulation-loader-test';
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});
describe('local simulation world initialization boundary', () => {
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
