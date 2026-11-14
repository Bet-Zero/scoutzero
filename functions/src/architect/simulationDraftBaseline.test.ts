import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadSimulationDraftBaseline } from './simulationDraftBaseline';
import { canonicalStringify } from './trustedContractBaseline';

const dir = '/tmp/scoutzero-simulation-draft-loader-test';
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

// Invented software input; team codes are labels only.
function baseline() {
  const codes = Array.from(
    { length: 30 },
    (_, i) =>
      `A${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`
  );
  const identities = codes.map((c) => `ent:${c}:2027:1:own:x`);
  return {
    version: 1,
    releaseId: 'simulation-software-test',
    classification: 'simulation',
    assumptions: [{ id: 'software-premise', statement: 'Software premise.' }],
    asOf: '2026-06-05T12:19:56.526Z',
    seasonId: '2025-26',
    identities,
    retainedEntitlements: Object.fromEntries(
      identities.map((id, i) => [id, { id, holderTeam: codes[i] }])
    ),
    initialTeams: Object.fromEntries(
      codes.map((c, i) => [c, { entitlementIds: [identities[i]] }])
    ),
  };
}

function stage(bytes: string) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/draft.json`, bytes);
  vi.stubEnv('SCOUTZERO_SIMULATION_DRAFT_FILE', `${dir}/draft.json`);
  vi.stubEnv(
    'SCOUTZERO_SIMULATION_DRAFT_SHA256',
    createHash('sha256').update(bytes).digest('hex')
  );
  vi.stubEnv('FUNCTIONS_EMULATOR', 'true');
  vi.stubEnv('GCLOUD_PROJECT', 'demo-architect-review');
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8082');
}

describe('local simulation draft initialization boundary', () => {
  it('is absent by default and rejects production before reading inputs', async () => {
    vi.stubEnv('SCOUTZERO_SIMULATION_DRAFT_FILE', '');
    await expect(loadSimulationDraftBaseline()).resolves.toBeNull();
    vi.stubEnv('SCOUTZERO_SIMULATION_DRAFT_FILE', '/not-read');
    vi.stubEnv('FUNCTIONS_EMULATOR', 'false');
    await expect(loadSimulationDraftBaseline()).rejects.toThrow(
      'local demo emulator'
    );
  });

  it('pins exact canonical bytes and returns immutable world metadata', async () => {
    const value = baseline();
    const bytes = canonicalStringify(value);
    stage(bytes);
    const loaded = await loadSimulationDraftBaseline();
    expect(loaded?.baseline).toEqual(value);
    expect(loaded?.metadata).toEqual({
      version: 1,
      releaseId: 'simulation-software-test',
      sha256: createHash('sha256').update(bytes).digest('hex'),
      classification: 'simulation',
      asOf: value.asOf,
      seasonId: '2025-26',
      assumptions: value.assumptions,
    });
    writeFileSync(`${dir}/draft.json`, bytes + ' ');
    await expect(loadSimulationDraftBaseline()).rejects.toThrow(
      'digest mismatch'
    );
  });

  it('rejects non-canonical, unlabelled or incomplete inputs', async () => {
    stage(JSON.stringify(baseline(), null, 2));
    await expect(loadSimulationDraftBaseline()).rejects.toThrow(
      'canonical JSON'
    );
    stage(canonicalStringify({ ...baseline(), assumptions: [] }));
    await expect(loadSimulationDraftBaseline()).rejects.toThrow('thirty-team');
    const missing = baseline();
    missing.initialTeams.AAA.entitlementIds = [];
    stage(canonicalStringify(missing));
    await expect(loadSimulationDraftBaseline()).rejects.toThrow('thirty-team');
  });
});
