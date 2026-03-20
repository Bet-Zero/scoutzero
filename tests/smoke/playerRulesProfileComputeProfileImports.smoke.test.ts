import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COMPUTE_PROFILE_ALIAS =
  '@/features/architect/utils/playerRulesProfile/computeProfile';
const COMPUTE_PROFILE_AUTHORITY_SPECIFIER =
  '../../src/features/architect/utils/playerRulesProfile/computeProfile.ts';
const COMPUTE_PROFILE_DELETED_SHIM_PATH = path.resolve(
  __dirname,
  '../../src/features/architect/utils/playerRulesProfile/computeProfile.js'
);

describe('playerRulesProfile computeProfile import compatibility', () => {
  it('keeps computeProfile extensionless imports aligned with the TS authority', async () => {
    const extensionless = await import(COMPUTE_PROFILE_ALIAS);
    const authority = await import(COMPUTE_PROFILE_AUTHORITY_SPECIFIER);

    expect('default' in authority).toBe(false);
    expect(Object.keys(authority)).toEqual(
      expect.arrayContaining(['computePlayerRulesProfile'])
    );
    expect(extensionless.computePlayerRulesProfile).toBeDefined();
    expect(extensionless.computePlayerRulesProfile).toBe(
      authority.computePlayerRulesProfile
    );
  });

  it('retired computeProfile shim path is absent', () => {
    expect(fs.existsSync(COMPUTE_PROFILE_DELETED_SHIM_PATH)).toBe(false);
  });
});
