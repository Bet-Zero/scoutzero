import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as seasonManagerModule from '@/features/architect/utils/seasonManager';

describe('E95 seasonManager compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect');
  const seasonManagerShimPath = path.join(srcRoot, 'utils/seasonManager.js');
  const seasonManagerAuthorityPath = path.join(srcRoot, 'utils/seasonManager.ts');
  const seasonManagerAuthoritySpecifier =
    '../../features/architect/utils/seasonManager.ts';
  const expectedExports = [
    'advanceSeason',
    'advanceSeasonInWorld',
    'processSeasonTransition',
    'resolveDraftPickConveyanceForYear',
    'resolveDraftPickSwapsForYear',
  ] as const;
  const expectedSourceOrder = [
    'advanceSeason',
    'processSeasonTransition',
    'advanceSeasonInWorld',
    'resolveDraftPickSwapsForYear',
    'resolveDraftPickConveyanceForYear',
  ] as const;

  it('deletes the seasonManager.js compatibility shim', () => {
    expect(fs.existsSync(seasonManagerShimPath)).toBe(false);
  });

  it('extensionless imports expose the same named API as the TS authority', async () => {
    const authorityModule = await import(seasonManagerAuthoritySpecifier);

    expect(Object.keys(authorityModule).sort()).toEqual(
      Array.from(expectedExports).sort()
    );
    expect(Object.keys(seasonManagerModule).sort()).toEqual(
      Array.from(expectedExports).sort()
    );
    expect('default' in authorityModule).toBe(false);

    for (const exportName of expectedExports) {
      expect(authorityModule[exportName]).toBe(seasonManagerModule[exportName]);
    }
  });

  it('seasonManager.ts preserves the current export order and has no default export', () => {
    const source = fs.readFileSync(seasonManagerAuthorityPath, 'utf-8');
    const exportNames = Array.from(
      source.matchAll(/^export (?:(?:async )?function|const) (\w+)/gm)
    ).map(([, exportName]) => exportName);

    expect(exportNames).toEqual(Array.from(expectedSourceOrder));
    expect(source).not.toContain('export default');
  });
});
