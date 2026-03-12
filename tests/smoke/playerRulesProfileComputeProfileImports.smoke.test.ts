import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPUTE_PROFILE_ALIAS =
  '@/features/architect/utils/playerRulesProfile/computeProfile';
const COMPUTE_PROFILE_SHIM_PATH = path.resolve(
  __dirname,
  '../../src/features/architect/utils/playerRulesProfile/computeProfile.js'
);

describe('playerRulesProfile computeProfile import compatibility', () => {
  it('resolves computeProfile via extensionless and explicit .js imports', async () => {
    const extensionless = await import(COMPUTE_PROFILE_ALIAS);
    const withJs = await import(`${COMPUTE_PROFILE_ALIAS}.js`);

    expect(extensionless.computePlayerRulesProfile).toBeDefined();
    expect(withJs.computePlayerRulesProfile).toBe(
      extensionless.computePlayerRulesProfile
    );
  });

  it('kept computeProfile.js remains a pure compatibility shim', () => {
    const shimContent = fs.readFileSync(COMPUTE_PROFILE_SHIM_PATH, 'utf8');

    expect(shimContent).toContain("export * from './computeProfile.ts';");
    expect(shimContent).not.toContain('function normalizeLeagueContext');
    expect(shimContent).not.toContain('function buildContractSummary');
    expect(shimContent).not.toContain(
      'export function computePlayerRulesProfile'
    );
  });
});
