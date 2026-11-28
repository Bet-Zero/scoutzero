import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { brotliCompressSync } from 'node:zlib';
import { readSimulationPackageBytes } from './simulationPackageSource';

const bytes = Buffer.from('{"classification":"SIMULATION"}');
const digest = createHash('sha256').update(bytes).digest('hex');
afterEach(() => vi.unstubAllEnvs());

describe('SIMULATION package source (D2, built switched off)', () => {
  it('ignores a configured live object until the switch is on', async () => {
    const read = vi.fn(async () => bytes);
    vi.stubEnv('SCOUTZERO_SIMULATION_FINANCIAL_FILE', '');
    vi.stubEnv('SCOUTZERO_SIMULATION_FINANCIAL_OBJECT', 'gs://b/p.json');
    vi.stubEnv('SCOUTZERO_SIMULATION_FINANCIAL_SHA256', digest);
    vi.stubEnv('SCOUTZERO_SIMULATION_LIVE', '');
    await expect(
      readSimulationPackageBytes('financial', read)
    ).resolves.toBeNull();
    vi.stubEnv('SCOUTZERO_SIMULATION_LIVE', 'TRUE');
    await expect(
      readSimulationPackageBytes('financial', read)
    ).resolves.toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('reads the pinned live object only when switched on', async () => {
    const read = vi.fn(async () => bytes);
    vi.stubEnv('SCOUTZERO_SIMULATION_DRAFT_FILE', '');
    vi.stubEnv(
      'SCOUTZERO_SIMULATION_DRAFT_OBJECT',
      'gs://private-b/sim/d.json'
    );
    vi.stubEnv('SCOUTZERO_SIMULATION_DRAFT_SHA256', digest);
    vi.stubEnv('SCOUTZERO_SIMULATION_LIVE', 'true');
    await expect(readSimulationPackageBytes('draft', read)).resolves.toEqual(
      bytes
    );
    expect(read).toHaveBeenCalledWith('private-b', 'sim/d.json');
    // Changed bytes, a missing pin or a malformed name fail closed.
    vi.stubEnv('SCOUTZERO_SIMULATION_DRAFT_SHA256', '');
    await expect(readSimulationPackageBytes('draft', read)).rejects.toThrow(
      'digest mismatch'
    );
    vi.stubEnv('SCOUTZERO_SIMULATION_DRAFT_SHA256', digest);
    const changed = vi.fn(async () => Buffer.from('{}'));
    await expect(readSimulationPackageBytes('draft', changed)).rejects.toThrow(
      'digest mismatch'
    );
    vi.stubEnv('SCOUTZERO_SIMULATION_DRAFT_OBJECT', 'https://example/d.json');
    await expect(readSimulationPackageBytes('draft', read)).rejects.toThrow(
      'gs://bucket/path'
    );
  });

  it('refuses a local file outside the demo emulator and an ambiguous source', async () => {
    vi.stubEnv('SCOUTZERO_SIMULATION_FINANCIAL_FILE', '/not-read');
    vi.stubEnv('SCOUTZERO_SIMULATION_FINANCIAL_OBJECT', '');
    vi.stubEnv('FUNCTIONS_EMULATOR', 'false');
    vi.stubEnv('SCOUTZERO_SIMULATION_LIVE', 'true');
    await expect(readSimulationPackageBytes('financial')).rejects.toThrow(
      'local demo emulator'
    );
    vi.stubEnv('SCOUTZERO_SIMULATION_FINANCIAL_OBJECT', 'gs://b/p.json');
    await expect(readSimulationPackageBytes('financial')).rejects.toThrow(
      'both a local file and an object'
    );
  });

  it('loads the exact private Firestore release by kind and digest only when enabled', async () => {
    const read = vi.fn(async () => brotliCompressSync(bytes));
    vi.stubEnv('SCOUTZERO_SIMULATION_FINANCIAL_FILE', '');
    vi.stubEnv('SCOUTZERO_SIMULATION_FINANCIAL_OBJECT', '');
    vi.stubEnv('SCOUTZERO_SIMULATION_PACKAGE_SOURCE', 'firestore');
    vi.stubEnv('SCOUTZERO_SIMULATION_FINANCIAL_SHA256', digest);
    vi.stubEnv('SCOUTZERO_SIMULATION_LIVE', 'false');
    await expect(readSimulationPackageBytes('financial', undefined, read)).resolves.toBeNull();
    expect(read).not.toHaveBeenCalled();

    vi.stubEnv('SCOUTZERO_SIMULATION_LIVE', 'true');
    await expect(readSimulationPackageBytes('financial', undefined, read)).resolves.toEqual(bytes);
    expect(read).toHaveBeenCalledWith(`financial-${digest}`);

    vi.stubEnv('SCOUTZERO_SIMULATION_FINANCIAL_SHA256', '');
    await expect(readSimulationPackageBytes('financial', undefined, read)).rejects.toThrow('digest mismatch');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('rejects missing, malformed, oversized or substituted Firestore releases', async () => {
    vi.stubEnv('SCOUTZERO_SIMULATION_DRAFT_FILE', '');
    vi.stubEnv('SCOUTZERO_SIMULATION_DRAFT_OBJECT', '');
    vi.stubEnv('SCOUTZERO_SIMULATION_PACKAGE_SOURCE', 'firestore');
    vi.stubEnv('SCOUTZERO_SIMULATION_DRAFT_SHA256', digest);
    vi.stubEnv('SCOUTZERO_SIMULATION_LIVE', 'true');
    const read = (data: unknown) => readSimulationPackageBytes('draft', undefined, async () => data);
    await expect(read(undefined)).rejects.toThrow('missing or invalid');
    await expect(read(Buffer.alloc(1_000_001))).rejects.toThrow('missing or invalid');
    await expect(read(Buffer.from('invalid brotli'))).rejects.toThrow('could not be decompressed');
    await expect(read(brotliCompressSync(Buffer.from('{}')))).rejects.toThrow('digest mismatch');
    vi.stubEnv('SCOUTZERO_SIMULATION_DRAFT_OBJECT', 'gs://private-b/sim/d.json');
    await expect(read(undefined)).rejects.toThrow('more than one source');
  });
});
